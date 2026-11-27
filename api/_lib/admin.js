import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY est absente de la configuration serveur.');
  try {
    return JSON.parse(raw.replace(/\\n/g, '\n'));
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY doit contenir le JSON complet du compte de service Firebase.');
  }
}

export function getAdminServices() {
  let app = getApps()[0];
  if (!app) {
    const serviceAccount = getServiceAccount();
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id || 'music-house-bta',
    });
  }
  return { auth: getAuth(app), db: getFirestore(app), FieldValue };
}
