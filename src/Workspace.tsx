import { useEffect, useMemo, useState, type FormEvent, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, AlertCircle, Archive, ArrowDownRight, ArrowUpRight, AudioLines, Bell,
  CalendarDays, Check, CheckCircle2, CircleDollarSign, ClipboardList, Download,
  FileMusic, Filter, FolderKanban, Headphones, Home, LogOut, Menu, Music2, Plus,
  Radio, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, UserRound,
  Users, Wallet, WifiOff, X,
} from 'lucide-react';
import {
  addDoc, arrayUnion, collection, doc, orderBy, runTransaction, serverTimestamp, updateDoc, where, Timestamp, writeBatch,
} from 'firebase/firestore';
import type { QueryConstraint } from 'firebase/firestore';
import { useAuth } from './auth';
import { db, clearLocalFirestoreCache } from './firebase';
import { useLiveCollection } from './hooks';
import {
  DEFAULT_PROJECT_STEPS, ROLE_LABELS, formatDate, formatXaf,
  type Artist, type Appointment, type CommissionEntry, type Expense, type MusicProject,
  type NotificationItem, type Payment, type PaymentReceipt, type RateSet, type Service, type SplitType,
} from './domain';
import {
  cancelAppointment, confirmAppointment, buildAppointmentWindow, rescheduleAppointment, updateAppointmentProgress,
} from './booking';
import {
  createExpense, getRateSet, initializeBusinessSettings,
  markNotificationRead, recordValidatedPayment, reverseLatestPayment,
  submitPaymentClaim, updateBusinessRates,
} from './services';

 type SectionKey = 'dashboard' | 'artists' | 'appointments' | 'services' | 'projects' | 'payments' | 'expenses' | 'commissions' | 'distribution' | 'reports' | 'settings' | 'notifications' | 'profile' | 'calendar';
 type NavItem = { key: SectionKey; label: string; icon: typeof Home; group?: string };

const managerNav: NavItem[] = [
  { key: 'dashboard', label: 'Vue d’ensemble', icon: Home },
  { key: 'artists', label: 'Artistes & clients', icon: Users, group: 'STUDIO' },
  { key: 'appointments', label: 'Rendez-vous', icon: CalendarDays },
  { key: 'services', label: 'Prestations & tarifs', icon: SlidersHorizontal },
  { key: 'projects', label: 'Projets musicaux', icon: FolderKanban },
  { key: 'payments', label: 'Paiements', icon: CircleDollarSign, group: 'FINANCES' },
  { key: 'expenses', label: 'Dépenses', icon: ArrowDownRight },
  { key: 'commissions', label: 'Commissions & réserve', icon: Wallet },
  { key: 'distribution', label: 'Distribution', icon: Radio, group: 'ACTIVITÉ' },
  { key: 'reports', label: 'Rapports', icon: ClipboardList },
  { key: 'settings', label: 'Paramètres', icon: Settings, group: 'SYSTÈME' },
  { key: 'notifications', label: 'Notifications', icon: Bell },
];
const producerNav: NavItem[] = [
  { key: 'dashboard', label: 'Vue d’ensemble', icon: Home },
  { key: 'calendar', label: 'Mon calendrier', icon: CalendarDays, group: 'PRODUCTION' },
  { key: 'artists', label: 'Artistes concernés', icon: Users },
  { key: 'projects', label: 'Projets & productions', icon: FolderKanban },
  { key: 'appointments', label: 'Séances', icon: Headphones },
  { key: 'expenses', label: 'Dépenses à déclarer', icon: ArrowDownRight, group: 'SUIVI' },
  { key: 'commissions', label: 'Mon relevé', icon: Wallet },
  { key: 'notifications', label: 'Notifications', icon: Bell },
];
const clientNav: NavItem[] = [
  { key: 'dashboard', label: 'Mon accueil', icon: Home },
  { key: 'profile', label: 'Mon profil artistique', icon: UserRound, group: 'MON ESPACE' },
  { key: 'services', label: 'Prestations', icon: SlidersHorizontal },
  { key: 'appointments', label: 'Mes rendez-vous', icon: CalendarDays },
  { key: 'projects', label: 'Mes projets', icon: FolderKanban },
  { key: 'payments', label: 'Mes paiements', icon: CircleDollarSign, group: 'SUIVI' },
  { key: 'notifications', label: 'Notifications', icon: Bell },
];

function constraintsFor(role: string, uid: string, key: string): QueryConstraint[] {
  const createdDesc = orderBy('createdAt', 'desc');
  if (key === 'artists') return role === 'manager' ? [createdDesc] : role === 'producer' ? [where('producerUids', 'array-contains', uid), createdDesc] : [where('ownerUid', '==', uid), createdDesc];
  if (key === 'appointments') return role === 'manager' ? [orderBy('startsAt', 'asc')] : role === 'producer' ? [where('producerUid', '==', uid), orderBy('startsAt', 'asc')] : [where('ownerUid', '==', uid), orderBy('startsAt', 'asc')];
  if (key === 'services') return role === 'manager' ? [createdDesc] : [where('isActive', '==', true), orderBy('name', 'asc')];
  if (key === 'projects') return role === 'manager' ? [createdDesc] : role === 'producer' ? [where('producerUid', '==', uid), createdDesc] : [where('ownerUid', '==', uid), where('clientVisible', '==', true), createdDesc];
  if (key === 'payments') return role === 'manager' ? [createdDesc] : role === 'producer' ? [where('producerUid', '==', uid), createdDesc] : [where('ownerUid', '==', uid), createdDesc];
  if (key === 'paymentSubmissions') return role === 'manager' ? [where('status', '==', 'pending'), createdDesc] : role === 'client' ? [where('ownerUid', '==', uid), createdDesc] : [];
  if (key === 'expenses') return role === 'manager' ? [createdDesc] : role === 'producer' ? [where('submittedBy', '==', uid), createdDesc] : [];
  if (key === 'commissions') return role === 'manager' ? [createdDesc] : role === 'producer' ? [where('beneficiaryRole', '==', 'producer'), where('beneficiaryUid', '==', uid), createdDesc] : []; 
  if (key === 'distribution') return role === 'manager' ? [createdDesc] : role === 'client' ? [where('ownerUid', '==', uid), where('clientVisible', '==', true), createdDesc] : [];
  if (key === 'notifications') return [where('recipientUid', '==', uid), createdDesc];
  if (key === 'users') return role === 'manager' ? [createdDesc] : [];
  return [];
}

function useWorkspaceData(role: string, uid: string) {
  const constraints = (key: string) => constraintsFor(role, uid, key);
  const artists = useLiveCollection<Artist>('artists', useMemo(() => constraints('artists'), [role, uid]));
  const services = useLiveCollection<Service>('services', useMemo(() => constraints('services'), [role, uid]));
  const appointments = useLiveCollection<Appointment>('appointments', useMemo(() => constraints('appointments'), [role, uid]), 300);
  const projects = useLiveCollection<MusicProject>('projects', useMemo(() => constraints('projects'), [role, uid]), 300);
  const payments = useLiveCollection<Payment | PaymentReceipt>(role === 'client' ? 'paymentReceipts' : 'payments', useMemo(() => constraints('payments'), [role, uid]), 300);
  const submissions = useLiveCollection<any>(role === 'manager' || role === 'client' ? 'paymentSubmissions' : null, useMemo(() => constraints('paymentSubmissions'), [role, uid]));
  const expensesOwn = useLiveCollection<Expense>(role === 'client' ? null : 'expenses', useMemo(() => role === 'producer' ? [where('submittedBy', '==', uid), orderBy('createdAt', 'desc')] : role === 'manager' ? [orderBy('createdAt', 'desc')] : [], [role, uid]));
  const expensesJoint = useLiveCollection<Expense>(role === 'producer' ? 'expenses' : null, useMemo(() => [where('jointApprovalRequired', '==', true), orderBy('createdAt', 'desc')], []));
  const expenses = role === 'producer' ? {
    rows: Array.from(new Map([...expensesOwn.rows, ...expensesJoint.rows].map((row) => [row.id, row])).values()),
    loading: expensesOwn.loading || expensesJoint.loading,
    error: expensesOwn.error || expensesJoint.error,
    fromCache: expensesOwn.fromCache && expensesJoint.fromCache,
    hasPendingWrites: expensesOwn.hasPendingWrites || expensesJoint.hasPendingWrites,
  } : expensesOwn;
  const commissions = useLiveCollection<CommissionEntry>(role === 'client' ? null : 'commissionEntries', useMemo(() => constraints('commissions'), [role, uid]));
  const distribution = useLiveCollection<any>(role === 'producer' ? null : 'distributionOrders', useMemo(() => constraints('distribution'), [role, uid]));
  const notifications = useLiveCollection<NotificationItem>('notifications', useMemo(() => constraints('notifications'), [role, uid]));
  const users = useLiveCollection<any>(role === 'manager' ? 'users' : null, useMemo(() => constraints('users'), [role, uid]));
  return { artists, services, appointments, projects, payments, submissions, expenses, commissions, distribution, notifications, users };
}

function Modal({ title, description, children, onClose }: { title: string; description?: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-heading"><div><span className="eyebrow">MUSIC HOUSE BTA</span><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={19} /></button></div>
      {children}
    </section>
  </div>;
}

function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return <label className="field-wrap"><span>{label}{required && <b className="required"> *</b>}</span>{children}</label>;
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="field" {...props} />;
}
function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="field" {...props} />;
}
function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="field textarea" {...props} />;
}

function Button({ children, variant = 'secondary', onClick, disabled, type = 'button' }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit' }) {
  return <button className={`button ${variant}`} type={type} onClick={onClick} disabled={disabled}>{children}</button>;
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Music2 size={22} /></span><h3>{title}</h3><p>{text}</p>{action}</div>;
}

function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="page-actions">{action}</div>}</div>;
}

function StatCard({ label, value, detail, icon: Icon, tone = 'gold' }: { label: string; value: string; detail: string; icon: typeof Home; tone?: string }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={18} /></span></div><strong>{value}</strong><small>{detail}</small></div>;
}

function StatusPill({ value }: { value: string }) {
  const labels: Record<string, string> = {
    requested: 'Demande reçue', awaiting_deposit: 'Acompte attendu', confirmed: 'Confirmé', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé', no_show: 'Absent', rescheduled: 'À reprogrammer',
    planning: 'Préparation', waiting_client: 'Attente client', review: 'Vérification', on_hold: 'En pause',
    approved: 'Validé', paid: 'Payé', due: 'À régler', retained: 'Réserve', reversed: 'Écriture inverse', reversal: 'Correction', pending: 'En attente', declared: 'Déclarée', to_approve: 'À valider', rejected: 'Rejeté', joint_required: 'Double validation', active: 'Actif', archived: 'Archivé',
    draft: 'Brouillon', ready: 'Prête à soumettre', submitted: 'Soumise', checking: 'En vérification', accepted: 'Acceptée', published: 'Publiée',
  };
  const kind = ['completed', 'approved', 'paid', 'published', 'active', 'confirmed', 'done'].includes(value) ? 'good'
    : ['cancelled', 'rejected', 'no_show', 'archived', 'on_hold'].includes(value) ? 'bad'
      : ['in_progress', 'pending', 'requested', 'awaiting_deposit', 'to_approve', 'declared'].includes(value) ? 'warn' : 'neutral';
  return <span className={`status-pill ${kind}`}>{labels[value] || value.replaceAll('_', ' ')}</span>;
}

function moneySum<T>(rows: T[], get: (row: T) => number): number {
  return rows.reduce((sum, row) => sum + (Number(get(row)) || 0), 0);
}

function csvExport(filename: string, rows: Array<Record<string, string | number | null | undefined>>) {
  if (!rows.length) return;
  const firstRow = rows[0];
  if (!firstRow) return;
  const columns = Object.keys(firstRow);
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const contents = [columns.map(escape).join(';'), ...rows.map((row) => columns.map((column) => escape(row[column])).join(';'))].join('\r\n');
  const blob = new Blob(['\ufeff', contents], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

export default function Workspace() {
  const { user, profile, logout } = useAuth();
  const role = profile?.role || 'client'; const uid = user?.uid || '';
  const location = useLocation(); const navigate = useNavigate();
  const active = (location.pathname.split('/')[1] || 'dashboard') as SectionKey;
  const nav = role === 'manager' ? managerNav : role === 'producer' ? producerNav : clientNav;
  const data = useWorkspaceData(role, uid);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [modal, setModal] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [rates, setRates] = useState<RateSet | null>(null);
  const [managerUsers, setManagerUsers] = useState<Array<{ uid: string; displayName: string; role: string; active: boolean }>>([]);
  const [myProfile, setMyProfile] = useState<Artist | null>(null);
  const [trustedDevice] = useState(() => typeof localStorage !== 'undefined' && localStorage.getItem('mhb_trusted_device') === 'yes');
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (role === 'manager' || role === 'producer') getRateSet(db!).then(setRates).catch((error) => setNotice({ type: 'error', message: error.message }));
  }, [role]);

  useEffect(() => {
    if (role === 'manager') {
      setManagerUsers(data.users.rows.map((row) => ({
        uid: row.id, displayName: String(row.displayName || row.email || 'Utilisateur'),
        role: String(row.role || 'client'), active: row.active === true,
      })));
    } else setManagerUsers([]);
  }, [role, data.users.rows]);

  useEffect(() => {
    if (role === 'client') setMyProfile(data.artists.rows.find((artist) => artist.ownerUid === uid) || null);
  }, [role, uid, data.artists.rows]);

  const section = nav.some((item) => item.key === active) ? active : 'dashboard';
  const visibleNotifications = data.notifications.rows.filter((item) => !item.readAt).length;
  const offline = !online;
  const pendingWrites = Object.values(data).some((collectionState) => collectionState.hasPendingWrites);
  const allErrors = [data.artists.error, data.services.error, data.appointments.error, data.projects.error, data.payments.error].filter(Boolean);

  async function action(task: () => Promise<void>, successMessage: string) {
    setBusy(true); setNotice(null);
    try { await task(); setModal(null); setNotice({ type: 'success', message: successMessage }); }
    catch (error) { setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Une erreur est survenue.' }); }
    finally { setBusy(false); }
  }

  const filtered = <T extends object>(rows: T[]) => {
    if (!search.trim()) return rows;
    const term = search.toLowerCase();
    return rows.filter((row) => Object.entries(row as Record<string, unknown>).some(([key, value]) =>
      !['createdAt', 'updatedAt', 'startsAt', 'endsAt', 'paidAt', 'targetDate', 'termsAcceptedAt'].includes(key)
      && (typeof value === 'string' || typeof value === 'number') && String(value).toLowerCase().includes(term),
    ));
  };

  async function createArtist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await action(async () => {
      await addDoc(collection(db!, 'artists'), {
        fullName: String(form.get('fullName') || '').trim(), stageName: String(form.get('stageName') || '').trim(),
        email: String(form.get('email') || '').trim(), phone: String(form.get('phone') || '').trim(),
        city: String(form.get('city') || '').trim(), genre: String(form.get('genre') || '').trim(),
        bio: String(form.get('bio') || '').trim(), ownerUid: null, source: 'manual', status: 'active',
        createdBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }, 'Le profil artiste a été ajouté.');
  }

  async function createService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await action(async () => {
      const priceXaf = Number(form.get('priceXaf')); const depositPercent = Number(form.get('depositPercent'));
      if (!Number.isSafeInteger(priceXaf) || priceXaf < 0) throw new Error('Le tarif doit être un montant XAF entier.');
      if (!Number.isInteger(depositPercent) || depositPercent < 0 || depositPercent > 100) throw new Error('Acompte invalide.');
      await addDoc(collection(db!, 'services'), {
        name: String(form.get('name') || '').trim(), category: String(form.get('category') || '').trim(),
        description: String(form.get('description') || '').trim(), priceXaf,
        durationMinutes: Number(form.get('durationMinutes')) || 0, depositPercent,
        splitType: form.get('splitType') === 'distribution' ? 'distribution' : 'studio',
        isActive: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }, 'La prestation a été créée.');
  }

  async function createAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await action(async () => {
      const service = data.services.rows.find((row) => row.id === String(form.get('serviceId')));
      if (!service) throw new Error('Sélectionnez une prestation active.');
      const artist = role === 'client' ? myProfile : data.artists.rows.find((row) => row.id === String(form.get('artistId')));
      if (!artist && role === 'client') throw new Error('Complétez d’abord votre profil artistique.');
      if (!artist) throw new Error('Sélectionnez un artiste.');
      const windowTimes = buildAppointmentWindow(String(form.get('startsAt') || ''), service.durationMinutes || 60);
      const ownerUid = role === 'client' ? uid : (artist.ownerUid || 'manual');
      const deposit = Math.ceil((service.priceXaf * service.depositPercent) / 100);
      const assignedProducerUid = role === 'manager' ? String(form.get('producerUid') || '') || null : null;
      const appointmentRef = doc(collection(db!, 'appointments'));
      const batch = writeBatch(db!);
      batch.set(appointmentRef, {
        ownerUid, artistId: artist.id, artistName: artist.stageName || artist.fullName,
        serviceId: service.id, serviceName: service.name, servicePriceXaf: service.priceXaf,
        splitType: service.splitType, depositExpectedXaf: deposit, amountPaidXaf: 0,
        ...(role === 'manager' ? {
          producerUid: assignedProducerUid,
          producerName: managerUsers.find((entry) => entry.uid === assignedProducerUid && entry.active)?.displayName || null,
        } : {}),
        resourceId: 'studio', ...windowTimes,
        status: 'requested', clientNote: String(form.get('clientNote') || '').trim(),
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      if (assignedProducerUid) batch.update(doc(db!, 'artists', artist.id), { producerUids: arrayUnion(assignedProducerUid), updatedAt: serverTimestamp() });
      await batch.commit();
    }, role === 'client' ? 'Votre demande de rendez-vous a été envoyée.' : 'La demande de rendez-vous a été créée.');
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await action(async () => {
      const artist = data.artists.rows.find((row) => row.id === String(form.get('artistId')));
      if (!artist) throw new Error('Sélectionnez un artiste.');
      const producer = managerUsers.find((entry) => entry.uid === String(form.get('producerUid')) && entry.role === 'producer' && entry.active);
      if (!producer) throw new Error('Sélectionnez un compte producteur actif.');
      const priceXaf = Number(form.get('priceXaf')) || 0;
      if (!Number.isSafeInteger(priceXaf) || priceXaf < 0) throw new Error('Le prix doit être un entier XAF.');
      const target = String(form.get('targetDate') || '');
      const batch = writeBatch(db!);
      const projectRef = doc(collection(db!, 'projects'));
      batch.set(projectRef, {
        ownerUid: artist.ownerUid || 'manual', artistId: artist.id,
        artistName: artist.stageName || artist.fullName, title: String(form.get('title') || '').trim(),
        type: String(form.get('type') || 'single'), producerUid: producer.uid,
        producerName: producer.displayName, status: 'planning', clientVisible: true,
        clientProgress: 'Projet créé', steps: DEFAULT_PROJECT_STEPS, priceXaf,
        targetDate: target ? Timestamp.fromDate(new Date(`${target}T12:00:00+01:00`)) : null,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      batch.update(doc(db!, 'artists', artist.id), { producerUids: arrayUnion(producer.uid), updatedAt: serverTimestamp() });
      await batch.commit();
    }, 'Le projet musical a été créé.');
  }

  async function createPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await action(async () => {
      const project = data.projects.rows.find((row) => row.id === String(form.get('projectId')));
      const appointment = data.appointments.rows.find((row) => row.id === String(form.get('appointmentId')));
      const artist = project ? data.artists.rows.find((row) => row.id === project.artistId) : appointment ? data.artists.rows.find((row) => row.id === appointment.artistId) : data.artists.rows.find((row) => row.id === String(form.get('artistId')));
      if (!project && !artist && !appointment) throw new Error('Sélectionnez un artiste, un projet ou un rendez-vous.');
      const ownerUid = project?.ownerUid || appointment?.ownerUid || artist?.ownerUid || 'manual';
      const amountXaf = Number(form.get('amountXaf')); const directCostsXaf = Number(form.get('directCostsXaf')) || 0;
      await recordValidatedPayment(db!, {
        ownerUid, artistName: project?.artistName || appointment?.artistName || artist?.stageName || artist?.fullName || 'Artiste',
        amountXaf, directCostsXaf, thirdPartyAmountXaf: Number(form.get('thirdPartyAmountXaf')) || 0,
        method: String(form.get('method') || 'cash') as any,
        splitType: String(form.get('splitType') || 'studio') as SplitType,
        projectId: project?.id, appointmentId: String(form.get('appointmentId') || '') || undefined,
        reference: String(form.get('reference') || '').trim(), recordedBy: uid,
        producerUid: project?.producerUid || appointment?.producerUid || artist?.producerUids?.[0],
      });
    }, 'Paiement validé et répartition enregistrée.');
  }

  async function handlePaymentSubmission(row: any) {
    await action(async () => {
      if (row.status !== 'pending') throw new Error('Cette déclaration a déjà été traitée.');
      const project = data.projects.rows.find((entry) => entry.id === row.projectId);
      const appointment = data.appointments.rows.find((entry) => entry.id === row.appointmentId);
      const artist = data.artists.rows.find((entry) => entry.ownerUid === row.ownerUid);
      await recordValidatedPayment(db!, {
        ownerUid: row.ownerUid, artistName: project?.artistName || appointment?.artistName || artist?.stageName || artist?.fullName || 'Artiste',
        amountXaf: Number(row.amountXaf), directCostsXaf: 0,
        method: row.method, splitType: (row.splitType || 'studio') as SplitType,
        projectId: row.projectId || undefined, appointmentId: row.appointmentId || undefined,
        reference: row.reference || '', recordedBy: uid, producerUid: project?.producerUid || appointment?.producerUid || artist?.producerUids?.[0], submissionId: row.id,
      });
    }, 'La déclaration a été vérifiée et enregistrée dans les paiements.');
  }

  async function createExpenseForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await action(async () => {
      const amountXaf = Number(form.get('amountXaf'));
      if (!Number.isSafeInteger(amountXaf) || amountXaf <= 0) throw new Error('Le montant doit être un nombre entier positif en XAF.');
      await createExpense(db!, {
        label: String(form.get('label') || '').trim(), category: String(form.get('category') || '').trim(),
        amountXaf, treatment: String(form.get('treatment') || 'general') as 'general' | 'direct',
        submittedBy: uid, submittedByName: profile?.displayName || 'Équipe',
        projectId: String(form.get('projectId') || '') || undefined,
        reason: String(form.get('reason') || '').trim(), exceptional: form.get('exceptional') === 'on',
      }, role === 'manager', rates?.expenseApprovalThresholdXaf ?? null);
    }, role === 'manager' ? 'La dépense a été enregistrée.' : 'La dépense a été déclarée au manager.');
  }

  async function createDistribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await action(async () => {
      const artist = data.artists.rows.find((row) => row.id === String(form.get('artistId')));
      if (!artist) throw new Error('Sélectionnez un artiste.');
      const price = Number(form.get('priceXaf'));
      if (!Number.isSafeInteger(price) || price < 0) throw new Error('Le tarif doit être un entier XAF.');
      await addDoc(collection(db!, 'distributionOrders'), {
        ownerUid: artist.ownerUid || 'manual', artistId: artist.id,
        artistName: artist.stageName || artist.fullName,
        releaseTitle: String(form.get('releaseTitle') || '').trim(), releaseType: String(form.get('releaseType') || 'single'),
        distributor: String(form.get('distributor') || '').trim(), platforms: String(form.get('platforms') || '').trim(),
        requestedReleaseDate: String(form.get('releaseDate') || '') || null,
        priceXaf: price, status: 'draft', clientVisible: true,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: uid,
      });
    }, 'La commande de distribution a été créée.');
  }

  async function saveRates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await action(async () => {
      const newRates: RateSet = {
        version: rates?.version || 'v1',
        studio: { manager: Number(form.get('studioManager')), producer: Number(form.get('studioProducer')), reserve: Number(form.get('studioReserve')) },
        distribution: { manager: Number(form.get('distManager')), producer: Number(form.get('distProducer')), reserve: Number(form.get('distReserve')) },
        expenseApprovalThresholdXaf: String(form.get('expenseThreshold') || '').trim() === '' ? null : Number(form.get('expenseThreshold')),
      };
      const threshold = newRates.expenseApprovalThresholdXaf;
      if (threshold !== null && threshold !== undefined && (!Number.isSafeInteger(threshold) || threshold < 0)) throw new Error('Le seuil de dépense doit être un entier XAF positif ou nul.');
      await updateBusinessRates(db!, uid, newRates);
      setRates(await getRateSet(db!));
    }, 'Les nouvelles répartitions sont enregistrées. Les paiements déjà validés conservent leur version.');
  }

  async function markExpense(row: Expense, status: string) {
    await action(async () => {
      if (status === 'paid') {
        if (!navigator.onLine) throw new Error('Le règlement d’une dépense exige une connexion Internet.');
        if (role !== 'manager' || row.status !== 'approved') throw new Error('Seul le manager peut marquer comme payée une dépense déjà approuvée.');
        await updateDoc(doc(db!, 'expenses', row.id), { status: 'paid', reviewedBy: uid, reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() });
        return;
      }
      if (status === 'approved' && row.jointApprovalRequired) {
        if (!navigator.onLine) throw new Error('Une co-signature financière nécessite une connexion.');
        await runTransaction(db!, async (transaction) => {
          const ref = doc(db!, 'expenses', row.id);
          const snapshot = await transaction.get(ref);
          if (!snapshot.exists()) throw new Error('Dépense introuvable.');
          const current = snapshot.data();
          if (current.status !== 'joint_required' || current.jointApprovalRequired !== true) throw new Error('Cette dépense n’attend plus de co-signature.');
          const ownField = role === 'manager' ? 'managerApprovedBy' : 'producerApprovedBy';
          const otherField = role === 'manager' ? 'producerApprovedBy' : 'managerApprovedBy';
          if (current[ownField]) throw new Error('Votre validation a déjà été enregistrée.');
          if (role !== 'manager' && role !== 'producer') throw new Error('Rôle non autorisé.');
          const otherApproved = Boolean(current[otherField]);
          transaction.update(ref, {
            [ownField]: uid,
            [role === 'manager' ? 'managerApprovedAt' : 'producerApprovedAt']: serverTimestamp(),
            status: otherApproved ? 'approved' : 'joint_required',
            reviewedBy: uid, reviewedAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
        });
      } else {
        if (role !== 'manager' || !['declared', 'to_approve'].includes(row.status)) throw new Error('Cette dépense ne peut pas être validée par votre rôle.');
        await updateDoc(doc(db!, 'expenses', row.id), { status: 'approved', reviewedBy: uid, reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
    }, row.jointApprovalRequired && status === 'approved' ? 'Votre co-signature a été enregistrée. La dépense est approuvée uniquement après la validation des deux rôles.' : 'Le statut de la dépense a été mis à jour.');
  }

  async function markCommissionPaid(row: CommissionEntry) {
    await action(async () => {
      if (!navigator.onLine) throw new Error('Le règlement d’une commission exige une connexion Internet.');
      if (row.status !== 'due') throw new Error('Cette commission n’est pas à régler.');
      await updateDoc(doc(db!, 'commissionEntries', row.id), { status: 'paid', paidAt: serverTimestamp(), paidBy: uid });
    }, 'Le règlement de la commission est enregistré.');
  }

  async function updateStep(project: MusicProject, stepId: string, status: string) {
    await action(async () => {
      const steps = (project.steps || []).map((step) => step.id === stepId ? { ...step, status, updatedAt: serverTimestamp() } : step);
      const done = steps.filter((step) => step.status === 'done').length;
      const progress = `${done}/${steps.length} étapes terminées`;
      const projectStatus = done === steps.length ? 'completed' : 'in_progress';
      await updateDoc(doc(db!, 'projects', project.id), { steps, status: projectStatus, clientProgress: progress, updatedAt: serverTimestamp() });
    }, 'L’étape de production a été actualisée.');
  }

  async function addProjectNote(project: MusicProject) {
    const note = window.prompt('Note technique interne (visible uniquement par l’équipe) :');
    if (!note?.trim()) return;
    await action(async () => {
      await addDoc(collection(db!, 'projects', project.id, 'internalNotes'), {
        text: note.trim(), authorUid: uid, authorName: profile?.displayName || 'Équipe', createdAt: serverTimestamp(),
      });
      await addDoc(collection(db!, 'activityLogs'), {
        actorUid: uid, action: 'project.internal_note_added', entityId: project.id, entityType: 'project', createdAt: serverTimestamp(),
      });
    }, 'La note technique a été enregistrée en privé.');
  }

  async function readNotification(row: NotificationItem) {
    if (row.readAt) return;
    await action(async () => { await markNotificationRead(db!, row.id); }, 'Notification marquée comme lue.');
  }

  async function reversePayment(row: Payment) {
    const reason = window.prompt('Motif obligatoire de la correction du paiement :');
    if (!reason?.trim()) return;
    await action(async () => { await reverseLatestPayment(db!, row.id, reason, uid); }, 'L’écriture de correction a été ajoutée au journal.');
  }

  async function doLogout() {
    await action(async () => { await logout(); }, 'Déconnexion effectuée.');
    navigate('/login');
  }

  function onNavigate(key: SectionKey) { navigate(key === 'dashboard' ? '/' : `/${key}`); setMobileMenu(false); setSearch(''); }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
      <div className="sidebar-brand"><span className="brand-mark"><AudioLines size={21} /></span><div><b>MUSIC HOUSE</b><small>BTA · STUDIO MANAGER</small></div><button className="mobile-close icon-button" onClick={() => setMobileMenu(false)}><X size={18} /></button></div>
      <div className="workspace-tag"><span className="workspace-dot" /> YOUNG FOREVER RECORDS</div>
      <nav className="side-nav">
        {nav.map((item) => <div key={item.key}>
          {item.group && <div className="nav-group">{item.group}</div>}
          <button className={`nav-item ${section === item.key ? 'active' : ''}`} onClick={() => onNavigate(item.key)}>
            <item.icon size={17} strokeWidth={1.8} /><span>{item.label}</span>
            {item.key === 'notifications' && visibleNotifications > 0 && <b className="nav-count">{visibleNotifications}</b>}
          </button>
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="help-box"><span className="help-icon"><Sparkles size={16} /></span><div><b>Besoin d’aide ?</b><p>Votre espace de travail est à jour.</p></div></div>
        <div className="sidebar-user"><span className="avatar">{(profile?.displayName || 'M').slice(0, 1).toUpperCase()}</span><div className="user-meta"><b>{profile?.displayName || user?.email}</b><small>{ROLE_LABELS[role]}</small></div><button className="icon-button" onClick={doLogout} title="Se déconnecter"><LogOut size={16} /></button></div>
      </div>
    </aside>
    {mobileMenu && <button className="mobile-scrim" onClick={() => setMobileMenu(false)} aria-label="Fermer le menu" />}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu-button icon-button" onClick={() => setMobileMenu(true)}><Menu size={20} /></button><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{nav.find((item) => item.key === section)?.label || 'Vue d’ensemble'}</strong></div></div>
        <div className="topbar-right"><span className={`connection ${offline ? 'offline' : pendingWrites ? 'syncing' : ''}`}><i />{offline ? 'Hors connexion' : pendingWrites ? 'Synchronisation…' : 'En ligne'}</span><button className="topbar-notification icon-button" onClick={() => onNavigate('notifications')} title="Notifications"><Bell size={18} />{visibleNotifications > 0 && <i />}</button><div className="topbar-avatar">{(profile?.displayName || 'M').slice(0, 1).toUpperCase()}</div></div>
      </header>
      <section className="content-area">
        {!trustedDevice && <div className="privacy-banner"><ShieldCheck size={17} /><span><b>Appareil non approuvé.</b> Les données hors connexion restent en mémoire de session uniquement. Activez le cache persistant seulement sur un appareil personnel.</span><button onClick={() => { localStorage.setItem('mhb_trusted_device', 'yes'); window.location.reload(); }}>Faire confiance à cet appareil</button></div>}
        {offline && <div className="offline-banner"><WifiOff size={17} /><span>Vous êtes hors connexion. Les données déjà mises en cache restent consultables. Les confirmations et validations financières sont désactivées.</span></div>}
        {allErrors.length > 0 && <div className="alert error"><AlertCircle size={17} />{allErrors[0]}</div>}
        {notice && <div className={`toast ${notice.type}`}><span>{notice.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}{notice.message}</span><button className="icon-button" onClick={() => setNotice(null)}><X size={16} /></button></div>}
        {section !== 'dashboard' && section !== 'profile' && <div className="search-line"><div className="search-box"><Search size={17} /><input placeholder="Rechercher dans cette vue…" value={search} onChange={(e) => setSearch(e.target.value)} /><kbd>⌘ K</kbd></div><button className="filter-button" onClick={() => setSearch('')}><Filter size={15} /> Réinitialiser</button></div>}
        {section === 'dashboard' && <Dashboard role={role} profileName={profile?.displayName || 'Artiste'} data={data} onNavigate={onNavigate} />}
        {section === 'artists' && (role === 'manager' || role === 'producer') && <ArtistsPage rows={filtered(data.artists.rows)} readOnly={role === 'producer'} onAdd={() => setModal('artist')} onArchive={(row) => action(async () => { await updateDoc(doc(db!, 'artists', row.id), { status: row.status === 'archived' ? 'active' : 'archived', updatedAt: serverTimestamp() }); }, 'Le statut du profil a été modifié.')} />}
        {section === 'services' && <ServicesPage role={role} rows={filtered(data.services.rows)} onAdd={() => setModal('service')} onToggle={(row) => action(async () => { await updateDoc(doc(db!, 'services', row.id), { isActive: !row.isActive, updatedAt: serverTimestamp() }); }, 'Le catalogue a été mis à jour.')} />}
        {(section === 'appointments' || section === 'calendar') && <AppointmentsPage role={role} rows={filtered(data.appointments.rows)} producers={managerUsers.filter((entry) => entry.role === 'producer' && entry.active)} onAdd={() => setModal('appointment')} onConfirm={(row, producerUid) => action(async () => { let waiver: string | undefined; if ((row.amountPaidXaf || 0) < (row.depositExpectedXaf || 0)) { waiver = window.prompt(`Acompte requis : ${formatXaf(row.depositExpectedXaf)} · déjà reçu : ${formatXaf(row.amountPaidXaf || 0)}. Motif obligatoire de la dérogation manager :`) || undefined; if (!waiver?.trim()) throw new Error('La confirmation a été annulée : l’acompte reste insuffisant.'); } const producer = managerUsers.find((entry) => entry.uid === producerUid && entry.role === 'producer' && entry.active); await confirmAppointment(db!, row.id, uid, waiver, producer ? { uid: producer.uid, name: producer.displayName } : undefined); }, 'Le créneau est confirmé et réservé.')} onCancel={(row) => action(() => cancelAppointment(db!, row.id), 'Le rendez-vous a été annulé et le créneau libéré.')} onReschedule={(row) => { const next = window.prompt('Nouvelle date et heure (heure de Douala), format AAAA-MM-JJTHH:MM :'); if (next) action(() => rescheduleAppointment(db!, row.id, next), 'Le rendez-vous a été déplacé. Une nouvelle confirmation du créneau est nécessaire.'); }} onProgress={(row, status) => action(() => updateAppointmentProgress(db!, row.id, status as 'in_progress' | 'completed'), status === 'completed' ? 'Séance terminée et créneau libéré.' : 'Séance démarrée.')} />}
        {section === 'projects' && <ProjectsPage role={role} rows={filtered(data.projects.rows)} onAdd={() => setModal('project')} onStep={updateStep} onNote={addProjectNote} />}
        {section === 'payments' && <PaymentsPage role={role} rows={filtered(data.payments.rows)} submissions={filtered(data.submissions.rows)} onAdd={() => setModal(role === 'client' ? 'payment-claim' : 'payment')} onProcess={handlePaymentSubmission} onReverse={reversePayment} />}
        {section === 'expenses' && role !== 'client' && <ExpensesPage role={role} rows={filtered(data.expenses.rows)} onAdd={() => setModal('expense')} onStatus={markExpense} />}
        {section === 'commissions' && <CommissionsPage role={role} rows={filtered(data.commissions.rows)} onPaid={markCommissionPaid} />}
        {section === 'distribution' && role !== 'producer' && <DistributionPage role={role} rows={filtered(data.distribution.rows)} onAdd={() => setModal('distribution')} onStatus={(row, status) => action(async () => { await updateDoc(doc(db!, 'distributionOrders', row.id), { status, updatedAt: serverTimestamp(), updatedBy: uid }); }, 'Le statut de distribution a été mis à jour.')} />}
        {section === 'reports' && role === 'manager' && <ReportsPage data={data} />}
        {section === 'settings' && role === 'manager' && <SettingsPage rates={rates} onInitialize={() => action(async () => { await initializeBusinessSettings(db!, uid); setRates(await getRateSet(db!)); }, 'Les paramètres financiers par défaut ont été initialisés.')} onSave={saveRates} onClearCache={() => action(() => clearLocalFirestoreCache(), 'Le cache local a été effacé.')} />}
        {section === 'notifications' && <NotificationsPage rows={filtered(data.notifications.rows)} onRead={readNotification} />}
        {section === 'profile' && role === 'client' && <ProfilePage profile={myProfile} onSaved={() => setNotice({ type: 'success', message: 'Votre profil artistique a été mis à jour.' })} onError={(message) => setNotice({ type: 'error', message })} />}
        {section !== 'dashboard' && !nav.some((item) => item.key === section) && <EmptyState title="Page indisponible" text="Cette section n’est pas accessible avec votre rôle." action={<Button onClick={() => onNavigate('dashboard')}>Retour à l’accueil</Button>} />}
        <footer className="content-footer"><span>© 2026 MUSIC HOUSE BTA</span><span>Une plateforme pour <b>Young Forever Records</b></span><span>Fuseau horaire : Africa/Douala</span></footer>
      </section>
    </main>
    {modal && <Modal title={modalTitle(modal)} description={modalDescription(modal)} onClose={() => setModal(null)}>
      {modal === 'artist' && <form className="form-grid" onSubmit={createArtist}><Field label="Nom et prénom" required><TextInput name="fullName" required placeholder="Nom complet" /></Field><Field label="Nom de scène"><TextInput name="stageName" placeholder="Nom artistique" /></Field><Field label="E-mail"><TextInput type="email" name="email" placeholder="artiste@exemple.com" /></Field><Field label="Téléphone"><TextInput name="phone" placeholder="+237…" /></Field><Field label="Ville"><TextInput name="city" placeholder="Yaoundé" /></Field><Field label="Genre musical"><TextInput name="genre" placeholder="Afrobeat, rap, gospel…" /></Field><div className="span-two"><Field label="Présentation"><TextArea name="bio" rows={3} placeholder="Quelques mots sur l’artiste…" /></Field></div><div className="modal-actions span-two"><Button onClick={() => setModal(null)}>Annuler</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Ajouter le profil'}</Button></div></form>}
      {modal === 'service' && <form className="form-grid" onSubmit={createService}><Field label="Nom de la prestation" required><TextInput name="name" required placeholder="Enregistrement studio" /></Field><Field label="Catégorie" required><SelectInput name="category"><option>Enregistrement</option><option>Composition / instrumental</option><option>Arrangement</option><option>Mixage</option><option>Mastering</option><option>Production complète</option><option>Distribution numérique</option><option>Service complémentaire</option></SelectInput></Field><div className="span-two"><Field label="Description"><TextArea name="description" rows={2} placeholder="Détail du service et de ce qui est inclus…" /></Field></div><Field label="Tarif (FCFA)" required><TextInput name="priceXaf" type="number" min="0" step="1" required placeholder="25000" /></Field><Field label="Durée indicative (minutes)"><TextInput name="durationMinutes" type="number" min="0" step="15" defaultValue="60" /></Field><Field label="Acompte requis (%)"><TextInput name="depositPercent" type="number" min="0" max="100" step="1" defaultValue="50" /></Field><Field label="Répartition"><SelectInput name="splitType"><option value="studio">Prestation du studio (25 / 50 / 25)</option><option value="distribution">Distribution numérique (70 / 20 / 10)</option></SelectInput></Field><div className="modal-actions span-two"><Button onClick={() => setModal(null)}>Annuler</Button><Button type="submit" variant="primary" disabled={busy}>Créer la prestation</Button></div></form>}
      {modal === 'appointment' && <form className="form-grid" onSubmit={createAppointment}>{role === 'manager' && <Field label="Artiste / client" required><SelectInput name="artistId" required><option value="">Choisir un artiste</option>{data.artists.rows.filter((row) => row.status !== 'archived').map((row) => <option key={row.id} value={row.id}>{row.stageName || row.fullName}</option>)}</SelectInput></Field>}<Field label="Prestation" required><SelectInput name="serviceId" required><option value="">Choisir une prestation</option>{data.services.rows.filter((row) => row.isActive).map((row) => <option key={row.id} value={row.id}>{row.name} · {formatXaf(row.priceXaf)}</option>)}</SelectInput></Field><Field label="Date et heure (heure de Douala)" required><TextInput name="startsAt" type="datetime-local" required step="900" /></Field>{role === 'manager' && <Field label="Producteur affecté"><SelectInput name="producerUid"><option value="">À définir</option>{managerUsers.filter((entry) => entry.role === 'producer' && entry.active).map((entry) => <option key={entry.uid} value={entry.uid}>{entry.displayName}</option>)}</SelectInput></Field>}<div className="span-two"><Field label="Message / précision visible par le studio"><TextArea name="clientNote" rows={3} placeholder="Précisez votre besoin…" /></Field></div><p className="form-hint span-two">L’acompte prévu est calculé automatiquement selon les conditions de la prestation. Une demande ne réserve pas le créneau : la confirmation est faite par le manager après vérification de la disponibilité.</p><div className="modal-actions span-two"><Button onClick={() => setModal(null)}>Annuler</Button><Button type="submit" variant="primary" disabled={busy}>Envoyer la demande</Button></div></form>}
      {modal === 'project' && <form className="form-grid" onSubmit={createProject}><Field label="Artiste" required><SelectInput name="artistId" required><option value="">Choisir un artiste</option>{data.artists.rows.map((row) => <option key={row.id} value={row.id}>{row.stageName || row.fullName}</option>)}</SelectInput></Field><Field label="Producteur responsable" required><SelectInput name="producerUid" required><option value="">Choisir un producteur</option>{managerUsers.filter((entry) => entry.role === 'producer' && entry.active).map((entry) => <option key={entry.uid} value={entry.uid}>{entry.displayName}</option>)}</SelectInput></Field><Field label="Titre du projet" required><TextInput name="title" required placeholder="Titre du single ou de l’album" /></Field><Field label="Type de projet"><SelectInput name="type"><option value="single">Single</option><option value="ep">EP</option><option value="album">Album</option><option value="other">Autre</option></SelectInput></Field><Field label="Prix convenu (FCFA)"><TextInput name="priceXaf" type="number" min="0" step="1" defaultValue="0" /></Field><Field label="Date cible de livraison"><TextInput name="targetDate" type="date" /></Field><div className="modal-actions span-two"><Button onClick={() => setModal(null)}>Annuler</Button><Button type="submit" variant="primary" disabled={busy}>Créer le projet</Button></div></form>}
      {modal === 'payment' && <form className="form-grid" onSubmit={createPayment}><Field label="Projet lié"><SelectInput name="projectId"><option value="">Sans projet lié</option>{data.projects.rows.map((row) => <option key={row.id} value={row.id}>{row.title} · {row.artistName}</option>)}</SelectInput></Field><Field label="Rendez-vous lié (acompte / solde)"><SelectInput name="appointmentId"><option value="">Aucun</option>{data.appointments.rows.filter((row) => !['cancelled', 'no_show'].includes(row.status)).map((row) => <option key={row.id} value={row.id}>{row.artistName} · {row.serviceName} · {formatDate(row.startsAt)}</option>)}</SelectInput></Field><Field label="Artiste (si paiement sans projet / rendez-vous)"><SelectInput name="artistId"><option value="">Choisir un artiste</option>{data.artists.rows.map((row) => <option key={row.id} value={row.id}>{row.stageName || row.fullName}</option>)}</SelectInput></Field><Field label="Montant encaissé (FCFA)" required><TextInput name="amountXaf" type="number" min="1" step="1" required placeholder="25000" /></Field><Field label="Frais externes directs déductibles (FCFA)"><TextInput name="directCostsXaf" type="number" min="0" step="1" defaultValue="0" /></Field><Field label="Somme collectée pour un tiers (FCFA)"><TextInput name="thirdPartyAmountXaf" type="number" min="0" step="1" defaultValue="0" /></Field><Field label="Mode de paiement"><SelectInput name="method"><option value="cash">Espèces</option><option value="mtn_momo">MTN Mobile Money</option><option value="orange_money">Orange Money</option><option value="transfer">Virement</option><option value="other">Autre</option></SelectInput></Field><Field label="Type de répartition"><SelectInput name="splitType"><option value="studio">Prestation du studio</option><option value="distribution">Service de distribution</option></SelectInput></Field><div className="span-two"><Field label="Référence (facultatif)"><TextInput name="reference" placeholder="Référence du reçu ou de la transaction" /></Field></div><p className="form-hint span-two">Le paiement sera inscrit comme validé. Les commissions sont réparties sur le cumul encaissé de ce projet et de cette version tarifaire, pour que les arrondis restent cohérents lors des acomptes successifs.</p><div className="modal-actions span-two"><Button onClick={() => setModal(null)}>Annuler</Button><Button type="submit" variant="primary" disabled={busy}>Valider le paiement</Button></div></form>}
      {modal === 'payment-claim' && <form className="form-grid" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await action(async () => { const project = data.projects.rows.find((row) => row.id === String(form.get('projectId'))); await submitPaymentClaim(db!, { ownerUid: uid, amountXaf: Number(form.get('amountXaf')), method: String(form.get('method') || 'other') as any, reference: String(form.get('reference') || '').trim(), note: String(form.get('note') || '').trim(), projectId: project?.id, appointmentId: String(form.get('appointmentId') || '') || undefined, splitType: 'studio' }); }, 'Votre déclaration de paiement a été envoyée au studio pour vérification.'); }}><Field label="Projet concerné"><SelectInput name="projectId"><option value="">Non précisé</option>{data.projects.rows.map((row) => <option value={row.id} key={row.id}>{row.title}</option>)}</SelectInput></Field><Field label="Montant payé (FCFA)" required><TextInput name="amountXaf" type="number" min="1" step="1" required /></Field><Field label="Mode de paiement"><SelectInput name="method"><option value="mtn_momo">MTN Mobile Money</option><option value="orange_money">Orange Money</option><option value="cash">Espèces</option><option value="transfer">Virement</option><option value="other">Autre</option></SelectInput></Field><Field label="Référence de paiement" required><TextInput name="reference" required placeholder="Référence ou identifiant de transaction" /></Field><div className="span-two"><Field label="Commentaire"><TextArea name="note" rows={2} /></Field></div><p className="form-hint span-two">Cette déclaration n’est pas un paiement validé. Le manager doit vérifier la réception des fonds avant de l’enregistrer.</p><div className="modal-actions span-two"><Button onClick={() => setModal(null)}>Annuler</Button><Button type="submit" variant="primary" disabled={busy}>Envoyer pour vérification</Button></div></form>}
      {modal === 'expense' && <form className="form-grid" onSubmit={createExpenseForm}><Field label="Libellé" required><TextInput name="label" required placeholder="Achat de câble audio" /></Field><Field label="Catégorie"><SelectInput name="category"><option>Matériel</option><option>Transport</option><option>Électricité</option><option>Entretien</option><option>Communication</option><option>Autre</option></SelectInput></Field><Field label="Montant (FCFA)" required><TextInput name="amountXaf" type="number" min="1" step="1" required /></Field><Field label="Traitement"><SelectInput name="treatment"><option value="general">Charge générale (réserve)</option><option value="direct">Frais directement liés à une prestation</option></SelectInput></Field><Field label="Projet lié (facultatif)"><SelectInput name="projectId"><option value="">Aucun</option>{data.projects.rows.map((row) => <option value={row.id} key={row.id}>{row.title}</option>)}</SelectInput></Field><label className="check-field"><input name="exceptional" type="checkbox" /> Dépense exceptionnelle / investissement</label><div className="span-two"><Field label="Motif / justificatif"><TextArea name="reason" rows={2} placeholder="Précisez la dépense et la référence du justificatif…" /></Field></div><p className="form-hint span-two">Les dépenses déclarées par le producteur restent à valider par le manager. Une dépense exceptionnelle ou supérieure au seuil exige une co-signature du manager et du producteur.</p><div className="modal-actions span-two"><Button onClick={() => setModal(null)}>Annuler</Button><Button type="submit" variant="primary">Déclarer la dépense</Button></div></form>}
      {modal === 'distribution' && <form className="form-grid" onSubmit={createDistribution}><Field label="Artiste" required><SelectInput name="artistId" required><option value="">Choisir un artiste</option>{data.artists.rows.map((row) => <option value={row.id} key={row.id}>{row.stageName || row.fullName}</option>)}</SelectInput></Field><Field label="Titre de la sortie" required><TextInput name="releaseTitle" required placeholder="Titre du morceau / album" /></Field><Field label="Type de sortie"><SelectInput name="releaseType"><option value="single">Single</option><option value="ep">EP</option><option value="album">Album</option></SelectInput></Field><Field label="Distributeur"><TextInput name="distributor" placeholder="Nom du distributeur" /></Field><Field label="Tarif du service (FCFA)" required><TextInput name="priceXaf" type="number" min="0" step="1" required /></Field><Field label="Date souhaitée"><TextInput name="releaseDate" type="date" /></Field><div className="span-two"><Field label="Plateformes demandées"><TextArea name="platforms" rows={2} placeholder="Spotify, Apple Music, Deezer…" /></Field></div><div className="modal-actions span-two"><Button onClick={() => setModal(null)}>Annuler</Button><Button type="submit" variant="primary">Créer la commande</Button></div></form>}
    </Modal>}
  </div>;
}

function modalTitle(key: string): string {
  const titles: Record<string, string> = { artist: 'Nouveau profil artiste', service: 'Ajouter une prestation', appointment: 'Nouvelle demande de rendez-vous', project: 'Créer un projet musical', payment: 'Enregistrer un paiement', 'payment-claim': 'Déclarer un paiement', expense: 'Nouvelle dépense', distribution: 'Nouvelle commande de distribution' };
  return titles[key] || 'Nouvel enregistrement';
}
function modalDescription(key: string): string {
  const descriptions: Record<string, string> = { artist: 'Ajoutez un artiste rencontré au studio, même sans compte en ligne.', service: 'Le tarif sera conservé comme instantané dans les commandes futures.', appointment: 'Les demandes sont vérifiées par le manager avant réservation définitive.', project: 'Définissez le responsable et les étapes de production par défaut.', payment: 'Seuls les fonds réellement reçus et vérifiés doivent être enregistrés ici.', 'payment-claim': 'Le studio vérifiera la réception des fonds avant validation.', expense: 'Les écritures restent dans le journal et leur statut est suivi.', distribution: 'Suivez le traitement manuel de la sortie, sans connexion automatique aux plateformes.' };
  return descriptions[key] || '';
}

function Dashboard({ role, profileName, data, onNavigate }: { role: string; profileName: string; data: ReturnType<typeof useWorkspaceData>; onNavigate: (key: SectionKey) => void }) {
  const today = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const todaysAppointments = data.appointments.rows.filter((row) => row.startsAt && new Intl.DateTimeFormat('fr-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(row.startsAt.toDate()) === today);
  const upcoming = data.appointments.rows.filter((row) => ['confirmed', 'requested', 'awaiting_deposit'].includes(row.status)).slice(0, 5);
  const activeProjects = data.projects.rows.filter((row) => !['completed', 'on_hold'].includes(row.status));
  const paid = moneySum(data.payments.rows.filter((row) => row.status === 'approved'), (row) => row.amountXaf);
  const unpaidCommissions = moneySum(data.commissions.rows.filter((row) => row.status === 'due' && row.beneficiaryRole !== 'reserve'), (row) => row.amountXaf);
  const pageRoleTitle = role === 'manager' ? 'Pilotage du studio' : role === 'producer' ? 'Espace de production' : 'Votre espace artiste';
  return <>
    <PageHeader eyebrow={pageRoleTitle.toUpperCase()} title={`Bonjour ${profileName.split(' ')[0]}.`} subtitle={role === 'client' ? 'Retrouvez ici vos rendez-vous, vos projets et les informations de votre compte.' : 'Voici ce qui se passe au studio aujourd’hui.'} action={<span className="date-chip"><CalendarDays size={15} />{new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'full' }).format(new Date())}</span>} />
    <div className="dashboard-intro"><div><span className="eyebrow">YOUNG FOREVER RECORDS</span><h2>{role === 'client' ? 'Votre parcours musical, au même endroit.' : role === 'producer' ? 'Le travail du studio, sans perdre le fil.' : 'Une vision claire. Des décisions maîtrisées.'}</h2><p>{role === 'client' ? 'Demandez une séance, suivez l’avancement de vos productions et consultez vos paiements.' : 'Les informations sont partagées entre le manager, le producteur et les artistes, avec des accès adaptés à chaque rôle.'}</p></div><div className="intro-art"><AudioLines size={68} strokeWidth={1.1} /><span>STUDIO<br />SESSION</span></div></div>
    <div className="stat-grid">
      {role === 'manager' ? <>
        <StatCard label="Artistes / clients" value={String(data.artists.rows.length)} detail="Profils chargés" icon={Users} />
        <StatCard label="Rendez-vous aujourd’hui" value={String(todaysAppointments.length)} detail="Tous statuts confondus" icon={CalendarDays} tone="blue" />
        <StatCard label="Projets en cours" value={String(activeProjects.length)} detail="À suivre par l’équipe" icon={FolderKanban} tone="green" />
        <StatCard label="Encaissements chargés" value={formatXaf(paid)} detail="Historique des paiements visibles" icon={CircleDollarSign} tone="gold" />
        <StatCard label="Commissions à régler" value={formatXaf(unpaidCommissions)} detail="Manager et producteur" icon={Wallet} tone="purple" />
        <StatCard label="Demandes de paiement" value={String(data.submissions.rows.length)} detail="En attente de vérification" icon={ShieldCheck} tone="blue" />
      </> : role === 'producer' ? <>
        <StatCard label="Séances aujourd’hui" value={String(todaysAppointments.length)} detail="Votre planning" icon={CalendarDays} />
        <StatCard label="Projets affectés" value={String(data.projects.rows.length)} detail="Chargés dans votre espace" icon={FolderKanban} tone="blue" />
        <StatCard label="Étapes à terminer" value={String(data.projects.rows.reduce((sum, p) => sum + (p.steps || []).filter((s) => s.status !== 'done').length, 0))} detail="Toutes productions confondues" icon={Activity} tone="green" />
        <StatCard label="Commissions à régler" value={formatXaf(unpaidCommissions)} detail="Votre relevé" icon={Wallet} tone="purple" />
      </> : <>
        <StatCard label="Mes rendez-vous" value={String(data.appointments.rows.length)} detail="Demandes et séances" icon={CalendarDays} />
        <StatCard label="Mes projets" value={String(data.projects.rows.length)} detail="Productions suivies" icon={FolderKanban} tone="blue" />
        <StatCard label="Mes paiements" value={formatXaf(paid)} detail="Montants enregistrés" icon={CircleDollarSign} tone="green" />
      </>}
    </div>
    <div className="dashboard-columns">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">AGENDA</span><h3>{role === 'client' ? 'Mes prochains rendez-vous' : 'Prochains rendez-vous'}</h3></div><button className="text-link" onClick={() => onNavigate('appointments')}>Tout voir ↗</button></div>
        {upcoming.length ? <div className="appointment-list">{upcoming.map((row) => <div className="appointment-item" key={row.id}><div className="date-tile"><b>{row.startsAt?.toDate().toLocaleDateString('fr-FR', { timeZone: 'Africa/Douala', day: '2-digit' }) || '—'}</b><small>{row.startsAt?.toDate().toLocaleDateString('fr-FR', { timeZone: 'Africa/Douala', month: 'short' }) || ''}</small></div><div className="appointment-info"><b>{row.serviceName}</b><small>{row.artistName} · {row.startsAt?.toDate().toLocaleTimeString('fr-FR', { timeZone: 'Africa/Douala', hour: '2-digit', minute: '2-digit' })}</small></div><StatusPill value={row.status} /></div>)}</div> : <EmptyState title="Aucun rendez-vous à venir" text="Les prochaines demandes et séances apparaîtront ici." action={<Button onClick={() => onNavigate('appointments')}>Ouvrir les rendez-vous</Button>} />}
      </section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">PRODUCTION</span><h3>Projets à suivre</h3></div><button className="text-link" onClick={() => onNavigate('projects')}>Tout voir ↗</button></div>
        {activeProjects.length ? <div className="project-list">{activeProjects.slice(0, 5).map((row) => { const steps = row.steps || []; const progress = steps.length ? Math.round((steps.filter((s) => s.status === 'done').length / steps.length) * 100) : 0; return <div className="project-row" key={row.id}><div className="project-row-top"><div><b>{row.title}</b><small>{row.artistName} · {row.producerName}</small></div><span>{progress}%</span></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><div className="project-row-foot"><span>{row.clientProgress || 'Production en cours'}</span><StatusPill value={row.status} /></div></div>; })}</div> : <EmptyState title="Aucun projet en cours" text="Les projets actifs et leurs étapes apparaîtront ici." action={<Button onClick={() => onNavigate('projects')}>Voir les projets</Button>} />}
      </section>
    </div>
    <div className="quick-actions"><button onClick={() => onNavigate(role === 'client' ? 'appointments' : 'projects')}><span><Plus size={18} /></span><b>{role === 'client' ? 'Demander un rendez-vous' : 'Gérer les projets'}</b><small>{role === 'client' ? 'Choisir un service et un créneau' : 'Suivre la progression musicale'}</small></button><button onClick={() => onNavigate('services')}><span><FileMusic size={18} /></span><b>Catalogue des prestations</b><small>Services et tarifs du studio</small></button><button onClick={() => onNavigate('notifications')}><span><Bell size={18} /></span><b>Notifications</b><small>{data.notifications.rows.filter((n) => !n.readAt).length} non lues</small></button></div>
  </>;
}

function ArtistsPage({ rows, onAdd, onArchive, readOnly = false }: { rows: Artist[]; onAdd: () => void; onArchive: (row: Artist) => void; readOnly?: boolean }) {
  return <><PageHeader eyebrow="RÉPERTOIRE" title="Artistes & clients" subtitle={readOnly ? 'Les artistes associés à vos séances et productions.' : 'Les profils du studio, les informations de contact et l’historique de suivi.'} action={!readOnly ? <Button variant="primary" onClick={onAdd}><Plus size={16} /> Ajouter un artiste</Button> : undefined} />
    <div className="table-panel"><div className="table-head"><b>{rows.length} profils chargés</b><span>Les profils archivés restent consultables.</span></div><div className="table-scroll"><table><thead><tr><th>ARTISTE</th><th>CONTACT</th><th>SPÉCIALITÉ</th><th>ORIGINE</th><th>STATUT</th>{!readOnly && <th></th>}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><div className="person-cell"><span className="avatar pale">{(row.stageName || row.fullName).slice(0, 1).toUpperCase()}</span><div><b>{row.stageName || row.fullName}</b><small>{row.fullName}</small></div></div></td><td><span>{row.email || '—'}</span><small className="table-sub">{row.phone || '—'}</small></td><td>{row.genre || 'Non renseigné'}</td><td>{row.source === 'site' ? 'Inscription en ligne' : 'Ajout manuel'}</td><td><StatusPill value={row.status || 'active'} /></td>{!readOnly && <td><button className="icon-button" title={row.status === 'archived' ? 'Réactiver' : 'Archiver'} onClick={() => onArchive(row)}><Archive size={16} /></button></td>}</tr>)}</tbody></table></div>{!rows.length && <EmptyState title="Aucun profil pour le moment" text="Ajoutez les artistes rencontrés au studio ou attendez les premières inscriptions." />}</div>
  </>;
}

function ServicesPage({ role, rows, onAdd, onToggle }: { role: string; rows: Service[]; onAdd: () => void; onToggle: (row: Service) => void }) {
  return <><PageHeader eyebrow="OFFRE DU STUDIO" title={role === 'client' ? 'Prestations disponibles' : 'Catalogue des prestations'} subtitle="Les services, leurs tarifs, les conditions d’acompte et les règles de répartition." action={role === 'manager' ? <Button variant="primary" onClick={onAdd}><Plus size={16} /> Nouvelle prestation</Button> : undefined} />
    <div className="service-grid">{rows.map((row) => <article className="service-card" key={row.id}><div className="service-symbol"><Music2 size={19} /></div><span className="service-category">{row.category}</span><h3>{row.name}</h3><p>{row.description || 'Prestation proposée par le studio.'}</p><div className="service-meta"><b>{formatXaf(row.priceXaf)}</b><small>{row.durationMinutes ? `${row.durationMinutes} min` : 'Durée à convenir'} · Acompte {row.depositPercent}%</small></div>{role === 'manager' && <div className="service-card-foot"><StatusPill value={row.isActive ? 'active' : 'archived'} /><button className="text-link" onClick={() => onToggle(row)}>{row.isActive ? 'Désactiver' : 'Réactiver'}</button></div>}</article>)}</div>
    {!rows.length && <EmptyState title="Le catalogue est vide" text="Les prestations ajoutées par le manager apparaîtront ici." />}
  </>;
}

function AppointmentsPage({ role, rows, producers = [], onAdd, onConfirm, onCancel, onReschedule, onProgress }: { role: string; rows: Appointment[]; producers?: Array<{ uid: string; displayName: string }>; onAdd: () => void; onConfirm: (row: Appointment, producerUid?: string) => void; onCancel: (row: Appointment) => void; onReschedule: (row: Appointment) => void; onProgress: (row: Appointment, status: string) => void }) {
  const [view, setView] = useState<'day' | 'week' | 'month' | 'list'>('list');
  const [anchor, setAnchor] = useState(() => new Date());
  const [producerAssignments, setProducerAssignments] = useState<Record<string, string>>({});
  const start = new Date(anchor); start.setHours(0, 0, 0, 0);
  if (view === 'week') { const weekday = (start.getDay() + 6) % 7; start.setDate(start.getDate() - weekday); }
  if (view === 'month') start.setDate(1);
  const end = new Date(start);
  if (view === 'day') end.setDate(end.getDate() + 1);
  if (view === 'week') end.setDate(end.getDate() + 7);
  if (view === 'month') end.setMonth(end.getMonth() + 1);
  const visibleRows = view === 'list' ? rows : rows.filter((row) => row.startsAt && row.startsAt.toDate() >= start && row.startsAt.toDate() < end);
  return <><PageHeader eyebrow="CALENDRIER DU STUDIO" title={role === 'client' ? 'Mes rendez-vous' : role === 'producer' ? 'Mon calendrier de séances' : 'Rendez-vous'} subtitle="Demandes, confirmations et séances planifiées. Les créneaux confirmés sont protégés contre les chevauchements." action={role !== 'producer' ? <Button variant="primary" onClick={onAdd}><Plus size={16} /> {role === 'client' ? 'Demander un rendez-vous' : 'Ajouter une demande'}</Button> : undefined} />
    <div className="calendar-toolbar"><div className="view-switch">{(['day', 'week', 'month', 'list'] as const).map((item) => <button key={item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>{({ day: 'Jour', week: 'Semaine', month: 'Mois', list: 'Liste' } as const)[item]}</button>)}</div><div className="calendar-date-nav"><button onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - (view === 'week' ? 7 : view === 'month' ? 30 : 1)))}>←</button><b>{view === 'month' ? anchor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Africa/Douala' }) : formatDate(anchor)}</b><button onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + (view === 'week' ? 7 : view === 'month' ? 30 : 1)))}>→</button><button className="today-button" onClick={() => setAnchor(new Date())}>Aujourd’hui</button></div></div>
    <div className="table-panel"><div className="table-head"><b>{visibleRows.length} rendez-vous {view === 'list' ? 'chargés' : 'dans cette période'}</b><span>Heure locale : Africa/Douala · Créneaux de 15 minutes</span></div><div className="table-scroll"><table><thead><tr><th>DATE & HEURE</th><th>ARTISTE</th><th>PRESTATION</th><th>ACOMPTE</th><th>INTERVENANT</th><th>STATUT</th><th>ACTIONS</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.id}><td><b>{formatDate(row.startsAt)}</b><small className="table-sub">{row.startsAt?.toDate().toLocaleTimeString('fr-FR', { timeZone: 'Africa/Douala', hour: '2-digit', minute: '2-digit' })} – {row.endsAt?.toDate().toLocaleTimeString('fr-FR', { timeZone: 'Africa/Douala', hour: '2-digit', minute: '2-digit' })}</small></td><td>{row.artistName}</td><td>{row.serviceName}<small className="table-sub">{formatXaf(row.servicePriceXaf)}</small></td><td>{formatXaf(row.depositExpectedXaf)}<small className="table-sub">Payé : {formatXaf(row.amountPaidXaf || 0)}</small></td><td>{role === 'manager' && ['requested', 'awaiting_deposit', 'rescheduled'].includes(row.status) ? <select className="mini-select" value={producerAssignments[row.id] ?? row.producerUid ?? ''} onChange={(event) => setProducerAssignments((current) => ({ ...current, [row.id]: event.target.value }))}><option value="">À affecter</option>{producers.map((producer) => <option key={producer.uid} value={producer.uid}>{producer.displayName}</option>)}</select> : row.producerName || 'À affecter'}</td><td><StatusPill value={row.status} /></td><td><div className="row-actions">{role === 'manager' && ['requested', 'awaiting_deposit', 'rescheduled'].includes(row.status) && <button className="mini-action primary-mini" onClick={() => onConfirm(row, producerAssignments[row.id] || row.producerUid || undefined)} disabled={!navigator.onLine || !(producerAssignments[row.id] || row.producerUid)}>Confirmer</button>}{role === 'manager' && row.status === 'confirmed' && <button className="mini-action" onClick={() => onReschedule(row)} disabled={!navigator.onLine}>Déplacer</button>}{role === 'producer' && row.status === 'confirmed' && <button className="mini-action" onClick={() => onProgress(row, 'in_progress')}>Démarrer</button>}{(role === 'producer' || role === 'manager') && row.status === 'in_progress' && <button className="mini-action" onClick={() => onProgress(row, 'completed')}>Terminer</button>}{(role === 'manager' || (role === 'client' && row.status === 'requested')) && !['cancelled', 'completed'].includes(row.status) && <button className="icon-button danger-icon" title="Annuler" onClick={() => onCancel(row)}><X size={15} /></button>}</div></td></tr>)}</tbody></table></div>{!rows.length && <EmptyState title="Aucun rendez-vous enregistré" text="Les demandes du site et les séances planifiées seront affichées ici." />}</div>
  </>;
}

function ProjectsPage({ role, rows, onAdd, onStep, onNote }: { role: string; rows: MusicProject[]; onAdd: () => void; onStep: (project: MusicProject, stepId: string, status: string) => void; onNote: (project: MusicProject) => void }) {
  return <><PageHeader eyebrow="PRODUCTION MUSICALE" title={role === 'client' ? 'Mes projets' : 'Projets musicaux'} subtitle="Suivez chaque production, de la préparation jusqu’à la livraison finale." action={role === 'manager' ? <Button variant="primary" onClick={onAdd}><Plus size={16} /> Créer un projet</Button> : undefined} />
    <div className="projects-grid">{rows.map((project) => { const steps = project.steps || []; const done = steps.filter((s) => s.status === 'done').length; const progress = steps.length ? Math.round(done / steps.length * 100) : 0; return <article className="project-card" key={project.id}><div className="project-cover"><span><AudioLines size={31} /></span><small>{project.type.toUpperCase()}</small></div><div className="project-card-body"><div className="project-card-title"><div><h3>{project.title}</h3><p>{project.artistName}</p></div><StatusPill value={project.status} /></div><div className="project-detail-line"><span>Producteur</span><b>{project.producerName || 'À affecter'}</b></div><div className="project-detail-line"><span>Livraison cible</span><b>{formatDate(project.targetDate)}</b></div><div className="project-progress-label"><span>Progression</span><b>{progress}%</b></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div>{role === 'client' ? <p className="client-progress-note">{project.clientProgress || 'Votre production est enregistrée.'}</p> : <div className="step-list">{steps.map((step) => <div className="step-row" key={step.id}><span className={step.status === 'done' ? 'step-check done' : 'step-check'}>{step.status === 'done' ? <Check size={12} /> : null}</span><span>{step.name}</span>{role === 'producer' && <select aria-label={`Statut ${step.name}`} value={step.status} onChange={(e) => onStep(project, step.id, e.target.value)}><option value="todo">À faire</option><option value="in_progress">En cours</option><option value="done">Terminé</option></select>}</div>)}</div>}{role !== 'client' && <div className="project-actions"><button className="text-link" onClick={() => onNote(project)}>+ Note technique interne</button></div>}</div></article>; })}</div>
    {!rows.length && <EmptyState title="Aucun projet musical" text="Les projets créés par le manager apparaîtront ici. Les clients verront uniquement les projets qui leur appartiennent." />}
  </>;
}

function PaymentsPage({ role, rows, submissions, onAdd, onProcess, onReverse }: { role: string; rows: Array<Payment | PaymentReceipt>; submissions: any[]; onAdd: () => void; onProcess: (row: any) => void; onReverse: (row: Payment) => void }) {
  const total = moneySum(rows.filter((row) => row.status === 'approved'), (row) => row.amountXaf);
  const reversed = moneySum(rows.filter((row) => Boolean(row.reversesPaymentId)), (row) => Math.abs(row.amountXaf));
  return <><PageHeader eyebrow="SUIVI DES ENCAISSEMENTS" title={role === 'client' ? 'Mes paiements' : 'Paiements & facturation'} subtitle="Historique des paiements, acomptes, déclarations et soldes enregistrés." action={<Button variant="primary" onClick={onAdd}><Plus size={16} /> {role === 'client' ? 'Déclarer un paiement' : 'Enregistrer un paiement'}</Button>} />
    <div className="finance-summary"><div><span>Total encaissé</span><b>{formatXaf(total)}</b><small>Écritures validées affichées</small></div><div><span>Corrections / annulations</span><b>{formatXaf(reversed)}</b><small>Conservées dans le registre</small></div><div><span>Déclarations en attente</span><b>{submissions.filter((row) => row.status === 'pending').length}</b><small>À vérifier par le manager</small></div></div>
    {role === 'manager' && submissions.length > 0 && <section className="panel pending-panel"><div className="panel-heading"><div><span className="eyebrow">À VÉRIFIER</span><h3>Déclarations de paiement</h3></div><StatusPill value="pending" /></div>{submissions.map((row) => <div className="pending-row" key={row.id}><div><b>{formatXaf(row.amountXaf)}</b><small>{row.method} · {row.reference || 'Sans référence'} · {row.ownerUid.slice(0, 8)}…</small></div><Button variant="primary" onClick={() => onProcess(row)}>Vérifier & enregistrer</Button></div>)}</section>}
    <div className="table-panel"><div className="table-head"><b>Registre des paiements ({rows.length})</b><span>Les écritures validées ne sont jamais supprimées.</span></div><div className="table-scroll"><table><thead><tr><th>DATE</th><th>ARTISTE</th><th>RÉFÉRENCE</th><th>MONTANT</th>{role === 'manager' && <th>FRAIS DIRECTS</th>}{role === 'manager' && <th>SOMMES TIERS</th>}{role === 'manager' && <th>BASE PARTAGEABLE</th>}<th>MODE</th><th>STATUT</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{formatDate(row.paidAt || row.createdAt)}</td><td>{row.artistName}</td><td>{row.reference || '—'}</td><td><b>{formatXaf(row.amountXaf)}</b></td>{role === 'manager' && <td>{formatXaf((row as Payment).directCostsXaf || 0)}</td>}{role === 'manager' && <td>{formatXaf((row as Payment).thirdPartyAmountXaf || 0)}</td>}{role === 'manager' && <td>{formatXaf((row as Payment).shareableAmountXaf || 0)}</td>}<td>{paymentMethodLabel(row.method)}</td><td><StatusPill value={row.status} /></td><td>{role === 'manager' && row.status === 'approved' && <button className="text-link" onClick={() => onReverse(row as Payment)}>Corriger</button>}</td></tr>)}</tbody></table></div>{!rows.length && <EmptyState title="Aucun paiement enregistré" text="Les paiements validés ou vos déclarations apparaîtront ici." />}</div>
    {role === 'client' && submissions.length > 0 && <p className="small-note">Vos déclarations sont en attente de vérification. Elles ne sont pas comptabilisées comme recettes tant que le manager ne les a pas validées.</p>}
  </>;
}

function ExpensesPage({ role, rows, onAdd, onStatus }: { role: string; rows: Expense[]; onAdd: () => void; onStatus: (row: Expense, status: string) => void }) {
  return <><PageHeader eyebrow="CHARGES & DÉPENSES" title={role === 'producer' ? 'Dépenses à déclarer' : 'Dépenses du studio'} subtitle="Suivez les charges générales financées par la réserve et les frais directs imputables à une prestation." action={<Button variant="primary" onClick={onAdd}><Plus size={16} /> Déclarer une dépense</Button>} />
    <div className="table-panel"><div className="table-head"><b>{rows.length} dépenses chargées</b><span>Total déclaré : {formatXaf(moneySum(rows, (row) => row.amountXaf))}</span></div><div className="table-scroll"><table><thead><tr><th>DATE</th><th>LIBELLÉ</th><th>CATÉGORIE</th><th>TRAITEMENT</th><th>DÉCLARANT</th><th>MONTANT</th><th>STATUT</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{formatDate(row.createdAt)}</td><td><b>{row.label}</b><small className="table-sub">{row.reason || '—'}</small></td><td>{row.category}</td><td>{row.treatment === 'direct' ? 'Frais directs' : 'Charge générale'}</td><td>{row.submittedByName}</td><td><b>{formatXaf(row.amountXaf)}</b></td><td><StatusPill value={row.status} /></td><td>{(role === 'manager' || (role === 'producer' && row.status === 'joint_required')) && <div className="row-actions">{role === 'manager' && row.status === 'approved' && <button className="mini-action" onClick={() => onStatus(row, 'paid')}>Marquer payé</button>}{role === 'manager' && ['declared', 'to_approve'].includes(row.status) && <button className="text-link" onClick={() => onStatus(row, 'approved')}>Valider</button>}{role === 'manager' && row.status === 'joint_required' && !row.managerApprovedBy && <button className="text-link" onClick={() => onStatus(row, 'approved')}>Co-signer</button>}{role === 'producer' && row.status === 'joint_required' && !row.producerApprovedBy && <button className="text-link" onClick={() => onStatus(row, 'approved')}>Co-signer</button>}</div>}</td></tr>)}</tbody></table></div>{!rows.length && <EmptyState title="Aucune dépense enregistrée" text="Les dépenses déclarées par l’équipe seront consultables ici." />}</div>
  </>;
}

function CommissionsPage({ role, rows, onPaid }: { role: string; rows: CommissionEntry[]; onPaid: (row: CommissionEntry) => void }) {
  const due = moneySum(rows.filter((row) => row.status === 'due'), (row) => row.amountXaf);
  const settled = moneySum(rows.filter((row) => row.status === 'paid' || row.status === 'retained' || row.status === 'reversed'), (row) => row.amountXaf);
  return <><PageHeader eyebrow="RÉPARTITION FINANCIÈRE" title={role === 'producer' ? 'Mon relevé de commissions' : 'Commissions & réserve'} subtitle="Chaque paiement validé produit des écritures distinctes, historisées et rattachées à la règle applicable." />
    <div className="finance-summary"><div><span>À régler</span><b>{formatXaf(due)}</b><small>Commissions individuelles dues</small></div><div><span>Réglées / réserve / corrections</span><b>{formatXaf(settled)}</b><small>Les écritures inverses neutralisent les paiements corrigés</small></div><div><span>Écritures</span><b>{rows.length}</b><small>Écritures visibles selon votre rôle</small></div></div>
    <div className="table-panel"><div className="table-head"><b>Journal de répartition</b><span>Les montants sont calculés en FCFA entiers, le reliquat d’arrondi va à la réserve.</span></div><div className="table-scroll"><table><thead><tr><th>DATE</th><th>BÉNÉFICIAIRE</th><th>PAIEMENT</th><th>VERSION</th><th>MONTANT</th><th>STATUT</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{formatDate(row.createdAt)}</td><td>{row.beneficiaryRole === 'manager' ? 'Manager' : row.beneficiaryRole === 'producer' ? 'Producteur' : 'Réserve du studio'}</td><td>{row.paymentId.slice(0, 10)}…</td><td>{row.rateVersion}</td><td><b>{formatXaf(row.amountXaf)}</b></td><td><StatusPill value={row.status} /></td><td>{role === 'manager' && row.status === 'due' && row.beneficiaryRole !== 'reserve' && <button className="mini-action" onClick={() => onPaid(row)}>Marquer réglée</button>}</td></tr>)}</tbody></table></div>{!rows.length && <EmptyState title="Aucune commission calculée" text="Les parts apparaîtront après la validation du premier paiement." />}</div>
  </>;
}

function DistributionPage({ role, rows, onAdd, onStatus }: { role: string; rows: any[]; onAdd: () => void; onStatus: (row: any, status: string) => void }) {
  const statuses = ['draft', 'ready', 'submitted', 'checking', 'accepted', 'published', 'rejected', 'withdrawn'];
  return <><PageHeader eyebrow="DISTRIBUTION NUMÉRIQUE" title="Suivi des sorties" subtitle="Registre des demandes, métadonnées et statuts de distribution. La publication est confirmée manuellement." action={role === 'manager' ? <Button variant="primary" onClick={onAdd}><Plus size={16} /> Nouvelle distribution</Button> : undefined} />
    <div className="table-panel"><div className="table-head"><b>{rows.length} commandes chargées</b><span>Les redevances de plateformes ne sont pas suivies ici.</span></div><div className="table-scroll"><table><thead><tr><th>ARTISTE</th><th>SORTIE</th><th>TYPE</th><th>DISTRIBUTEUR</th><th>TARIF DU SERVICE</th><th>STATUT</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.artistName}</td><td><b>{row.releaseTitle}</b><small className="table-sub">{row.platforms || 'Plateformes à préciser'}</small></td><td>{row.releaseType}</td><td>{row.distributor || '—'}</td><td>{formatXaf(row.priceXaf || 0)}</td><td><StatusPill value={row.status} /></td><td>{role === 'manager' && <select className="mini-select" value={row.status} onChange={(e) => onStatus(row, e.target.value)}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>}</td></tr>)}</tbody></table></div>{!rows.length && <EmptyState title="Aucune sortie à suivre" text="Les commandes de distribution apparaîtront ici une fois créées." />}</div>
  </>;
}

function ReportsPage({ data }: { data: ReturnType<typeof useWorkspaceData> }) {
  const income = data.payments.rows.filter((row) => row.status === 'approved');
  const expenses = data.expenses.rows.filter((row) => ['approved', 'paid'].includes(row.status));
  const totalIncome = moneySum(income, (row) => row.amountXaf - (Number((row as Payment).thirdPartyAmountXaf) || 0));
  const totalCosts = moneySum(expenses, (row) => row.amountXaf);
  const commissionTotal = moneySum(data.commissions.rows.filter((row) => row.beneficiaryRole !== 'reserve'), (row) => row.amountXaf);
  return <><PageHeader eyebrow="ANALYSE D’ACTIVITÉ" title="Rapports du studio" subtitle="Synthèse calculée à partir des enregistrements Firestore actuellement chargés. Les listes restent limitées pour préserver les performances." action={<Button onClick={() => csvExport('music-house-bta-rapport.csv', [
    ...income.map((row) => ({ type: 'Recette de service', date: formatDate(row.paidAt), nom: row.artistName, montant: row.amountXaf - (Number((row as Payment).thirdPartyAmountXaf) || 0), sommes_tiers: Number((row as Payment).thirdPartyAmountXaf) || 0, frais_directs: Number((row as Payment).directCostsXaf) || 0, statut: row.status })),
    ...expenses.map((row) => ({ type: 'Dépense', date: formatDate(row.createdAt), nom: row.label, montant: -row.amountXaf, statut: row.status })),
  ])}><Download size={16} /> Export CSV</Button>} />
    <div className="stat-grid report-stats"><StatCard label="Recettes encaissées" value={formatXaf(totalIncome)} detail="Encaissements de service, hors sommes pour compte de tiers" icon={ArrowUpRight} tone="green" /><StatCard label="Dépenses approuvées" value={formatXaf(totalCosts)} detail="Charges générales et frais directs" icon={ArrowDownRight} tone="red" /><StatCard label="Commissions" value={formatXaf(commissionTotal)} detail="Parts manager et producteur" icon={Wallet} tone="purple" /><StatCard label="Solde après dépenses" value={formatXaf(totalIncome - totalCosts)} detail="Indicateur simplifié, non comptable" icon={CircleDollarSign} /></div>
    <div className="report-note"><AlertCircle size={17} /><p>Les rapports V1 sont des outils de pilotage opérationnel, pas une comptabilité certifiée. Les chiffres ci-dessus portent sur les enregistrements chargés dans les modules (limite de 300 documents par vue). Utilisez les exports et les historiques complets Firestore pour les clôtures.</p></div>
  </>;
}

function SettingsPage({ rates, onInitialize, onSave, onClearCache }: { rates: RateSet | null; onInitialize: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void; onClearCache: () => void }) {
  return <><PageHeader eyebrow="CONFIGURATION DU STUDIO" title="Paramètres" subtitle="Règles opérationnelles, répartition des recettes et confidentialité locale." />
    {!rates ? <section className="settings-card"><div className="settings-card-header"><div><h3>Répartitions financières</h3><p>Initialisez les taux convenus dans le cahier des charges V1.</p></div><Button variant="primary" onClick={onInitialize}><CheckCircle2 size={16} /> Initialiser les taux V1</Button></div><div className="rate-defaults"><div><b>Studio</b><span>Manager 25 % · Producteur 50 % · Réserve 25 %</span></div><div><b>Distribution</b><span>Manager 70 % · Producteur 20 % · Réserve 10 %</span></div></div></section> : <form className="settings-card" onSubmit={onSave}><div className="settings-card-header"><div><h3>Répartitions des recettes</h3><p>Version actuellement chargée : <b>{rates.version}</b>. Les nouveaux taux ne modifient pas les paiements antérieurs.</p></div><Button type="submit" variant="primary"><Check size={16} /> Enregistrer les taux</Button></div><div className="rate-groups"><RateGroup title="Prestations ordinaires du studio" prefix="studio" value={rates.studio} /><RateGroup title="Distribution numérique" prefix="dist" value={rates.distribution} /></div><div className="threshold-field"><label>Seuil d’autorisation des dépenses exceptionnelles (FCFA)<input className="field" name="expenseThreshold" type="number" min="0" step="1" defaultValue={rates.expenseApprovalThresholdXaf ?? ''} /></label><p className="small-note">Laissez vide pour imposer deux validations distinctes des dépenses signalées comme exceptionnelles. Au-dessus du seuil défini, une validation du manager et une du producteur sont requises.</p></div><div className="form-hint">La somme doit être exactement égale à 100 % pour chaque catégorie. Les calculs sont en montants XAF entiers et le reliquat est affecté à la réserve.</div></form>}
    <section className="settings-card"><div className="settings-card-header"><div><h3>Cache hors connexion</h3><p>La persistance IndexedDB doit être réservée à un appareil personnel. Les appareils non approuvés utilisent le cache mémoire.</p></div><StatusPill value={typeof localStorage !== 'undefined' && localStorage.getItem('mhb_trusted_device') === 'yes' ? 'active' : 'pending'} /></div><div className="settings-actions"><Button onClick={onClearCache} variant="danger">Effacer le cache local et recharger</Button><span className="small-note">Sur un appareil partagé, déconnectez-vous et effacez les données locales du navigateur.</span></div></section>
    <section className="settings-card"><div className="settings-card-header"><div><h3>Fuseau et devise</h3><p>Fuseau d’affichage : Africa/Douala · Devise : franc CFA (XAF).</p></div><span className="setting-fixed">Valeurs du cahier des charges</span></div></section>
  </>;
}

function RateGroup({ title, prefix, value }: { title: string; prefix: string; value: { manager: number; producer: number; reserve: number } }) {
  return <div className="rate-group"><h4>{title}</h4><div className="rate-inputs"><Field label="Manager (%)"><TextInput name={`${prefix === 'dist' ? 'dist' : 'studio'}Manager`} type="number" min="0" max="100" defaultValue={value.manager} required /></Field><Field label="Producteur (%)"><TextInput name={`${prefix === 'dist' ? 'dist' : 'studio'}Producer`} type="number" min="0" max="100" defaultValue={value.producer} required /></Field><Field label="Réserve (%)"><TextInput name={`${prefix === 'dist' ? 'dist' : 'studio'}Reserve`} type="number" min="0" max="100" defaultValue={value.reserve} required /></Field></div></div>;
}

function NotificationsPage({ rows, onRead }: { rows: NotificationItem[]; onRead: (row: NotificationItem) => void }) {
  return <><PageHeader eyebrow="CENTRE D’INFORMATION" title="Notifications" subtitle="Les alertes qui vous concernent : rendez-vous, paiements et avancement des projets." />
    <div className="notification-list">{rows.map((row) => <article className={`notification-item ${row.readAt ? 'read' : 'unread'}`} key={row.id}><span className="notification-symbol"><Bell size={17} /></span><div className="notification-content"><b>{row.title}</b><p>{row.message}</p><small>{formatDate(row.createdAt, { hour: '2-digit', minute: '2-digit' })}</small></div>{!row.readAt && <Button onClick={() => onRead(row)}><Check size={14} /> Marquer comme lu</Button>}</article>)}</div>
    {!rows.length && <EmptyState title="Tout est calme pour le moment" text="Les alertes qui vous sont destinées apparaîtront ici." />}
  </>;
}

function ProfilePage({ profile, onSaved, onError }: { profile: Artist | null; onSaved: () => void; onError: (message: string) => void }) {
  if (!profile) return <EmptyState title="Votre profil artistique n’est pas encore disponible" text="Reconnectez-vous. Si le problème persiste, contactez le manager du studio." />;
  const artistProfile = profile;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      await updateDoc(doc(db!, 'artists', artistProfile.id), {
        fullName: String(form.get('fullName') || '').trim(), stageName: String(form.get('stageName') || '').trim(),
        phone: String(form.get('phone') || '').trim(), city: String(form.get('city') || '').trim(),
        genre: String(form.get('genre') || '').trim(), bio: String(form.get('bio') || '').trim(),
        updatedAt: serverTimestamp(),
      });
      onSaved();
    } catch (error) { onError(error instanceof Error ? error.message : 'Mise à jour impossible.'); }
  }
  return <><PageHeader eyebrow="VOTRE IDENTITÉ ARTISTIQUE" title="Mon profil" subtitle="Gardez vos informations personnelles et artistiques à jour pour faciliter le suivi de vos projets." />
    <form className="profile-form panel" onSubmit={save}><div className="profile-card-heading"><span className="profile-avatar"><UserRound size={26} /></span><div><h3>{profile.stageName || profile.fullName}</h3><p>{profile.email || 'E-mail non renseigné'} · Compte client</p></div></div><div className="form-grid"><Field label="Nom et prénom" required><TextInput name="fullName" defaultValue={profile.fullName} required /></Field><Field label="Nom de scène"><TextInput name="stageName" defaultValue={profile.stageName || ''} /></Field><Field label="Téléphone"><TextInput name="phone" defaultValue={profile.phone || ''} /></Field><Field label="Ville"><TextInput name="city" defaultValue={profile.city || ''} /></Field><Field label="Genre musical"><TextInput name="genre" defaultValue={profile.genre || ''} /></Field><div className="span-two"><Field label="Présentation"><TextArea name="bio" defaultValue={profile.bio || ''} rows={4} /></Field></div><div className="span-two modal-actions"><Button variant="primary" type="submit">Enregistrer mon profil</Button></div></div></form>
  </>;
}

function paymentMethodLabel(value: string): string {
  return ({ cash: 'Espèces', mtn_momo: 'MTN MoMo', orange_money: 'Orange Money', transfer: 'Virement', other: 'Autre' } as Record<string, string>)[value] || value;
}
