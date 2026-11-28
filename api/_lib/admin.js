import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

/**
 * Parse the service-account JSON exactly as stored in Vercel.
 * JSON.parse must run BEFORE normalizing escaped newlines in private_key.
 */
export function parseServiceAccountJson(rawValue, variableName = 'FIREBASE_SERVICE_ACCOUNT_KEY') {
  let raw = String(rawValue || '').trim();
  if (!raw) {
    throw new Error(variableName + ' est vide. Ajoutez le JSON complet du compte de service Firebase dans les variables Vercel.');
  }
  const assignment = raw.match(/^FIREBASE_SERVICE_ACCOUNT(?:_KEY)?\s*=\s*([\s\S]+)$/i);
  if (assignment) raw = assignment[1].trim();

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error(variableName + ' contient un JSON invalide. Collez le JSON complet et conservez les séquences \\n de private_key.');
  }
  if (!serviceAccount || typeof serviceAccount !== 'object' || Array.isArray(serviceAccount)) {
    throw new Error(variableName + ' doit contenir un objet JSON de compte de service.');
  }
  if (serviceAccount.type !== 'service_account'
      || !serviceAccount.project_id
      || !serviceAccount.client_email
      || !serviceAccount.private_key) {
    throw new Error(variableName + ' doit contenir les champs type, project_id, client_email et private_key du compte de service.');
  }

  serviceAccount.private_key = String(serviceAccount.private_key)
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();

  if (!serviceAccount.private_key.includes('-----BEGIN PRIVATE KEY-----')
      || !serviceAccount.private_key.includes('-----END PRIVATE KEY-----')) {
    throw new Error(variableName + ' contient une clé privée incomplète ou mal formatée. Générez une nouvelle clé JSON depuis le compte de service Firebase.');
  }
  return serviceAccount;
}

export function getServiceAccountFromEnv(env = process.env) {
  const primary = String(env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
  const legacy = String(env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  const raw = primary || legacy;
  const variableName = primary ? 'FIREBASE_SERVICE_ACCOUNT_KEY' : 'FIREBASE_SERVICE_ACCOUNT';
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY ou FIREBASE_SERVICE_ACCOUNT doit contenir le JSON complet du compte de service Firebase.');
  }

  const serviceAccount = parseServiceAccountJson(raw, variableName);
  const expectedProjectId = String(env.FIREBASE_PROJECT_ID || serviceAccount.project_id || 'music-house-bta').trim();
  if (serviceAccount.project_id !== expectedProjectId) {
    throw new Error('Le compte de service Firebase configuré appartient au projet "' + serviceAccount.project_id
      + '" alors que FIREBASE_PROJECT_ID indique "' + expectedProjectId + '". Utilisez une clé du projet MUSIC HOUSE BTA.');
  }
  return serviceAccount;
}

export function getAdminServices() {
  let app = getApps()[0];
  if (!app) {
    const serviceAccount = getServiceAccountFromEnv();
    app = initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id || 'music-house-bta',
    });
  }
  return { auth: getAuth(app), db: getFirestore(app), FieldValue };
}
