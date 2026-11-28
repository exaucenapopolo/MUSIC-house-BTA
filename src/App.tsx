import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { ArrowLeft, AudioLines, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useAuth } from './auth';
import { callPaymentApi } from './paymentApi';
import { firebaseConfigured } from './firebase';
import Workspace from './Workspace';

function AuthFrame({ children }: { children: ReactNode }) {
  return <div className="auth-layout">
    <aside className="auth-art">
      <div className="auth-brand"><span className="brand-mark"><AudioLines size={22} /></span><span>MUSIC HOUSE <b>BTA</b></span></div>
      <div className="auth-quote">
        <span className="eyebrow">YOUNG FOREVER RECORDS</span>
        <h1>Donnez vie à votre <em>son.</em></h1>
        <p>Un espace unique pour accompagner chaque artiste, de la première séance à la livraison du projet.</p>
      </div>
      <div className="auth-footer">Studio management · Yaoundé, Cameroun</div>
      <div className="sound-wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
    </aside>
    <main className="auth-main">{children}</main>
  </div>;
}

function FirebaseNotice() {
  return <AuthFrame><div className="auth-card">
    <span className="eyebrow">CONFIGURATION REQUISE</span>
    <h2>Connectez votre projet Firebase</h2>
    <p className="muted">L’application est prête côté interface, mais elle ne peut pas s’authentifier tant que les variables Firebase ne sont pas renseignées.</p>
    <pre className="code-note">VITE_FIREBASE_API_KEY=…{ '\n' }VITE_FIREBASE_AUTH_DOMAIN=…{ '\n' }VITE_FIREBASE_PROJECT_ID=…{ '\n' }VITE_FIREBASE_STORAGE_BUCKET=…{ '\n' }VITE_FIREBASE_MESSAGING_SENDER_ID=…{ '\n' }VITE_FIREBASE_APP_ID=…</pre>
    <p className="small-note">Copiez <code>.env.example</code> vers <code>.env</code>, puis redémarrez le serveur.</p>
    <a className="text-link" href="https://console.firebase.google.com/" target="_blank" rel="noreferrer">Ouvrir la console Firebase ↗</a>
  </div></AuthFrame>;
}

function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [trustedDevice, setTrustedDevice] = useState(() => typeof localStorage !== 'undefined' && localStorage.getItem('mhb_trusted_device') === 'yes');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await login(email, password); navigate('/'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Connexion impossible.'); }
    finally { setBusy(false); }
  }
  return <AuthFrame><div className="auth-card">
    <Link to="/register" className="auth-top-link">Créer un compte artiste <ArrowLeft size={15} className="flip" /></Link>
    <span className="eyebrow">ESPACE SÉCURISÉ</span>
    <h2>Heureux de vous revoir.</h2>
    <p className="muted">Connectez-vous à votre espace MUSIC HOUSE BTA.</p>
    <form onSubmit={submit} className="form-stack">
      <label>Adresse e-mail<div className="input-icon"><Mail size={17} /><input type="email" required autoComplete="email" placeholder="nom@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div></label>
      <label>Mot de passe<div className="input-icon"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="Votre mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} /><button className="icon-button" type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Afficher le mot de passe">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
      <div className="form-between"><label className="trusted-choice"><input type="checkbox" checked={trustedDevice} onChange={(e) => { const next = e.target.checked; setTrustedDevice(next); if (next) localStorage.setItem('mhb_trusted_device', 'yes'); else localStorage.removeItem('mhb_trusted_device'); window.location.reload(); }} /><span>Appareil personnel / de confiance</span></label><Link to="/forgot-password" className="text-link">Mot de passe oublié ?</Link></div>
      <p className="small-note">Sur un appareil de confiance, le cache Firestore persistant permet de consulter les données déjà chargées hors connexion. Ne l’activez pas sur un ordinateur partagé.</p>
      {error && <div className="alert error">{error}</div>}
      <button className="button primary full" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'} <span>→</span></button>
    </form>
    <div className="auth-divider"><span>ou</span></div>
    <button className="button secondary full google-auth-button" type="button" disabled={busy} onClick={async () => {
      setBusy(true); setError('');
      try { await loginWithGoogle(); navigate('/'); }
      catch (e) { setError(e instanceof Error ? e.message : 'Connexion Google impossible.'); }
      finally { setBusy(false); }
    }}><span className="google-mark">G</span> Continuer avec Google</button>
    <div className="auth-bottom">Vous n’avez pas encore de compte ? <Link to="/register">Rejoindre le studio</Link></div>
  </div></AuthFrame>;
}

function RegisterPage() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await register(name, email, password, phone); navigate('/'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Inscription impossible.'); }
    finally { setBusy(false); }
  }
  return <AuthFrame><div className="auth-card">
    <Link to="/login" className="auth-top-link"><ArrowLeft size={15} /> Retour à la connexion</Link>
    <span className="eyebrow">NOUVEAU COMPTE ARTISTE</span>
    <h2>Commençons ensemble.</h2>
    <p className="muted">Créez votre espace personnel pour suivre vos séances et vos productions.</p>
    <form onSubmit={submit} className="form-stack">
      <label>Nom et prénom<div className="input-icon"><UserRound size={17} /><input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom complet" /></div></label>
      <label>Adresse e-mail<div className="input-icon"><Mail size={17} /><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@exemple.com" /></div></label>
      <label>Téléphone<div className="input-icon"><span className="prefix">+237</span><input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="6XX XX XX XX" /></div></label>
      <label>Mot de passe<div className="input-icon"><LockKeyhole size={17} /><input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 caractères minimum" /></div></label>
      <p className="small-note">En créant votre compte, vous acceptez les conditions d’utilisation et la politique de confidentialité du studio. La vérification de votre e-mail sera envoyée si Firebase le permet.</p>
      {error && <div className="alert error">{error}</div>}
      <button className="button primary full" disabled={busy}>{busy ? 'Création du compte…' : 'Créer mon compte'} <span>→</span></button>
    </form>
    <div className="auth-divider"><span>ou</span></div>
    <button className="button secondary full google-auth-button" type="button" disabled={busy} onClick={async () => {
      setBusy(true); setError('');
      try { await loginWithGoogle(); navigate('/'); }
      catch (e) { setError(e instanceof Error ? e.message : 'Inscription Google impossible.'); }
      finally { setBusy(false); }
    }}><span className="google-mark">G</span> S’inscrire avec Google</button>
  </div></AuthFrame>;
}

function ForgotPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { await resetPassword(email); setMessage('Si un compte correspond à cette adresse, un e-mail de réinitialisation vient d’être envoyé.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Demande impossible.'); }
    finally { setBusy(false); }
  }
  return <AuthFrame><div className="auth-card">
    <Link to="/login" className="auth-top-link"><ArrowLeft size={15} /> Retour à la connexion</Link>
    <span className="eyebrow">RÉCUPÉRATION DE COMPTE</span><h2>Mot de passe oublié ?</h2>
    <p className="muted">Indiquez votre adresse e-mail. Firebase vous enverra un lien de réinitialisation.</p>
    <form onSubmit={submit} className="form-stack">
      <label>Adresse e-mail<div className="input-icon"><Mail size={17} /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div></label>
      {message && <div className="alert success">{message}</div>}{error && <div className="alert error">{error}</div>}
      <button className="button primary full" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer le lien'}</button>
    </form>
  </div></AuthFrame>;
}

function PaymentReturnPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const attemptId = new URLSearchParams(window.location.search).get('attemptId') || '';
  const [status, setStatus] = useState<'checking' | 'CONFIRMED' | 'PENDING' | 'FAILED' | 'EXPIRED' | 'REVIEW_REQUIRED' | 'ERROR'>('checking');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function verify() {
    if (!attemptId) { setStatus('ERROR'); setError('La référence de paiement est absente. Ouvrez vos rendez-vous pour vérifier le règlement.'); return; }
    setBusy(true); setError(''); setStatus('checking');
    try {
      const result = await callPaymentApi('verify', { attemptId });
      const next = String(result.status || 'PENDING') as typeof status;
      setStatus(['CONFIRMED', 'PENDING', 'FAILED', 'EXPIRED', 'REVIEW_REQUIRED'].includes(next) ? next : 'PENDING');
    } catch (cause) {
      setStatus('ERROR');
      setError(cause instanceof Error ? cause.message : 'La vérification du paiement a échoué.');
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (user?.uid && attemptId) void verify();
    else if (user?.uid && !attemptId) { setStatus('ERROR'); setError('Référence de paiement manquante.'); }
  }, [user?.uid, attemptId]);

  const title = status === 'CONFIRMED' ? 'Paiement confirmé'
    : status === 'PENDING' || status === 'checking' ? 'Vérification en cours'
    : status === 'REVIEW_REQUIRED' ? 'Vérification manuelle nécessaire'
    : status === 'FAILED' ? 'Paiement non abouti'
    : status === 'EXPIRED' ? 'Session de paiement expirée' : 'Vérification impossible';
  const message = status === 'CONFIRMED' ? 'Fapshi a confirmé la transaction. Le paiement est ajouté à votre historique et votre acompte est pris en compte.'
    : status === 'PENDING' || status === 'checking' ? 'Le retour de Fapshi ne suffit pas à confirmer un paiement. Le studio attend le statut final transmis par le fournisseur.'
    : status === 'REVIEW_REQUIRED' ? 'La transaction est bien signalée comme réussie par Fapshi, mais son montant nécessite un contrôle du manager avant son intégration au registre.'
    : status === 'FAILED' ? 'Fapshi a indiqué que la transaction a échoué. Aucun acompte n’a été comptabilisé.'
    : status === 'EXPIRED' ? 'La session de paiement a expiré. Vous pouvez relancer le règlement depuis vos rendez-vous.'
    : error || 'La transaction n’a pas pu être vérifiée pour le moment.';
  return <div className="screen-loader"><div className="auth-card payment-return-card">
    <span className="eyebrow">MUSIC HOUSE BTA · FAPSHI</span>
    <h2>{title}</h2>
    <p className="muted">{message}</p>
    {status === 'ERROR' && error && <div className="alert error">{error}</div>}
    {status === 'CONFIRMED' && <div className="alert success">Votre paiement est enregistré.</div>}
    {(status === 'PENDING' || status === 'checking') && <p className="small-note">Ne payez pas une seconde fois tant que cette transaction n’a pas reçu son statut définitif.</p>}
    {status === 'REVIEW_REQUIRED' && <p className="small-note">Le montant n’a pas été ajouté au solde de votre réservation. Contactez le studio pour la régularisation.</p>}
    <button className="button primary full" type="button" onClick={() => void verify()} disabled={busy}>
      {busy ? 'Vérification…' : 'Vérifier à nouveau'}
    </button>
    <button className="button secondary full" type="button" onClick={() => navigate('/appointments')}>Retour à mes rendez-vous</button>
  </div></div>;
}

function Protected({ children }: { children: ReactNode }) {
  const { user, profile, loading, error, logout } = useAuth();
  if (loading) return <div className="screen-loader"><div className="loader-mark"><AudioLines /></div><p>Préparation de votre espace…</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (error || !profile) return <div className="screen-loader"><div className="alert error">{error || 'Profil utilisateur indisponible. Votre accès doit être initialisé par le studio.'}</div><button className="button" onClick={() => void logout()}>Se déconnecter</button></div>;
  if (!profile.active) return <div className="screen-loader"><div className="alert error">Ce compte est désactivé ou n’a pas encore été initialisé. Contactez le studio.</div><button className="button" onClick={() => void logout()}>Se déconnecter</button></div>;
  return <>{children}</>;
}

export default function App() {
  const { profile, loading } = useAuth();
  if (!firebaseConfigured) return <FirebaseNotice />;
  return <Routes>
    <Route path="/login" element={loading ? <div className="screen-loader">Chargement…</div> : profile ? <Navigate to="/" replace /> : <LoginPage />} />
    <Route path="/register" element={profile ? <Navigate to="/" replace /> : <RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPage />} />
    <Route path="/payment-return" element={<Protected><PaymentReturnPage /></Protected>} />
    <Route path="/*" element={<Protected><Workspace /></Protected>} />
  </Routes>;
}
