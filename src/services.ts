import {
  addDoc, collection, doc, getDoc,
  runTransaction, serverTimestamp, setDoc, updateDoc,
  type Firestore,
} from 'firebase/firestore';
import type { Expense, PaymentMethod, RateSet, SplitType } from './domain';
import { DEFAULT_RATES } from './domain';
import { calculateShareDeltas, shareableAmount, validateRates, type Shares } from './financial';

export async function initializeBusinessSettings(db: Firestore, uid: string): Promise<void> {
  if (!navigator.onLine) throw new Error('Cette initialisation nécessite une connexion.');
  const ref = doc(db, 'settings', 'commissionRates');
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    ...DEFAULT_RATES,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    currency: 'XAF',
    timezone: 'Africa/Douala',
    studioName: 'Young Forever Records',
    expenseApprovalThresholdXaf: null,
  });
}

export async function updateBusinessRates(db: Firestore, uid: string, rates: RateSet): Promise<void> {
  if (!navigator.onLine) throw new Error('La modification des répartitions exige une connexion.');
  validateRates(rates);
  const ref = doc(db, 'settings', 'commissionRates');
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref);
    const previous = existing.exists() ? existing.data() : null;
    const version = `v-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    if (previous?.version) {
      transaction.set(doc(db, 'settings', 'commissionRates', 'history', String(previous.version)), {
        ...previous, archivedAt: serverTimestamp(), archivedBy: uid,
      });
    }
    transaction.set(ref, {
      ...rates, version, previousVersion: previous?.version || null,
      updatedAt: serverTimestamp(), updatedBy: uid, currency: 'XAF', timezone: 'Africa/Douala',
      expenseApprovalThresholdXaf: rates.expenseApprovalThresholdXaf ?? previous?.expenseApprovalThresholdXaf ?? null,
    }, { merge: true });
  });
}

function allocationBalanceId(allocationKey: string, rateVersion: string): string {
  return `${encodeURIComponent(allocationKey)}__${encodeURIComponent(rateVersion)}`;
}

export interface ValidatedPaymentInput {
  ownerUid: string;
  artistName: string;
  amountXaf: number;
  directCostsXaf: number;
  thirdPartyAmountXaf?: number;
  method: PaymentMethod;
  splitType: SplitType;
  projectId?: string;
  appointmentId?: string;
  reference?: string;
  recordedBy: string;
  producerUid?: string;
  submissionId?: string;
}

export async function recordValidatedPayment(db: Firestore, input: ValidatedPaymentInput): Promise<string> {
  if (!navigator.onLine) throw new Error('La validation d’un paiement exige une connexion Internet.');
  if (!Number.isSafeInteger(input.amountXaf) || input.amountXaf <= 0) throw new Error('Le montant doit être un nombre XAF entier positif.');
  const thirdPartyAmountXaf = input.thirdPartyAmountXaf ?? 0;
  const shareable = shareableAmount(input.amountXaf, input.directCostsXaf, thirdPartyAmountXaf);
  const allocationKey = input.projectId
    ? `project:${input.projectId}:${input.splitType}`
    : input.appointmentId
      ? `appointment:${input.appointmentId}:${input.splitType}`
      : `payment:${crypto.randomUUID()}`;
  const paymentRef = doc(collection(db, 'payments'));
  const settingsRef = doc(db, 'settings', 'commissionRates');
  const submissionRef = input.submissionId ? doc(db, 'paymentSubmissions', input.submissionId) : null;
  const appointmentRef = input.appointmentId ? doc(db, 'appointments', input.appointmentId) : null;
  const projectRef = input.projectId ? doc(db, 'projects', input.projectId) : null;
  const producerRef = input.producerUid ? doc(db, 'users', input.producerUid) : null;

  return runTransaction(db, async (transaction) => {
    if (submissionRef) {
      const submissionSnap = await transaction.get(submissionRef);
      if (!submissionSnap.exists()) throw new Error('La déclaration de paiement est introuvable.');
      const submission = submissionSnap.data();
      if (submission.status === 'approved' && typeof submission.paymentId === 'string') return submission.paymentId;
      if (submission.status !== 'pending') throw new Error('Cette déclaration a déjà été traitée.');
      if (submission.ownerUid !== input.ownerUid || Number(submission.amountXaf) !== input.amountXaf
        || (submission.reference || '') !== (input.reference || '') || submission.method !== input.method
        || submission.splitType !== input.splitType
        || (submission.projectId || '') !== (input.projectId || '')
        || (submission.appointmentId || '') !== (input.appointmentId || '')) {
        throw new Error('La déclaration ne correspond pas au paiement à enregistrer.');
      }
    }

    const settingsSnap = await transaction.get(settingsRef);
    if (!settingsSnap.exists()) throw new Error('Initialisez d’abord les répartitions financières dans Paramètres.');
    const rates = settingsSnap.data() as RateSet;
    validateRates(rates);
    if (rates[input.splitType].producer > 0 && !producerRef) {
      throw new Error('Aucun producteur n’est affecté à cette prestation. Affectez un producteur avant de valider le paiement afin que sa commission soit attribuée correctement.');
    }

    const balanceRef = doc(db, 'allocationBalances', allocationBalanceId(allocationKey, rates.version));
    const [appointmentSnap, projectSnap, producerProfile, balanceSnap] = await Promise.all([
      appointmentRef ? transaction.get(appointmentRef) : Promise.resolve(null),
      projectRef ? transaction.get(projectRef) : Promise.resolve(null),
      producerRef ? transaction.get(producerRef) : Promise.resolve(null),
      transaction.get(balanceRef),
    ]);
    if (producerRef && (!producerProfile?.exists() || producerProfile.data().active !== true || producerProfile.data().role !== 'producer')) {
      throw new Error('Le producteur affecté est introuvable ou inactif. Vérifiez son profil avant de valider le paiement.');
    }
    if (projectRef) {
      if (!projectSnap?.exists()) throw new Error('Le projet lié au paiement est introuvable.');
      if (projectSnap.data().ownerUid !== input.ownerUid) throw new Error('Ce projet ne correspond pas à cet artiste.');
      if (projectSnap.data().producerUid && projectSnap.data().producerUid !== input.producerUid) {
        throw new Error('Le producteur du paiement doit correspondre au producteur affecté au projet.');
      }
    }
    if (appointmentRef) {
      if (!appointmentSnap?.exists()) throw new Error('Le rendez-vous lié au paiement est introuvable.');
      if (appointmentSnap.data().ownerUid !== input.ownerUid) throw new Error('Ce rendez-vous ne correspond pas à cet artiste.');
      if (appointmentSnap.data().splitType !== input.splitType) throw new Error('La répartition du paiement doit correspondre à la prestation réservée.');
      if (appointmentSnap.data().producerUid && appointmentSnap.data().producerUid !== input.producerUid) {
        throw new Error('Le producteur du paiement doit correspondre au producteur affecté au rendez-vous.');
      }
      if (['cancelled', 'no_show'].includes(String(appointmentSnap.data().status))) throw new Error('Un paiement ne peut pas être ajouté à un rendez-vous annulé ou absent.');
      const paidAfterThisPayment = (Number(appointmentSnap.data().amountPaidXaf) || 0) + input.amountXaf;
      if (paidAfterThisPayment > (Number(appointmentSnap.data().servicePriceXaf) || 0)) throw new Error('Le total encaissé dépasserait le prix de cette prestation.');
    }

    const previous = balanceSnap.exists() ? balanceSnap.data() : {};
    const previousBase = Number(previous.shareableBaseXaf) || 0;
    const previousShares: Shares = {
      manager: Number(previous.managerShareXaf) || 0,
      producer: Number(previous.producerShareXaf) || 0,
      reserve: Number(previous.reserveShareXaf) || 0,
    };
    const deltas = calculateShareDeltas(previousBase + shareable, previousShares, rates, input.splitType);
    const nextShares = {
      manager: previousShares.manager + deltas.manager,
      producer: previousShares.producer + deltas.producer,
      reserve: previousShares.reserve + deltas.reserve,
    };

    transaction.set(paymentRef, {
      ownerUid: input.ownerUid,
      artistName: input.artistName,
      projectId: input.projectId || null,
      appointmentId: input.appointmentId || null,
      producerUid: input.producerUid || null,
      allocationKey,
      rateVersion: rates.version,
      previousPaymentId: previous.lastPaymentId || null,
      splitType: input.splitType,
      amountXaf: input.amountXaf,
      directCostsXaf: input.directCostsXaf,
      thirdPartyAmountXaf,
      shareableAmountXaf: shareable,
      method: input.method,
      reference: input.reference || null,
      status: 'approved',
      recordedBy: input.recordedBy,
      paidAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    transaction.set(doc(db, 'paymentReceipts', paymentRef.id), {
      ownerUid: input.ownerUid, artistName: input.artistName,
      projectId: input.projectId || null, amountXaf: input.amountXaf,
      method: input.method, reference: input.reference || null, status: 'approved',
      paidAt: serverTimestamp(), createdAt: serverTimestamp(),
    });

    (['manager', 'producer', 'reserve'] as const).forEach((beneficiaryRole) => {
      const amountXaf = deltas[beneficiaryRole];
      if (amountXaf === 0) return;
      const entryId = `${paymentRef.id}_${beneficiaryRole}`;
      transaction.set(doc(db, 'commissionEntries', entryId), {
        paymentId: paymentRef.id,
        allocationKey,
        rateVersion: rates.version,
        beneficiaryRole,
        beneficiaryUid: beneficiaryRole === 'producer' ? input.producerUid : null,
        amountXaf,
        status: beneficiaryRole === 'reserve' ? 'retained' : 'due',
        createdAt: serverTimestamp(),
      });
    });
    transaction.set(balanceRef, {
      allocationKey, rateVersion: rates.version, splitType: input.splitType,
      shareableBaseXaf: previousBase + shareable,
      managerShareXaf: nextShares.manager, producerShareXaf: nextShares.producer,
      reserveShareXaf: nextShares.reserve, lastPaymentId: paymentRef.id,
      ...(balanceSnap.exists() ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    if (appointmentRef && appointmentSnap?.exists()) {
      const previousPaid = Math.max(0, Number(appointmentSnap.data().amountPaidXaf) || 0);
      transaction.update(appointmentRef, { amountPaidXaf: previousPaid + input.amountXaf, updatedAt: serverTimestamp() });
    }
    if (submissionRef) {
      transaction.update(submissionRef, { status: 'approved', paymentId: paymentRef.id, processedAt: serverTimestamp(), processedBy: input.recordedBy });
    }
    transaction.set(doc(collection(db, 'notifications')), {
      recipientUid: input.ownerUid, title: 'Paiement enregistré',
      message: `Un paiement de ${input.amountXaf.toLocaleString('fr-FR')} FCFA a été validé par le studio.`,
      kind: 'payment_validated', createdBy: input.recordedBy, createdAt: serverTimestamp(), readAt: null,
    });
    transaction.set(doc(collection(db, 'activityLogs')), {
      actorUid: input.recordedBy, action: 'payment.validated', entityId: paymentRef.id,
      entityType: 'payment', amountXaf: input.amountXaf, createdAt: serverTimestamp(),
    });
    return paymentRef.id;
  });
}

/** Reversals are permitted only for the latest approved payment in an allocation bucket. */
export async function reverseLatestPayment(db: Firestore, paymentId: string, reason: string, uid: string): Promise<void> {
  if (!navigator.onLine) throw new Error('Une correction financière exige une connexion.');
  if (!reason.trim()) throw new Error('Indiquez le motif de la correction.');
  const paymentRef = doc(db, 'payments', paymentId);
  const receiptRef = doc(db, 'paymentReceipts', paymentId);
  const roleKeys = ['manager', 'producer', 'reserve'] as const;
  const entryRefs = roleKeys.map((role) => doc(db, 'commissionEntries', `${paymentId}_${role}`));

  await runTransaction(db, async (transaction) => {
    const originalSnap = await transaction.get(paymentRef);
    if (!originalSnap.exists()) throw new Error('Paiement introuvable.');
    const original = originalSnap.data();
    if (original.status !== 'approved') throw new Error('Ce paiement a déjà été corrigé.');
    const balanceRef = doc(db, 'allocationBalances', allocationBalanceId(String(original.allocationKey), String(original.rateVersion)));
    const appointmentRef = original.appointmentId ? doc(db, 'appointments', String(original.appointmentId)) : null;
    const [balanceSnap, receiptSnap, appointmentSnap] = await Promise.all([
      transaction.get(balanceRef), transaction.get(receiptRef),
      appointmentRef ? transaction.get(appointmentRef) : Promise.resolve(null),
    ]);
    const entrySnaps = await Promise.all(entryRefs.map((entryRef) => transaction.get(entryRef)));
    if (!balanceSnap.exists()) throw new Error('Le cumul financier de cette prestation est introuvable. Vérifiez le registre avant de corriger ce paiement.');
    const balance = balanceSnap.data();
    if (balance.lastPaymentId !== paymentId) {
      throw new Error('Pour préserver l’historique cumulatif, corrigez d’abord le paiement validé le plus récent de cette prestation.');
    }
    if (!receiptSnap.exists() || receiptSnap.data().status !== 'approved') {
      throw new Error('Le justificatif associé est introuvable ou déjà corrigé.');
    }

    const reversalId = `${paymentId}_reversal`;
    const priorShares: Shares = {
      manager: Number(balance.managerShareXaf) || 0,
      producer: Number(balance.producerShareXaf) || 0,
      reserve: Number(balance.reserveShareXaf) || 0,
    };
    const reversedShares: Shares = { manager: 0, producer: 0, reserve: 0 };
    entrySnaps.forEach((entrySnap) => {
      if (!entrySnap.exists()) return;
      const entry = entrySnap.data();
      const role = entry.beneficiaryRole as keyof Shares;
      if (role in reversedShares) reversedShares[role] += Number(entry.amountXaf) || 0;
    });
    const previousShares: Shares = {
      manager: priorShares.manager - reversedShares.manager,
      producer: priorShares.producer - reversedShares.producer,
      reserve: priorShares.reserve - reversedShares.reserve,
    };
    const previousBase = (Number(balance.shareableBaseXaf) || 0) - (Number(original.shareableAmountXaf) || 0);
    if (previousBase < 0 || Object.values(previousShares).some((value) => value < 0)) {
      throw new Error('Le registre cumulatif est incohérent. Aucune écriture n’a été modifiée.');
    }

    transaction.set(doc(db, 'payments', reversalId), {
      ...original,
      amountXaf: -Math.abs(Number(original.amountXaf)),
      directCostsXaf: -Math.abs(Number(original.directCostsXaf)),
      thirdPartyAmountXaf: -Math.abs(Number(original.thirdPartyAmountXaf) || 0),
      shareableAmountXaf: -Math.abs(Number(original.shareableAmountXaf)),
      status: 'reversal', kind: 'reversal', reversesPaymentId: paymentId,
      correctionReason: reason.trim(), recordedBy: uid,
      paidAt: serverTimestamp(), createdAt: serverTimestamp(),
    });
    entrySnaps.forEach((entrySnap, index) => {
      if (!entrySnap.exists()) return;
      const data = entrySnap.data();
      transaction.set(doc(db, 'commissionEntries', `${reversalId}_${roleKeys[index]}`), {
        ...data, paymentId: reversalId, amountXaf: -Math.abs(Number(data.amountXaf)),
        status: 'reversed', reversalOf: entrySnap.id,
        correctionReason: reason.trim(), createdAt: serverTimestamp(),
      });
      if (data.status === 'due' || data.status === 'retained') {
        transaction.update(entrySnap.ref, { status: 'reversed', reversedAt: serverTimestamp() });
      }
    });
    transaction.update(receiptRef, { status: 'reversed', reversedAt: serverTimestamp() });
    transaction.set(doc(db, 'paymentReceipts', reversalId), {
      ownerUid: original.ownerUid, artistName: original.artistName, projectId: original.projectId || null,
      amountXaf: -Math.abs(Number(original.amountXaf)), method: original.method,
      reference: original.reference || null, status: 'reversed', paidAt: serverTimestamp(),
      createdAt: serverTimestamp(), reversesPaymentId: paymentId,
    });
    if (appointmentRef && appointmentSnap?.exists()) {
      const remaining = Math.max(0, (Number(appointmentSnap.data().amountPaidXaf) || 0) - Math.abs(Number(original.amountXaf) || 0));
      transaction.update(appointmentRef, { amountPaidXaf: remaining, updatedAt: serverTimestamp() });
    }
    transaction.update(balanceRef, {
      shareableBaseXaf: previousBase,
      managerShareXaf: previousShares.manager, producerShareXaf: previousShares.producer,
      reserveShareXaf: previousShares.reserve,
      lastPaymentId: original.previousPaymentId || null,
      updatedAt: serverTimestamp(),
    });
    transaction.set(doc(collection(db, 'activityLogs')), {
      actorUid: uid, action: 'payment.reversed', entityId: reversalId, entityType: 'payment',
      originalPaymentId: paymentId, correctionReason: reason.trim(), createdAt: serverTimestamp(),
    });
    transaction.update(paymentRef, {
      status: 'reversed', reversedAt: serverTimestamp(), reversedBy: uid,
      correctionReason: reason.trim(),
    });
  });
}

export async function submitPaymentClaim(
  db: Firestore,
  values: { ownerUid: string; amountXaf: number; method: PaymentMethod; reference: string; note?: string; projectId?: string; appointmentId?: string; splitType: SplitType },
): Promise<void> {
  if (!Number.isSafeInteger(values.amountXaf) || values.amountXaf <= 0) throw new Error('Le montant doit être un nombre entier positif en XAF.');
  await addDoc(collection(db, 'paymentSubmissions'), {
    ownerUid: values.ownerUid, amountXaf: values.amountXaf, method: values.method,
    reference: values.reference, splitType: values.splitType, status: 'pending',
    ...(values.note ? { note: values.note } : {}),
    ...(values.projectId ? { projectId: values.projectId } : {}),
    ...(values.appointmentId ? { appointmentId: values.appointmentId } : {}),
    createdAt: serverTimestamp(),
  });
}

export async function createExpense(
  db: Firestore,
  input: Omit<Expense, 'id' | 'createdAt' | 'status'> & { exceptional?: boolean },
  manager: boolean,
  approvalThreshold: number | null = null,
): Promise<void> {
  if (!navigator.onLine) throw new Error('La déclaration d’une dépense nécessite une connexion Internet.');
  const jointApprovalRequired = input.exceptional === true
    || (approvalThreshold !== null && input.amountXaf > approvalThreshold);
  const status = jointApprovalRequired ? 'joint_required' : manager ? 'approved' : 'declared';
  await addDoc(collection(db, 'expenses'), {
    label: input.label, category: input.category, amountXaf: input.amountXaf,
    treatment: input.treatment, submittedBy: input.submittedBy, submittedByName: input.submittedByName,
    reason: input.reason || '', exceptional: input.exceptional === true, jointApprovalRequired,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    managerApprovedBy: null, producerApprovedBy: null,
    managerApprovedAt: null, producerApprovedAt: null, status, createdAt: serverTimestamp(),
  });
}

export async function getRateSet(db: Firestore): Promise<RateSet | null> {
  const snap = await getDoc(doc(db, 'settings', 'commissionRates'));
  return snap.exists() ? (snap.data() as RateSet) : null;
}

export async function markNotificationRead(db: Firestore, id: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', id), { readAt: serverTimestamp() });
}
