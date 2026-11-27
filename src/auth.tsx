import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword, onIdTokenChanged, sendEmailVerification,
  sendPasswordResetEmail, signInWithEmailAndPassword, signOut,
  updateProfile, type User,
} from 'firebase/auth';
import { clearIndexedDbPersistence, doc, getDoc, serverTimestamp, terminate, writeBatch } from 'firebase/firestore';
import type { Role, UserProfile } from './domain';
import { auth, db, firebaseConfigured, requireFirebase } from './firebase';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
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
    return onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, profile: null, loading: false, error: null });
        return;
      }
      try {
        const [token, userDoc] = await Promise.all([
          user.getIdTokenResult(), getDoc(doc(db, 'users', user.uid)),
        ]);
        const claimRole = token.claims.role;
        const profileData = userDoc.exists() ? userDoc.data() : {};
        const role: Role = claimRole === 'manager' || claimRole === 'producer' ? claimRole : 'client';
        const profile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || String(profileData.displayName || ''),
          role,
          active: userDoc.exists() && profileData.active === true,
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
        uid: credential.user.uid, email: email.trim(), displayName: name.trim(),
        role: 'client', active: true, artistId: credential.user.uid, createdAt: serverTimestamp(),
      });
      batch.set(artistRef, {
        ownerUid: credential.user.uid, fullName: name.trim(), email: email.trim(), phone: phone.trim(),
        status: 'active', source: 'site', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        termsVersion: 'V1', termsAcceptedAt: serverTimestamp(),
      });
      await batch.commit();
      setState({
        user: credential.user,
        profile: { uid: credential.user.uid, email: email.trim(), displayName: name.trim(), role: 'client', active: true, artistId: credential.user.uid },
        loading: false, error: null,
      });
      try { await sendEmailVerification(credential.user); } catch (error) { console.warn('Verification e-mail:', error); }
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
