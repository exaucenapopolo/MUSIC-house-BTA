import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, writeBatch, Timestamp,
} from 'firebase/firestore';

let testEnv: RulesTestEnvironment;
const projectId = 'demo-music-house-bta';
const now = Timestamp.fromDate(new Date('2026-11-28T10:00:00+01:00'));

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => { await testEnv.cleanup(); });
beforeEach(async () => { await testEnv.clearFirestore(); });

async function seed(data: Array<{ path: string; value: Record<string, unknown> }>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const entry of data) await setDoc(doc(db, entry.path), entry.value);
  });
}

function service() {
  return {
    name: 'Mixage studio', category: 'Audio', description: 'Mixage complet',
    priceXaf: 20000, durationMinutes: 120, depositPercent: 50,
    discountPercent: 10, allowFullPayment: true, splitType: 'studio',
    isActive: true, createdBy: 'manager-a', createdAt: now,
  };
}

function appointment(ownerUid: string, createdBy: string, overrides: Record<string, unknown> = {}) {
  return {
    ownerUid, artistId: ownerUid, artistName: 'Artiste test',
    serviceId: 'mixage', serviceName: 'Mixage studio',
    servicePriceXaf: 18000, serviceOriginalPriceXaf: 20000,
    discountPercent: 10, allowFullPayment: true,
    splitType: 'studio', depositExpectedXaf: 9000, amountPaidXaf: 0,
    resourceId: 'studio', startsAt: now, endsAt: Timestamp.fromDate(new Date('2026-11-28T12:00:00+01:00')),
    status: 'awaiting_deposit', createdBy, createdAt: now, updatedAt: now,
    ...overrides,
  };
}

describe('règles Firestore — séparation des rôles et protection des paiements', () => {
  it('refuse toute lecture et écriture à un visiteur non connecté', async () => {
    const guest = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(guest, 'settings/bookingPolicy')));
    await assertFails(setDoc(doc(guest, 'users/anonymous'), {
      uid: 'anonymous', role: 'client', active: true,
    }));
  });

  it('permet l’inscription client en batch, mais interdit l’auto-promotion du rôle', async () => {
    const client = testEnv.authenticatedContext('client-a', { role: 'client' }).firestore();
    const batch = writeBatch(client);
    batch.set(doc(client, 'users/client-a'), {
      uid: 'client-a', email: 'a@example.test', displayName: 'Nouvel artiste',
      role: 'client', active: true, artistId: 'client-a', createdAt: now,
    });
    batch.set(doc(client, 'artists/client-a'), {
      ownerUid: 'client-a', fullName: 'Nouvel artiste', email: 'a@example.test',
      phone: '+237600000000', status: 'active', source: 'site',
      createdAt: now, updatedAt: now, termsVersion: 'V1', termsAcceptedAt: now,
    });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(client, 'users/client-a')));
    await assertSucceeds(getDoc(doc(client, 'artists/client-a')));
    await assertSucceeds(updateDoc(doc(client, 'artists/client-a'), { fullName: 'Nouveau nom', updatedAt: now }));
    await assertFails(updateDoc(doc(client, 'users/client-a'), { role: 'manager' }));
    await assertFails(updateDoc(doc(client, 'users/client-a'), { active: false }));
  });

  it('autorise le catalogue en lecture aux clients, mais protège les tarifs', async () => {
    await seed([{ path: 'services/mixage', value: service() }]);
    const client = testEnv.authenticatedContext('client-a', { role: 'client' }).firestore();
    await assertSucceeds(getDoc(doc(client, 'services/mixage')));
    await assertSucceeds(getDocs(query(collection(client, 'services'), where('isActive', '==', true))));
    await assertFails(updateDoc(doc(client, 'services/mixage'), { priceXaf: 1 }));
    await assertFails(setDoc(doc(client, 'services/hacker'), { ...service(), priceXaf: 1 }));
  });

  it('permet une réservation au tarif réel de la prestation, mais pas une modification du prix', async () => {
    await seed([{ path: 'services/mixage', value: service() }]);
    const client = testEnv.authenticatedContext('client-a', { role: 'client' }).firestore();
    await assertSucceeds(setDoc(doc(client, 'appointments/booking-a'), appointment('client-a', 'client-a')));
    await assertSucceeds(getDoc(doc(client, 'appointments/booking-a')));
    await assertSucceeds(updateDoc(doc(client, 'appointments/booking-a'), { status: 'cancelled', updatedAt: now }));
    await assertFails(updateDoc(doc(client, 'appointments/booking-a'), { servicePriceXaf: 1 }));
    await assertFails(setDoc(doc(client, 'appointments/booking-underpriced'), appointment('client-a', 'client-a', { servicePriceXaf: 1 })));
    await assertSucceeds(updateDoc(doc(client, 'appointments/booking-a'), {
      startsAt: Timestamp.fromDate(new Date('2026-11-29T10:00:00+01:00')),
      endsAt: Timestamp.fromDate(new Date('2026-11-29T12:00:00+01:00')),
      status: 'requested', rescheduledFrom: now, rescheduledAt: now, updatedAt: now,
    }));
  });

  it('empêche un client de consulter ou modifier le rendez-vous d’un autre artiste', async () => {
    await seed([
      { path: 'services/mixage', value: service() },
      { path: 'appointments/booking-b', value: appointment('client-b', 'manager-a', { producerUid: 'producer-a' }) },
    ]);
    const client = testEnv.authenticatedContext('client-a', { role: 'client' }).firestore();
    await assertFails(getDoc(doc(client, 'appointments/booking-b')));
    await assertFails(updateDoc(doc(client, 'appointments/booking-b'), { status: 'cancelled' }));
  });

  it('interdit les écritures client dans les registres financiers et les paramètres', async () => {
    const client = testEnv.authenticatedContext('client-a', { role: 'client' }).firestore();
    await assertFails(setDoc(doc(client, 'payments/fake'), { ownerUid: 'client-a', amountXaf: 1, status: 'approved' }));
    await assertFails(setDoc(doc(client, 'paymentReceipts/fake'), { ownerUid: 'client-a', amountXaf: 1 }));
    await assertFails(setDoc(doc(client, 'commissionEntries/fake'), { beneficiaryUid: 'client-a', amountXaf: 999999 }));
    await assertFails(setDoc(doc(client, 'allocationBalances/fake'), { managerShareXaf: 999999 }));
    await assertFails(setDoc(doc(client, 'paymentAttempts/fake'), { amountXaf: 1, status: 'SUCCESSFUL' }));
    await assertFails(setDoc(doc(client, 'settings/commissionRates'), { studio: { manager: 0, producer: 0, reserve: 100 } }));
    await assertFails(setDoc(doc(client, 'settings/bookingPolicy'), { defaultDepositPercent: 0 }));
  });

  it('permet au client de soumettre une déclaration de paiement en attente, jamais validée', async () => {
    const client = testEnv.authenticatedContext('client-a', { role: 'client' }).firestore();
    await assertSucceeds(setDoc(doc(client, 'paymentSubmissions/claim-a'), {
      ownerUid: 'client-a', amountXaf: 10000, method: 'cash', reference: 'REF-01',
      splitType: 'studio', status: 'pending', createdAt: now,
    }));
    await assertSucceeds(getDoc(doc(client, 'paymentSubmissions/claim-a')));
    await assertFails(updateDoc(doc(client, 'paymentSubmissions/claim-a'), { status: 'approved' }));
  });

  it('permet au producteur de gérer les services, les rendez-vous qui lui sont affectés et ses commissions', async () => {
    await seed([
      { path: 'services/mixage', value: service() },
      { path: 'appointments/producer-booking', value: appointment('client-a', 'manager-a', { producerUid: 'producer-a' }) },
      { path: 'commissionEntries/own', value: { beneficiaryRole: 'producer', beneficiaryUid: 'producer-a', amountXaf: 5000, status: 'due' } },
      { path: 'commissionEntries/other', value: { beneficiaryRole: 'producer', beneficiaryUid: 'producer-b', amountXaf: 5000, status: 'due' } },
    ]);
    const producer = testEnv.authenticatedContext('producer-a', { role: 'producer' }).firestore();
    await assertSucceeds(updateDoc(doc(producer, 'services/mixage'), { priceXaf: 25000 }));
    await assertSucceeds(updateDoc(doc(producer, 'appointments/producer-booking'), { status: 'confirmed', updatedAt: now }));
    await assertSucceeds(getDoc(doc(producer, 'commissionEntries/own')));
    await assertFails(getDoc(doc(producer, 'commissionEntries/other')));
    await assertSucceeds(updateDoc(doc(producer, 'commissionEntries/own'), { status: 'paid', paidAt: now, paidBy: 'producer-a' }));
    await assertFails(setDoc(doc(producer, 'settings/commissionRates'), { studio: { manager: 25, producer: 50, reserve: 25 } }));
  });

  it('réserve les taux financiers au manager et autorise les réglages de réservation à l’équipe', async () => {
    const manager = testEnv.authenticatedContext('manager-a', { role: 'manager' }).firestore();
    const producer = testEnv.authenticatedContext('producer-a', { role: 'producer' }).firestore();
    await assertSucceeds(setDoc(doc(manager, 'settings/commissionRates'), {
      version: 'v1', studio: { manager: 25, producer: 50, reserve: 25 },
      distribution: { manager: 70, producer: 20, reserve: 10 },
    }));
    await assertSucceeds(setDoc(doc(manager, 'services/new'), service()));
    await assertSucceeds(setDoc(doc(manager, 'settings/bookingPolicy'), { defaultDepositPercent: 50 }));
    await assertSucceeds(setDoc(doc(producer, 'settings/bookingPolicy'), { defaultDepositPercent: 40 }));
    await assertFails(setDoc(doc(producer, 'settings/commissionRates'), {
      version: 'v2', studio: { manager: 0, producer: 0, reserve: 100 },
    }));
  });

  it('permet aux utilisateurs de lire leurs notifications et seulement de les marquer comme lues', async () => {
    await seed([{ path: 'notifications/notice-a', value: {
      recipientUid: 'client-a', title: 'Rendez-vous', message: 'Confirmé', kind: 'appointment_confirmed',
      createdAt: now, readAt: null,
    } }]);
    const client = testEnv.authenticatedContext('client-a', { role: 'client' }).firestore();
    await assertSucceeds(getDoc(doc(client, 'notifications/notice-a')));
    await assertSucceeds(updateDoc(doc(client, 'notifications/notice-a'), { readAt: now }));
    await assertFails(updateDoc(doc(client, 'notifications/notice-a'), { message: 'Faux paiement validé' }));
  });
});
