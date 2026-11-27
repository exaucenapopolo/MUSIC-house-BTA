import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, doc, getDoc, getDocs, query, setDoc, updateDoc, writeBatch,
  Timestamp, where,
} from 'firebase/firestore';

let testEnv: RulesTestEnvironment;
const projectId = 'demo-music-house-bta';

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
    for (const item of data) await setDoc(doc(db, item.path), item.value);
  });
}

describe('isolation des rôles Firestore', () => {
  it('isole les fiches artistes des clients et refuse l’élévation de rôle', async () => {
    await seed([
      { path: 'users/client-a', value: { uid: 'client-a', role: 'client', active: true } },
      { path: 'users/client-b', value: { uid: 'client-b', role: 'client', active: true } },
      { path: 'artists/artist-a', value: { ownerUid: 'client-a', fullName: 'Artiste A' } },
      { path: 'artists/artist-b', value: { ownerUid: 'client-b', fullName: 'Artiste B' } },
    ]);
    const client = testEnv.authenticatedContext('client-a', { role: 'client' }).firestore();
    await assertSucceeds(getDoc(doc(client, 'artists/artist-a')));
    await assertFails(getDoc(doc(client, 'artists/artist-b')));
    await assertFails(getDocs(collection(client, 'users')));
    await assertFails(setDoc(doc(client, 'users/client-a'), {
      uid: 'client-a', role: 'manager', active: true, email: 'a@example.test', displayName: 'A',
    }));
  });

  it('autorise la création atomique du compte client et de sa fiche artiste', async () => {
    const client = testEnv.authenticatedContext('new-client', { role: 'client' }).firestore();
    const batch = writeBatch(client);
    batch.set(doc(client, 'users/new-client'), {
      uid: 'new-client', email: 'new@example.test', displayName: 'Nouvel artiste',
      role: 'client', active: true, artistId: 'new-client', createdAt: Timestamp.now(),
    });
    batch.set(doc(client, 'artists/new-client'), {
      ownerUid: 'new-client', fullName: 'Nouvel artiste', email: 'new@example.test',
      phone: '+237600000000', status: 'active', source: 'site',
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
      termsVersion: 'V1', termsAcceptedAt: Timestamp.now(),
    });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(client, 'artists/new-client')));
  });

  it('permet au producteur de lire uniquement ses artistes affectés et ses commissions', async () => {
    await seed([
      { path: 'users/producer-a', value: { uid: 'producer-a', role: 'producer', active: true } },
      { path: 'users/producer-b', value: { uid: 'producer-b', role: 'producer', active: true } },
      { path: 'artists/artist-assigned', value: { ownerUid: 'client-a', producerUids: ['producer-a'], fullName: 'A' } },
      { path: 'artists/artist-other', value: { ownerUid: 'client-b', producerUids: ['producer-b'], fullName: 'B' } },
      { path: 'commissionEntries/commission-a', value: { beneficiaryRole: 'producer', beneficiaryUid: 'producer-a', amountXaf: 1200 } },
      { path: 'commissionEntries/commission-b', value: { beneficiaryRole: 'producer', beneficiaryUid: 'producer-b', amountXaf: 2300 } },
    ]);
    const producer = testEnv.authenticatedContext('producer-a', { role: 'producer' }).firestore();
    await assertSucceeds(getDoc(doc(producer, 'artists/artist-assigned')));
    await assertFails(getDoc(doc(producer, 'artists/artist-other')));
    await assertSucceeds(getDocs(query(collection(producer, 'artists'), where('producerUids', 'array-contains', 'producer-a'))));
    await assertSucceeds(getDoc(doc(producer, 'commissionEntries/commission-a')));
    await assertFails(getDoc(doc(producer, 'commissionEntries/commission-b')));
  });

  it('empêche un client de créer des paiements validés ou des commissions', async () => {
    await seed([
      { path: 'users/client-a', value: { uid: 'client-a', role: 'client', active: true } },
      { path: 'users/client-b', value: { uid: 'client-b', role: 'client', active: true } },
      { path: 'paymentReceipts/receipt-b', value: { ownerUid: 'client-b', amountXaf: 4000, status: 'approved' } },
      { path: 'allocationBalances/project:private:studio__v1', value: { allocationKey: 'project:private:studio', rateVersion: 'v1', shareableBaseXaf: 12000 } },
    ]);
    const client = testEnv.authenticatedContext('client-a', { role: 'client' }).firestore();
    await assertSucceeds(setDoc(doc(client, 'paymentSubmissions/submission-a'), {
      ownerUid: 'client-a', amountXaf: 4000, method: 'cash', reference: '', splitType: 'studio', status: 'pending', createdAt: Timestamp.now(),
    }));
    await assertFails(getDoc(doc(client, 'paymentReceipts/receipt-b')));
    await assertFails(getDoc(doc(client, 'allocationBalances/project:private:studio__v1')));
    await assertFails(setDoc(doc(client, 'payments/payment-forged'), { ownerUid: 'client-a', amountXaf: 4000, status: 'approved' }));
    await assertFails(setDoc(doc(client, 'commissionEntries/commission-forged'), { beneficiaryRole: 'producer', amountXaf: 1000 }));
  });

  it('bloque un compte désactivé même si son jeton indique client', async () => {
    await seed([
      { path: 'users/client-inactive', value: { uid: 'client-inactive', role: 'client', active: false } },
      { path: 'artists/artist-private', value: { ownerUid: 'client-inactive', fullName: 'Privé' } },
      { path: 'services/service-public', value: { name: 'Session', isActive: true } },
    ]);
    const inactive = testEnv.authenticatedContext('client-inactive', { role: 'client' }).firestore();
    await assertFails(getDoc(doc(inactive, 'artists/artist-private')));
    await assertFails(getDocs(collection(inactive, 'services')));
  });

  it('exige les deux co-signatures pour approuver une dépense exceptionnelle', async () => {
    await seed([
      { path: 'users/manager-a', value: { uid: 'manager-a', role: 'manager', active: true } },
      { path: 'users/producer-a', value: { uid: 'producer-a', role: 'producer', active: true } },
      { path: 'expenses/expense-1', value: {
        label: 'Location exceptionnelle', amountXaf: 50000, status: 'joint_required', jointApprovalRequired: true,
        submittedBy: 'manager-a', managerApprovedBy: null, producerApprovedBy: null,
        managerApprovedAt: null, producerApprovedAt: null,
      },
    }]);
    const manager = testEnv.authenticatedContext('manager-a', { role: 'manager' }).firestore();
    const producer = testEnv.authenticatedContext('producer-a', { role: 'producer' }).firestore();
    const managerTime = Timestamp.fromDate(new Date('2026-01-01T10:00:00Z'));
    const producerTime = Timestamp.fromDate(new Date('2026-01-01T10:01:00Z'));

    await assertSucceeds(getDocs(query(collection(producer, 'expenses'), where('jointApprovalRequired', '==', true))));
    await assertSucceeds(updateDoc(doc(manager, 'expenses/expense-1'), {
      managerApprovedBy: 'manager-a', managerApprovedAt: managerTime,
      status: 'joint_required', reviewedBy: 'manager-a', reviewedAt: managerTime,
    }));
    await assertSucceeds(updateDoc(doc(producer, 'expenses/expense-1'), {
      producerApprovedBy: 'producer-a', producerApprovedAt: producerTime,
      managerApprovedBy: 'manager-a', managerApprovedAt: managerTime,
      status: 'approved', reviewedBy: 'producer-a', reviewedAt: producerTime,
    }));
    await assertFails(updateDoc(doc(producer, 'expenses/expense-1'), {
      producerApprovedBy: 'producer-a', producerApprovedAt: producerTime,
      managerApprovedBy: 'manager-a', managerApprovedAt: managerTime,
      status: 'approved', reviewedBy: 'producer-a', reviewedAt: producerTime,
    }));
    await assertSucceeds(updateDoc(doc(manager, 'expenses/expense-1'), {
      status: 'paid', reviewedBy: 'manager-a', reviewedAt: producerTime,
    }));
  });
});
