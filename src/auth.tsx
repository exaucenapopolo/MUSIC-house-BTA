import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword, GoogleAuthProvider, onIdTokenChanged, sendEmailVerification,
  sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut,
  updateProfile, type User,
} from 'firebase/auth';
import { clearIndexedDbPersistence, doc, getDoc, serverTimestamp, setDoc, terminate, writeBatch } from 'firebase/firestore';
import type { Role, UserProfile } from './domain';
import { auth, db, firebaseConfigured, requireFirebase } from './firebase';
import { notifyStudioEmail } from './studioApi';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (name: string, email: string, password: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true, error: null });

  useEffect(() => {
    if (!firebaseConfigured || !auth || !db) {
      setState({ user: null, profile: null, loading: false, error: null });
      return;
    }
    const firebaseAuth = auth;
    const firestore = db;
    return onIdTokenChanged(firebaseAuth, async (user) => {
      if (!user) {
        setState({ user: null, profile: null, loading: false, error: null });
        return;
      }
      try {
        let token = await user.getIdTokenResult();
        const isPrimaryManager = String(user.email || '').trim().toLowerCase() === 'exaucenapopolo2@gmail.com';
        const userRef = doc(firestore, 'users', user.uid);
        const existingProfile = await getDoc(userRef);

        // Reconcile this one explicitly authorized account with Firebase Admin.
        // Never silently downgrade the studio owner to a client when provisioning fails.
        if (isPrimaryManager && (token.claims.role !== 'manager' || !existingProfile.exists() || existingProfile.data().active !== true)) {
          const response = await fetch('/api/studio', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + await user.getIdToken(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'bootstrapManager' }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.success) {
            throw new Error(payload.error || 'Le rôle manager ne peut pas être initialisé. Vérifiez la vérification de l’adresse et la configuration Firebase Admin dans Vercel.');
          }
          token = await user.getIdTokenResult(true);
          if (token.claims.role !== 'manager') {
            throw new Error('Firebase n’a pas confirmé le rôle manager. Déconnectez-vous puis reconnectez-vous après vérification de la configuration.');
          }
        }
        const userDoc = await getDoc(userRef);
        if (isPrimaryManager && token.claims.role !== 'manager') {
          throw new Error('Cette adresse est réservée au manager principal, mais son rôle administratif n’a pas été confirmé. Aucun accès artiste ne sera affiché.');
        }
        const claimRole = token.claims.role;
        const profileData = userDoc.exists() ? userDoc.data() : {};
        const role: Role = claimRole === 'manager' || claimRole === 'producer' ? claimRole : 'client';
        const profile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || String(profileData.displayName || ''),
          role,
          active: userDoc.exists() && profileData.active === true,
          photoURL: String(profileData.photoURL || user.photoURL || '') || undefined,
          artistId: typeof profileData.artistId === 'string' ? profileData.artistId : undefined,
          createdAt: profileData.createdAt,
        };
        // The registration flow or the trusted Admin SDK role script creates user profiles.
        // Never create them from this listener: it can race with register() and overwrite metadata.
        setState({ user, profile, loading: false, error: null });
      } catch (error) {
        setState({ user, profile: null, loading: false, error: error instanceof Error ? error.message : 'Impossible de charger le profil.' });
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    login: async (email, password) => {
      const { auth: firebaseAuth } = requireFirebase();
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    },
    register: async (name, email, password, phone) => {
      const { auth: firebaseAuth, db: firestore } = requireFirebase();
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await updateProfile(credential.user, { displayName: name.trim() });
      const userRef = doc(firestore, 'users', credential.user.uid);
      const artistRef = doc(firestore, 'artists', credential.user.uid);
      const batch = writeBatch(firestore);
      batch.set(userRef, {
        uid: credential.user.uid, email: email.trim(), displayName: name.trim(), photoURL: credential.user.photoURL || '',
        role: 'client', active: true, artistId: credential.user.uid, createdAt: serverTimestamp(),
      });
      batch.set(artistRef, {
        ownerUid: credential.user.uid, fullName: name.trim(), email: email.trim(), phone: phone.trim(), photoURL: credential.user.photoURL || '',
        status: 'active', source: 'site', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        termsVersion: 'V1', termsAcceptedAt: serverTimestamp(),
      });
      await batch.commit();
      setState({
        user: credential.user,
        profile: { uid: credential.user.uid, email: email.trim(), displayName: name.trim(), role: 'client', active: true, photoURL: credential.user.photoURL || undefined, artistId: credential.user.uid },
        loading: false, error: null,
      });
      try { await sendEmailVerification(credential.user); } catch (error) { console.warn('Verification e-mail:', error); }
      await notifyStudioEmail('welcome');
    },
    loginWithGoogle: async () => {
      const { auth: firebaseAuth, db: firestore } = requireFirebase();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(firebaseAuth, provider);
      const account = credential.user;
      const managerCandidate = String(account.email || '').trim().toLowerCase() === 'exaucenapopolo2@gmail.com';
      let token = await account.getIdTokenResult();
      const userRef = doc(firestore, 'users', account.uid);
      const existingProfile = await getDoc(userRef);
      if (managerCandidate && (token.claims.role !== 'manager' || !existingProfile.exists() || existingProfile.data().active !== true)) {
        const response = await fetch('/api/studio', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + await account.getIdToken(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'bootstrapManager' }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Le rôle manager ne peut pas être initialisé. Vérifiez la vérification de l’adresse et la configuration Firebase Admin dans Vercel.');
        }
        token = await account.getIdTokenResult(true);
        if (token.claims.role !== 'manager') throw new Error('Le serveur Firebase n’a pas confirmé le rôle manager.');
      }
      const snapshot = await getDoc(userRef);
      const role: Role = token.claims.role === 'manager' || token.claims.role === 'producer' ? token.claims.role : 'client';
      if (!snapshot.exists() && !managerCandidate) {
        const name = account.displayName || (account.email || '').split('@')[0] || 'Artiste';
        const batch = writeBatch(firestore);
        batch.set(userRef, {
          uid: account.uid, email: account.email || '', displayName: name, role, active: true,
          artistId: role === 'client' ? account.uid : null, photoURL: account.photoURL || '',
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        if (role === 'client') batch.set(doc(firestore, 'artists', account.uid), {
          ownerUid: account.uid, fullName: name, email: account.email || '', phone: '',
          photoURL: account.photoURL || '', status: 'active', source: 'site',
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(), termsVersion: 'V1', termsAcceptedAt: serverTimestamp(),
        });
        await batch.commit();
        await notifyStudioEmail('welcome');
      } else if (!managerCandidate && role === 'client') {
        const artistRef = doc(firestore, 'artists', account.uid);
        const artistSnapshot = await getDoc(artistRef);
        if (!artistSnapshot.exists()) {
          await setDoc(artistRef, {
            ownerUid: account.uid, fullName: account.displayName || 'Artiste', email: account.email || '',
            phone: '', photoURL: account.photoURL || '', status: 'active', source: 'site',
            createdAt: serverTimestamp(), updatedAt: serverTimestamp(), termsVersion: 'V1', termsAcceptedAt: serverTimestamp(),
          });
        }
      }
      const latest = await getDoc(userRef);
      const data = latest.exists() ? latest.data() : {};
      setState({
        user: account,
        profile: {
          uid: account.uid, email: account.email || '', displayName: account.displayName || String(data.displayName || ''),
          role, active: managerCandidate || data.active === true,
          photoURL: String(data.photoURL || account.photoURL || '') || undefined,
          artistId: typeof data.artistId === 'string' ? data.artistId : (role === 'client' ? account.uid : undefined),
          createdAt: data.createdAt,
        },
        loading: false, error: null,
      });
    },
    logout: async () => {
      const { auth: firebaseAuth, db: firestore } = requireFirebase();
      const trustedDevice = typeof localStorage !== 'undefined' && localStorage.getItem('mhb_trusted_device') === 'yes';
      if (trustedDevice && !navigator.onLine) {
        throw new Error('Reconnectez-vous avant de vous déconnecter : les modifications hors connexion doivent être synchronisées avant l’effacement du cache.');
      }
      await signOut(firebaseAuth);
      if (typeof localStorage !== 'undefined') {
        for (const key of Object.keys(localStorage)) if (key.startsWith('mhb_draft_')) localStorage.removeItem(key);
      }
      if (trustedDevice) {
        try { await terminate(firestore); await clearIndexedDbPersistence(firestore); }
        catch (error) { console.warn('Le cache Firestore n’a pas pu être effacé automatiquement :', error); }
        window.location.reload();
      }
    },
    resetPassword: async (email) => {
      const { auth: firebaseAuth } = requireFirebase();
      await sendPasswordResetEmail(firebaseAuth, email.trim());
    },
    refreshRole: async () => {
      if (!state.user) return;
      await state.user.getIdToken(true);
    },
  }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider.');
  return context;
}
