import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, doc, getDoc, getDocs, setDoc, writeBatch, Timestamp,
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

describe('règles Firestore temporaires — accès réservé aux comptes connectés', () => {
  it('refuse toute lecture et écriture à un visiteur non connecté', async () => {
    const guest = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(guest, 'settings/general')));
    await assertFails(setDoc(doc(guest, 'users/anonymous'), {
      uid: 'anonymous', role: 'client', active: true,
    }));
  });

  it('permet à un nouvel utilisateur de créer son compte et sa fiche artiste dans un batch', async () => {
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
    await assertSucceeds(getDoc(doc(client, 'users/new-client')));
    await assertSucceeds(getDoc(doc(client, 'artists/new-client')));
  });

  it('permet à un compte connecté de consulter et modifier les collections utilisées par l’application', async () => {
    const client = testEnv.authenticatedContext('client-a', { role: 'client' }).firestore();
    await assertSucceeds(setDoc(doc(client, 'projects/project-a'), {
      title: 'Premier single', ownerUid: 'client-a', clientVisible: true,
    }));
    await assertSucceeds(setDoc(doc(client, 'payments/payment-a'), {
      amountXaf: 15000, status: 'approved', ownerUid: 'client-a',
    }));
    await assertSucceeds(setDoc(doc(client, 'settings/general'), { studioName: 'MUSIC HOUSE BTA' }));
    await assertSucceeds(getDoc(doc(client, 'payments/payment-a')));
    await assertSucceeds(getDocs(collection(client, 'projects')));
    await assertSucceeds(setDoc(doc(client, 'projects/project-a/internalNotes/note-a'), {
      text: 'Note de développement', authorUid: 'client-a',
    }));
  });

  it('autorise les trois types de comptes connectés pendant la phase de test', async () => {
    for (const role of ['client', 'producer', 'manager'] as const) {
      const db = testEnv.authenticatedContext(`user-${role}`, { role }).firestore();
      await assertSucceeds(setDoc(doc(db, `users/user-${role}`), {
        uid: `user-${role}`, role, active: true, createdAt: Timestamp.now(),
      }));
      await assertSucceeds(getDoc(doc(db, `users/user-${role}`)));
    }
  });
});
