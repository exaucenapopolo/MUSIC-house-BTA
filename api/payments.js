import { getAdminServices } from './_lib/admin.js';

const FAPSHI_BASE_URL = 'https://live.fapshi.com';
const APP_URL = String(process.env.APP_URL || process.env.VITE_APP_URL || process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : '')
  || 'https://music-house-amber.vercel.app').replace(/\/$/, '');
const DEFAULT_RATES = {
  version: 'v1',
  studio: { manager: 25, producer: 50, reserve: 25 },
  distribution: { manager: 70, producer: 20, reserve: 10 },
};

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}
function clean(value, max = 180) {
  return String(value == null ? '' : value).trim().slice(0, max);
}
function amount(value, label = 'Montant') {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0 || result > 1000000000) {
    throw httpError(label + ' invalide. Le montant doit être un nombre entier positif en FCFA.');
  }
  return result;
}
function fapshiUserId(uid) {
  return clean(uid, 100).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
}
function safeCheckoutUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.toString() : '';
  } catch {
    return '';
  }
}
function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}
async function authenticate(req) {
  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  const token = String(header || '').replace(/^Bearer\s+/i, '');
  if (!token) throw httpError('Session Firebase requise.', 401);
  const services = getAdminServices();
  const decoded = await services.auth.verifyIdToken(token);
  const account = await services.auth.getUser(decoded.uid);
  const role = clean(decoded.role || (account.customClaims && account.customClaims.role) || 'client', 20);
  return {
    services,
    uid: decoded.uid,
    email: clean(decoded.email || account.email, 160).toLowerCase(),
    role: ['manager', 'producer'].includes(role) ? role : 'client',
  };
}
function assertRateSet(input) {
  const rates = input && typeof input === 'object' ? input : DEFAULT_RATES;
  for (const key of ['studio', 'distribution']) {
    const group = rates[key] || DEFAULT_RATES[key];
    const values = [Number(group.manager), Number(group.producer), Number(group.reserve)];
    if (values.some((n) => !Number.isInteger(n) || n < 0 || n > 100) || values.reduce((a, b) => a + b, 0) !== 100) {
      throw httpError('Les répartitions financières du studio sont invalides. Vérifiez Paramètres.', 409);
    }
  }
  return {
    version: clean(rates.version || DEFAULT_RATES.version, 80),
    studio: rates.studio || DEFAULT_RATES.studio,
    distribution: rates.distribution || DEFAULT_RATES.distribution,
  };
}
function allocateShares(baseXaf, rates, splitType) {
  const group = rates[splitType] || rates.studio;
  const manager = Math.floor(baseXaf * Number(group.manager) / 100);
  const producer = Math.floor(baseXaf * Number(group.producer) / 100);
  return { manager, producer, reserve: baseXaf - manager - producer };
}
async function fetchFapshiStatus(transId) {
  const apiUser = process.env.FAPSHI_API_USER;
  const secretKey = process.env.FAPSHI_SECRET_KEY;
  if (!apiUser || !secretKey) throw httpError('FAPSHI_API_USER et FAPSHI_SECRET_KEY doivent être configurées dans Vercel.', 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response;
  try {
    response = await fetch(FAPSHI_BASE_URL + '/payment-status/' + encodeURIComponent(transId), {
      method: 'GET',
      headers: { apiuser: apiUser, apikey: secretKey, Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch {
    throw httpError('Fapshi ne répond pas actuellement. Réessayez la vérification.', 502);
  } finally {
    clearTimeout(timeout);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(clean(data.message || data.error || 'Impossible de vérifier la transaction Fapshi.', 260), 502);
  return data;
}
async function sendJson(req, res, status, payload) {
  return res.status(status).json(payload);
}
async function initiatePayment(context, body) {
  if (context.role !== 'client') throw httpError('Seul le compte artiste propriétaire du rendez-vous peut régler son acompte.', 403);
  const appointmentId = clean(body.appointmentId, 150);
  if (!appointmentId || appointmentId.includes('/')) throw httpError('Rendez-vous invalide.');
  const db = context.services.db;
  const appointmentRef = db.collection('appointments').doc(appointmentId);
  const appointmentSnap = await appointmentRef.get();
  if (!appointmentSnap.exists) throw httpError('Rendez-vous introuvable.', 404);
  const appointment = appointmentSnap.data() || {};
  if (appointment.ownerUid !== context.uid) throw httpError('Ce rendez-vous ne vous appartient pas.', 403);
  if (['cancelled', 'no_show'].includes(String(appointment.status))) throw httpError('Ce rendez-vous ne peut plus être payé.');
  const price = amount(appointment.servicePriceXaf, 'Prix de la prestation');
  const paid = Math.max(0, Number(appointment.amountPaidXaf) || 0);
  const remaining = Math.max(0, price - paid);
  if (!remaining) throw httpError('Cette prestation est déjà entièrement réglée.');
  const paymentType = body.paymentType === 'full' ? 'full' : 'deposit';
  if (paymentType === 'full' && appointment.allowFullPayment === false) {
    throw httpError('Le règlement intégral en ligne n’est pas proposé pour cette prestation.', 403);
  }
  const depositTarget = Math.max(0, Math.min(price, Number(appointment.depositExpectedXaf) || 0));
  const depositDue = Math.max(0, depositTarget - paid);
  const totalToPay = paymentType === 'full' ? remaining : Math.min(depositDue, remaining);
  if (!totalToPay) throw httpError('L’acompte prévu est déjà réglé. Vous pouvez régler le solde si cette option est autorisée.');

  const attempts = await db.collection('paymentAttempts').where('appointmentId', '==', appointmentId).limit(20).get();
  const active = attempts.docs.find((doc) => ['INITIATING', 'PENDING'].includes(String(doc.data().status)));
  if (active) {
    const previous = active.data();
    if (Number(previous.amountXaf) === totalToPay && previous.paymentType === paymentType && previous.checkoutUrl) {
      return { checkoutUrl: previous.checkoutUrl, attemptId: active.id, reused: true };
    }
    throw httpError('Un paiement est déjà en cours pour ce rendez-vous. Vérifiez son statut avant de recommencer.', 409);
  }

  const attemptRef = db.collection('paymentAttempts').doc();
  const attemptId = attemptRef.id;
  await attemptRef.create({
    appointmentId,
    ownerUid: context.uid,
    artistName: clean(appointment.artistName || 'Artiste', 100),
    serviceName: clean(appointment.serviceName || 'Prestation du studio', 120),
    amountXaf: totalToPay,
    paymentType,
    expectedExternalId: attemptId,
    provider: 'fapshi',
    status: 'INITIATING',
    createdAt: context.services.FieldValue.serverTimestamp(),
    updatedAt: context.services.FieldValue.serverTimestamp(),
  });

  try {
    const apiUser = process.env.FAPSHI_API_USER;
    const secretKey = process.env.FAPSHI_SECRET_KEY;
    if (!apiUser || !secretKey) throw httpError('FAPSHI_API_USER et FAPSHI_SECRET_KEY doivent être configurées dans Vercel.', 503);
    const redirectUrl = APP_URL + '/payment-return?attemptId=' + encodeURIComponent(attemptId);
    const payload = {
      amount: totalToPay,
      ...(context.email ? { email: context.email } : {}),
      redirectUrl,
      userId: fapshiUserId(context.uid),
      externalId: attemptId,
      message: clean(appointment.serviceName || 'Prestation MUSIC HOUSE BTA', 80),
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(FAPSHI_BASE_URL + '/initiate-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', apiuser: apiUser, apikey: secretKey },
        body: JSON.stringify(payload),
        signal: controller.signal,
        cache: 'no-store',
      });
    } catch {
      throw httpError('Le service de paiement Fapshi ne répond pas. Réessayez dans un instant.', 502);
    } finally {
      clearTimeout(timeout);
    }
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { /* handled below */ }
    if (!response.ok) throw httpError(clean(data.message || data.error || 'Fapshi a refusé de préparer le paiement.', 260), 502);
    const checkoutUrl = safeCheckoutUrl(data.link || data.url || data.paymentLink || data.paymentUrl || data.payment_url || (data.data && (data.data.link || data.data.url)));
    const transId = clean(data.transId || data.trans_id || (data.data && (data.data.transId || data.data.trans_id)), 160);
    if (!checkoutUrl || !transId) throw httpError('La réponse Fapshi ne contient pas un lien sécurisé et un identifiant de transaction valides.', 502);
    await attemptRef.update({
      checkoutUrl,
      transId,
      providerUserId: fapshiUserId(context.uid),
      status: 'PENDING',
      updatedAt: context.services.FieldValue.serverTimestamp(),
    });
    return { checkoutUrl, attemptId, reused: false };
  } catch (error) {
    await attemptRef.set({
      status: 'FAILED',
      failureReason: clean(error && error.message || 'Échec de création du paiement.', 220),
      updatedAt: context.services.FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {});
    throw error;
  }
}
async function settleSuccessfulPayment(context, attemptId, attemptData, providerData) {
  const services = context.services;
  const db = services.db;
  const attemptRef = db.collection('paymentAttempts').doc(attemptId);
  const appointmentRef = db.collection('appointments').doc(String(attemptData.appointmentId));
  const paymentRef = db.collection('payments').doc('fapshi_' + attemptId);
  const receiptRef = db.collection('paymentReceipts').doc('fapshi_' + attemptId);
  const settingsRef = db.collection('settings').doc('commissionRates');

  const grossAmount = Number(providerData.amount);
  const netAmount = Number(providerData.revenue);
  const expectedUserId = fapshiUserId(attemptData.ownerUid);
  const providerExternalId = clean(providerData.externalId, 160);
  const providerUser = clean(providerData.userId, 120);
  const providerTransId = clean(providerData.transId || providerData.trans_id, 160);
  if (providerTransId && providerTransId !== String(attemptData.transId)) {
    throw httpError('L’identifiant de transaction retourné par Fapshi ne correspond pas à ce paiement.', 409);
  }
  if (providerData.userId && String(providerData.userId) !== expectedUserId) {
    throw httpError('Le compte Fapshi associé à la transaction ne correspond pas à l’artiste.', 409);
  }
  if (!Number.isSafeInteger(grossAmount) || grossAmount !== Number(attemptData.amountXaf)) {
    throw httpError('Le montant confirmé par Fapshi ne correspond pas au montant demandé. Aucun crédit financier n’a été enregistré.', 409);
  }
  if (!Number.isSafeInteger(netAmount) || netAmount <= 0 || netAmount > grossAmount) {
    throw httpError('Le montant net retourné par Fapshi est invalide. Aucune écriture financière n’a été créée.', 409);
  }
  if (providerExternalId !== attemptId || (providerUser && providerUser !== expectedUserId)) {
    throw httpError('La référence ou le compte associé à la transaction ne correspond pas. Aucune écriture financière n’a été créée.', 409);
  }

  const result = await db.runTransaction(async (transaction) => {
    const [freshAttempt, appointmentSnap, settingsSnap, existingPayment] = await Promise.all([
      transaction.get(attemptRef),
      transaction.get(appointmentRef),
      transaction.get(settingsRef),
      transaction.get(paymentRef),
    ]);
    if (!freshAttempt.exists) throw httpError('Tentative de paiement introuvable.', 404);
    if (freshAttempt.data().status === 'CONFIRMED' || existingPayment.exists) {
      if (freshAttempt.data().status !== 'CONFIRMED') {
        transaction.update(attemptRef, { status: 'CONFIRMED', updatedAt: services.FieldValue.serverTimestamp() });
      }
      return { duplicate: true, paymentId: paymentRef.id };
    }
    if (!appointmentSnap.exists()) throw httpError('Le rendez-vous associé au paiement est introuvable.', 404);
    const appointment = appointmentSnap.data();
    if (appointment.ownerUid !== attemptData.ownerUid || appointment.ownerUid !== freshAttempt.data().ownerUid) {
      throw httpError('Le propriétaire du rendez-vous ne correspond pas au paiement.', 409);
    }
    const currentPaid = Math.max(0, Number(appointment.amountPaidXaf) || 0);
    const serviceTotal = Number(appointment.servicePriceXaf) || 0;
    if (!Number.isSafeInteger(serviceTotal) || currentPaid + grossAmount > serviceTotal) {
      transaction.update(attemptRef, {
        status: 'REVIEW_REQUIRED',
        providerVerified: true,
        providerStatus: 'SUCCESSFUL',
        reviewReason: 'Le cumul reçu dépasserait le prix de la prestation. Une régularisation manager est requise.',
        providerRevenueXaf: netAmount,
        providerFeeXaf: grossAmount - netAmount,
        verifiedAt: services.FieldValue.serverTimestamp(),
        updatedAt: services.FieldValue.serverTimestamp(),
      });
      return { reviewRequired: true, paymentId: null };
    }

    const splitType = appointment.splitType === 'distribution' ? 'distribution' : 'studio';
    const rates = assertRateSet(settingsSnap.exists() ? settingsSnap.data() : DEFAULT_RATES);
    const allocationKey = 'appointment:' + String(attemptData.appointmentId) + ':' + splitType;
    const rateVersion = rates.version;
    const balanceId = encodeURIComponent(allocationKey) + '__' + encodeURIComponent(rateVersion);
    const balanceRef = db.collection('allocationBalances').doc(balanceId);
    const balanceSnap = await transaction.get(balanceRef);
    const balance = balanceSnap.exists() ? balanceSnap.data() : {};
    const previousBase = Number(balance.shareableBaseXaf) || 0;
    const previousShares = {
      manager: Number(balance.managerShareXaf) || 0,
      producer: Number(balance.producerShareXaf) || 0,
      reserve: Number(balance.reserveShareXaf) || 0,
    };
    const targetShares = allocateShares(previousBase + netAmount, rates, splitType);
    const deltas = {
      manager: targetShares.manager - previousShares.manager,
      producer: targetShares.producer - previousShares.producer,
      reserve: targetShares.reserve - previousShares.reserve,
    };
    if (Object.values(deltas).some((value) => value < 0)) throw httpError('Le registre des répartitions est incohérent. Demandez une vérification du manager.', 409);

    transaction.set(paymentRef, {
      ownerUid: attemptData.ownerUid,
      artistName: clean(appointment.artistName || attemptData.artistName || 'Artiste', 100),
      projectId: null,
      appointmentId: attemptData.appointmentId,
      producerUid: appointment.producerUid || null,
      allocationKey,
      rateVersion,
      previousPaymentId: balance.lastPaymentId || null,
      splitType,
      amountXaf: grossAmount,
      directCostsXaf: grossAmount - netAmount,
      thirdPartyAmountXaf: 0,
      shareableAmountXaf: netAmount,
      providerFeeXaf: grossAmount - netAmount,
      method: 'fapshi',
      reference: attemptData.transId,
      status: 'approved',
      recordedBy: 'fapshi',
      paidAt: services.FieldValue.serverTimestamp(),
      createdAt: services.FieldValue.serverTimestamp(),
    });
    transaction.set(receiptRef, {
      ownerUid: attemptData.ownerUid,
      artistName: clean(appointment.artistName || attemptData.artistName || 'Artiste', 100),
      projectId: null,
      appointmentId: attemptData.appointmentId,
      amountXaf: grossAmount,
      method: 'fapshi',
      reference: attemptData.transId,
      status: 'approved',
      paidAt: services.FieldValue.serverTimestamp(),
      createdAt: services.FieldValue.serverTimestamp(),
    });
    for (const beneficiaryRole of ['manager', 'producer', 'reserve']) {
      const share = deltas[beneficiaryRole];
      if (share <= 0) continue;
      const entryId = paymentRef.id + '_' + beneficiaryRole;
      transaction.set(db.collection('commissionEntries').doc(entryId), {
        paymentId: paymentRef.id,
        allocationKey,
        rateVersion,
        beneficiaryRole,
        beneficiaryUid: beneficiaryRole === 'producer' ? (appointment.producerUid || null) : null,
        ...(beneficiaryRole === 'producer' && !appointment.producerUid ? { needsAssignment: true } : {}),
        amountXaf: share,
        status: beneficiaryRole === 'reserve' ? 'retained' : 'due',
        createdAt: services.FieldValue.serverTimestamp(),
      });
    }
    transaction.set(balanceRef, {
      allocationKey,
      rateVersion,
      splitType,
      shareableBaseXaf: previousBase + netAmount,
      managerShareXaf: targetShares.manager,
      producerShareXaf: targetShares.producer,
      reserveShareXaf: targetShares.reserve,
      lastPaymentId: paymentRef.id,
      ...(balanceSnap.exists() ? {} : { createdAt: services.FieldValue.serverTimestamp() }),
      updatedAt: services.FieldValue.serverTimestamp(),
    }, { merge: true });

    const amountPaidAfter = currentPaid + grossAmount;
    const depositTarget = Math.max(0, Number(appointment.depositExpectedXaf) || 0);
    const nextStatus = appointment.status === 'confirmed' || appointment.status === 'in_progress'
      ? appointment.status
      : amountPaidAfter >= depositTarget ? 'requested' : 'awaiting_deposit';
    transaction.update(appointmentRef, {
      amountPaidXaf: amountPaidAfter,
      status: nextStatus,
      lastPaymentId: paymentRef.id,
      updatedAt: services.FieldValue.serverTimestamp(),
    });
    transaction.update(attemptRef, {
      status: 'CONFIRMED',
      providerStatus: 'SUCCESSFUL',
      providerVerified: true,
      providerRevenueXaf: netAmount,
      providerFeeXaf: grossAmount - netAmount,
      paymentId: paymentRef.id,
      confirmedAt: services.FieldValue.serverTimestamp(),
      updatedAt: services.FieldValue.serverTimestamp(),
    });
    transaction.set(db.collection('notifications').doc(), {
      recipientUid: attemptData.ownerUid,
      title: 'Paiement Fapshi confirmé',
      message: 'Votre règlement de ' + grossAmount.toLocaleString('fr-FR') + ' FCFA pour « ' + clean(appointment.serviceName || 'votre prestation', 100) + ' » a été confirmé.',
      kind: 'payment_validated',
      createdBy: 'fapshi',
      createdAt: services.FieldValue.serverTimestamp(),
      readAt: null,
    });
    transaction.set(db.collection('activityLogs').doc(), {
      actorUid: 'fapshi',
      action: 'payment.fapshi.confirmed',
      entityType: 'payment',
      entityId: paymentRef.id,
      amountXaf: grossAmount,
      appointmentId: attemptData.appointmentId,
      createdAt: services.FieldValue.serverTimestamp(),
    });
    return { confirmed: true, paymentId: paymentRef.id };
  });

  if (result.reviewRequired) return { status: 'REVIEW_REQUIRED', reviewRequired: true };
  return { status: 'CONFIRMED', paymentId: result.paymentId };
}
async function verifyAttempt(services, attemptId) {
  const db = services.db;
  const safeId = clean(attemptId, 150);
  if (!safeId || safeId.includes('/')) throw httpError('Identifiant de tentative de paiement invalide.');
  const attemptRef = db.collection('paymentAttempts').doc(safeId);
  const snap = await attemptRef.get();
  if (!snap.exists) throw httpError('Tentative de paiement introuvable.', 404);
  const attempt = snap.data() || {};
  if (attempt.status === 'CONFIRMED') return { status: 'CONFIRMED', paymentId: attempt.paymentId || null };
  if (attempt.status === 'REVIEW_REQUIRED') return { status: 'REVIEW_REQUIRED', reviewRequired: true };
  if (!attempt.transId) throw httpError('Fapshi n’a pas encore fourni de référence pour cette transaction.', 409);
  const providerData = await fetchFapshiStatus(attempt.transId);
  const providerStatus = clean(providerData.status, 32).toUpperCase();
  if (providerStatus !== 'SUCCESSFUL') {
    if (['FAILED', 'EXPIRED'].includes(providerStatus)) {
      await attemptRef.set({
        status: providerStatus,
        providerStatus,
        failureReason: clean(providerData.reason || providerStatus, 220),
        updatedAt: services.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    return { status: ['FAILED', 'EXPIRED'].includes(providerStatus) ? providerStatus : 'PENDING' };
  }
  const result = await settleSuccessfulPayment({ services }, safeId, attempt, providerData);
  return result;
}

async function handle(req, res) {
  const body = readBody(req);
  const webhookSecret = String(process.env.FAPSHI_WEBHOOK_SECRET || '');
  const receivedSecret = String(req.headers && (req.headers['x-wh-secret'] || req.headers['X-WH-SECRET']) || '');
  const isWebhook = receivedSecret.length > 0;

  if (isWebhook) {
    if (!webhookSecret || receivedSecret !== webhookSecret) return sendJson(req, res, 401, { success: false, error: 'Webhook Fapshi non autorisé.' });
    const transId = clean(body.transId || body.trans_id || (body.data && (body.data.transId || body.data.trans_id)), 160);
    if (!transId || transId.includes('/')) return sendJson(req, res, 400, { success: false, error: 'Identifiant de transaction absent.' });
    const services = getAdminServices();
    const attempts = await services.db.collection('paymentAttempts').where('transId', '==', transId).limit(1).get();
    if (attempts.empty) return sendJson(req, res, 404, { success: false, error: 'Transaction inconnue.' });
    const outcome = await verifyAttempt(services, attempts.docs[0].id);
    return sendJson(req, res, 200, { success: true, status: outcome.status });
  }

  const context = await authenticate(req);
  const action = clean(body.action, 40);
  if (action === 'initiate') {
    const result = await initiatePayment(context, body);
    return sendJson(req, res, 200, { success: true, result });
  }
  if (action === 'verify') {
    const attemptId = clean(body.attemptId, 150);
    if (!attemptId || attemptId.includes('/')) throw httpError('Identifiant de tentative de paiement invalide.');
    const snap = await context.services.db.collection('paymentAttempts').doc(attemptId).get();
    if (!snap.exists) throw httpError('Tentative de paiement introuvable.', 404);
    const attempt = snap.data() || {};
    if (attempt.ownerUid !== context.uid && !['manager', 'producer'].includes(context.role)) {
      throw httpError('Vous ne pouvez pas consulter cette transaction.', 403);
    }
    const result = await verifyAttempt(context.services, attemptId);
    return sendJson(req, res, 200, { success: true, result });
  }
  throw httpError('Action de paiement inconnue.', 400);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Méthode non autorisée.' });
  }
  try {
    return await handle(req, res);
  } catch (error) {
    const status = Number(error && error.status) || (error && String(error.code || '').startsWith('auth/') ? 401 : 400);
    if (status >= 500) console.error('[MUSIC HOUSE FAPSHI]', clean(error && error.message || error, 300));
    return res.status(status).json({ success: false, error: clean(error && error.message || 'Une erreur est survenue.', 400) });
  }
}
