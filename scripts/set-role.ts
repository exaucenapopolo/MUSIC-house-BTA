import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const [emailArg, roleArg] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
const role = roleArg?.trim();

if (!email || !['manager', 'producer', 'client'].includes(role || '')) {
  console.error('Usage: npm run set:role -- <email> <manager|producer|client>');
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
if (!projectId) {
  console.error('FIREBASE_PROJECT_ID (ou GOOGLE_CLOUD_PROJECT) est requis.');
  process.exit(1);
}

async function main() {
  const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const user = await auth.getUserByEmail(email!);
  const claims = { ...user.customClaims };
  if (role === 'client') delete claims.role;
  else claims.role = role;
  await auth.setCustomUserClaims(user.uid, claims);
  const profileRef = db.collection('users').doc(user.uid);
  const profileSnapshot = await profileRef.get();
  await profileRef.set({
    uid: user.uid,
    email: user.email || email,
    displayName: user.displayName || email,
    role,
    active: true,
    ...(!profileSnapshot.exists || !profileSnapshot.get('createdAt') ? { createdAt: FieldValue.serverTimestamp() } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`Rôle « ${role} » attribué à ${email} (UID ${user.uid}).`);
  console.log('L’utilisateur doit se déconnecter/reconnecter ou actualiser son jeton ID pour recevoir le nouveau rôle.');
}

main().catch((error: unknown) => {
  console.error('Échec de l’attribution du rôle :', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
