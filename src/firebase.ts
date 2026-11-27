import { getApp, getApps, initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { getAuth, type Auth } from 'firebase/auth';
import {
  clearIndexedDbPersistence, getFirestore, initializeFirestore, memoryLocalCache,
  persistentLocalCache, persistentMultipleTabManager, terminate,
  type Firestore,
} from 'firebase/firestore';

// Firebase Web config is public by design. Runtime environment variables can
// override these defaults for Preview/Production environments.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAIQTOkeokhaP3ycwhyfuFM8twIuNHnLNc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'music-house-bta.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'music-house-bta',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'music-house-bta.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '995635011204',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:995635011204:web:888b607016de7628342cd1',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-5JMCBBRKX2',
};

export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.storageBucket
  && config.messagingSenderId && config.appId,
);

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

// Analytics is optional (for example, it may be unsupported in a browser privacy mode).
export const analytics: Promise<Analytics | null> = app && typeof window !== 'undefined'
  ? isSupported().then((supported) => supported ? getAnalytics(app!) : null).catch((error) => {
      console.info('Firebase Analytics is unavailable in this browser:', error);
      return null;
    })
  : Promise.resolve(null);

export const auth = authInstance;
export const db = dbInstance;

export async function clearLocalFirestoreCache(): Promise<void> {
  if (!db) throw new Error('Firebase n’est pas configuré.');
  await terminate(db);
  await clearIndexedDbPersistence(db);
  window.location.reload();
}

export function requireFirebase(): { auth: Auth; db: Firestore } {
  if (!auth || !db) throw new Error('Firebase n’est pas configuré. Vérifiez la configuration Firebase puis rechargez la page.');
  return { auth, db };
}
