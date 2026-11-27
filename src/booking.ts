import {
  arrayUnion, collection, doc, runTransaction, serverTimestamp, Timestamp,
  type DocumentReference, type Firestore,
} from 'firebase/firestore';
import type { Appointment } from './domain';

const SLOT_MS = 15 * 60 * 1000;

export function appointmentSlotIds(resourceId: string, start: Date, end: Date): string[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error('La plage horaire du rendez-vous est invalide.');
  }
  if (startMs % SLOT_MS !== 0 || endMs % SLOT_MS !== 0) {
    throw new Error('Les rendez-vous doivent commencer et se terminer sur un créneau de 15 minutes.');
  }
  const ids: string[] = [];
  for (let cursor = startMs; cursor < endMs; cursor += SLOT_MS) {
    ids.push(`slot_${encodeURIComponent(resourceId)}_${Math.floor(cursor / SLOT_MS)}`);
  }
  return ids;
}

export async function confirmAppointment(db: Firestore, appointmentId: string, uid: string, waiverReason?: string, producer?: { uid: string; name: string }): Promise<void> {
  if (!navigator.onLine) throw new Error('La confirmation nécessite une connexion Internet.');
  if (!producer?.uid) throw new Error('Affectez un producteur avant de confirmer ce rendez-vous.');
  const ref = doc(db, 'appointments', appointmentId);
  await runTransaction(db, async (transaction) => {
    const appointmentSnap = await transaction.get(ref);
    if (!appointmentSnap.exists()) throw new Error('Ce rendez-vous n’existe plus.');
    const appointment = appointmentSnap.data() as Appointment;
    if (!['requested', 'awaiting_deposit', 'rescheduled', 'confirmed'].includes(appointment.status)) {
      throw new Error('Ce rendez-vous ne peut pas être confirmé dans son état actuel.');
    }
    const depositRequired = Math.max(0, Number(appointment.depositExpectedXaf) || 0);
    const depositPaid = Math.max(0, Number(appointment.amountPaidXaf) || 0);
    const waiver = waiverReason?.trim();
    if (depositPaid < depositRequired && !waiver) {
      throw new Error(`Acompte insuffisant : ${depositPaid.toLocaleString('fr-FR')} / ${depositRequired.toLocaleString('fr-FR')} FCFA. Encaissez l’acompte ou saisissez un motif de dérogation manager.`);
    }
    const start = appointment.startsAt.toDate();
    const end = appointment.endsAt.toDate();
    const locks = appointmentSlotIds(appointment.resourceId || 'studio', start, end);
    const lockRefs = locks.map((id) => doc(db, 'appointmentLocks', id));
    const artistRef = appointment.artistId ? doc(db, 'artists', appointment.artistId) : null;
    const producerRef = doc(db, 'users', producer.uid);
    const [lockSnapshots, artistSnapshot, producerSnapshot] = await Promise.all([
      Promise.all(lockRefs.map((lockRef) => transaction.get(lockRef))),
      artistRef ? transaction.get(artistRef) : Promise.resolve(null),
      transaction.get(producerRef),
    ]);
    if (!producerSnapshot.exists() || producerSnapshot.data().role !== 'producer' || producerSnapshot.data().active !== true) {
      throw new Error('Le producteur sélectionné est introuvable ou inactif. Actualisez la liste des comptes.');
    }
    const conflict = lockSnapshots.find((snapshot) => snapshot.exists() && snapshot.data().appointmentId !== appointmentId);
    if (conflict) throw new Error('Ce créneau chevauche un rendez-vous déjà confirmé.');

    transaction.update(ref, {
      status: 'confirmed', confirmedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      producerUid: producer.uid, producerName: producer.name,
      ...(depositPaid < depositRequired ? { depositWaived: true, depositWaivedBy: uid, depositWaiverReason: waiver, depositWaivedAt: serverTimestamp() } : {}),
    });
    transaction.set(doc(collection(db, 'notifications')), {
      recipientUid: appointment.ownerUid, title: 'Rendez-vous confirmé',
      message: `Votre séance « ${appointment.serviceName} » est confirmée.`,
      kind: 'appointment_confirmed', createdBy: uid, createdAt: serverTimestamp(), readAt: null,
    });
    if (artistRef && artistSnapshot?.exists()) {
      transaction.update(artistRef, { producerUids: arrayUnion(producer.uid), updatedAt: serverTimestamp() });
    }
    lockRefs.forEach((lockRef) => transaction.set(lockRef, {
      appointmentId, resourceId: appointment.resourceId || 'studio',
      createdAt: serverTimestamp(), startsAt: appointment.startsAt, endsAt: appointment.endsAt,
    }));
  });
}

export async function cancelAppointment(db: Firestore, appointmentId: string): Promise<void> {
  if (!navigator.onLine) throw new Error('L’annulation d’un rendez-vous confirmé nécessite une connexion.');
  const ref = doc(db, 'appointments', appointmentId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('Rendez-vous introuvable.');
    const appointment = snapshot.data() as Appointment;
    const ids = ['confirmed', 'in_progress'].includes(appointment.status)
      ? appointmentSlotIds(appointment.resourceId || 'studio', appointment.startsAt.toDate(), appointment.endsAt.toDate())
      : [];
    const lockRefs: DocumentReference[] = ids.map((id) => doc(db, 'appointmentLocks', id));
    const lockSnaps = await Promise.all(lockRefs.map((lockRef) => transaction.get(lockRef)));
    transaction.update(ref, { status: 'cancelled', updatedAt: serverTimestamp() });
    lockRefs.forEach((lockRef, index) => {
      if (lockSnaps[index]?.exists() && lockSnaps[index]?.data()?.appointmentId === appointmentId) {
        transaction.delete(lockRef);
      }
    });
  });
}

export async function updateAppointmentProgress(db: Firestore, appointmentId: string, nextStatus: 'in_progress' | 'completed'): Promise<void> {
  if (!navigator.onLine) throw new Error('Le suivi d’une séance exige une connexion Internet.');
  const ref = doc(db, 'appointments', appointmentId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('Rendez-vous introuvable.');
    const appointment = snapshot.data() as Appointment;
    const allowed = nextStatus === 'in_progress'
      ? appointment.status === 'confirmed'
      : appointment.status === 'in_progress';
    if (!allowed) throw new Error('Cette transition de séance n’est pas autorisée.');
    transaction.update(ref, { status: nextStatus, updatedAt: serverTimestamp() });
    if (nextStatus === 'completed') {
      const ids = appointmentSlotIds(appointment.resourceId || 'studio', appointment.startsAt.toDate(), appointment.endsAt.toDate());
      ids.forEach((id) => transaction.delete(doc(db, 'appointmentLocks', id)));
    }
  });
}

export function buildAppointmentWindow(dateTime: string, durationMinutes: number): { startsAt: Timestamp; endsAt: Timestamp } {
  const start = new Date(`${dateTime}:00+01:00`);
  if (Number.isNaN(start.getTime())) throw new Error('Date de rendez-vous invalide.');
  const duration = Math.max(15, Math.ceil(durationMinutes / 15) * 15);
  const end = new Date(start.getTime() + duration * 60_000);
  return { startsAt: Timestamp.fromDate(start), endsAt: Timestamp.fromDate(end) };
}


export async function rescheduleAppointment(db: Firestore, appointmentId: string, newDateTime: string): Promise<void> {
  if (!navigator.onLine) throw new Error('Le déplacement d’un rendez-vous exige une connexion Internet.');
  const ref = doc(db, 'appointments', appointmentId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('Rendez-vous introuvable.');
    const appointment = snapshot.data() as Appointment;
    const duration = Math.max(15, Math.round((appointment.endsAt.toMillis() - appointment.startsAt.toMillis()) / 60_000));
    const next = buildAppointmentWindow(newDateTime, duration);
    const oldIds = appointment.status === 'confirmed'
      ? appointmentSlotIds(appointment.resourceId || 'studio', appointment.startsAt.toDate(), appointment.endsAt.toDate())
      : [];
    const oldRefs = oldIds.map((id) => doc(db, 'appointmentLocks', id));
    const oldSnaps = await Promise.all(oldRefs.map((lockRef) => transaction.get(lockRef)));
    transaction.update(ref, {
      startsAt: next.startsAt, endsAt: next.endsAt, status: 'requested',
      rescheduledFrom: appointment.startsAt, rescheduledAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    oldRefs.forEach((lockRef, index) => {
      if (oldSnaps[index]?.exists() && oldSnaps[index]?.data()?.appointmentId === appointmentId) transaction.delete(lockRef);
    });
  });
}
