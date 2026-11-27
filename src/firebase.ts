import { getApp, getApps, initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  clearIndexedDbPersistence, getFirestore, initializeFirestore, memoryLocalCache,
  persistentLocalCache, persistentMultipleTabManager, terminate,
  type Firestore,
} from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Object.values(config).every((value) => Boolean(value));
let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (firebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(config);
  authInstance = getAuth(app);
  try {
    const trustedDevice = typeof localStorage !== 'undefined' && localStorage.getItem('mhb_trusted_device') === 'yes';
    dbInstance = initializeFirestore(app, {
      localCache: trustedDevice
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : memoryLocalCache(),
    });
  } catch (error) {
    // Firestore may already have been initialized by hot reload or another module.
    console.warn('Firestore cache initialization fallback:', error);
    dbInstance = getFirestore(app);
  }
}

export const auth = authInstance;
export const db = dbInstance;

export async function clearLocalFirestoreCache(): Promise<void> {
  if (!db) throw new Error('Firebase n’est pas configuré.');
  await terminate(db);
  await clearIndexedDbPersistence(db);
  window.location.reload();
}

export function requireFirebase(): { auth: Auth; db: Firestore } {
  if (!auth || !db) throw new Error('Firebase n’est pas configuré. Renseignez les variables VITE_FIREBASE_* puis rechargez la page.');
  return { auth, db };
}
