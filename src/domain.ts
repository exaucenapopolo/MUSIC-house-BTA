import type { Timestamp } from 'firebase/firestore';

export type Role = 'manager' | 'producer' | 'client';
export type SplitType = 'studio' | 'distribution';
export type PaymentMethod = 'cash' | 'mtn_momo' | 'orange_money' | 'transfer' | 'fapshi' | 'other';
export type AppointmentStatus =
  | 'requested' | 'awaiting_deposit' | 'confirmed' | 'in_progress'
  | 'completed' | 'cancelled' | 'no_show' | 'rescheduled'
  | 'rejected' | 'expired' | 'payment_review';
export type ProjectStatus = 'planning' | 'in_progress' | 'waiting_client' | 'review' | 'completed' | 'on_hold';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  active: boolean;
  photoURL?: string;
  artistId?: string;
  createdAt?: Timestamp;
}

export interface Artist {
  id: string;
  ownerUid?: string | null;
  fullName: string;
  stageName?: string;
  email?: string;
  phone?: string;
  city?: string;
  genre?: string;
  bio?: string;
  photoURL?: string;
  socials?: string[];
  producerUids?: string[];
  status?: 'active' | 'archived';
  source?: 'site' | 'manual';
  createdAt?: Timestamp;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
  priceXaf: number;
  durationMinutes?: number;
  depositPercent: number;
  discountPercent?: number;
  allowFullPayment?: boolean;
  imageUrl?: string;
  youtubeUrl?: string;
  highlights?: string[];
  splitType: SplitType;
  isActive: boolean;
  createdAt?: Timestamp;
}

export interface StudioTeamMember {
  id: string;
  name: string;
  title: string;
  bio?: string;
  photoUrl?: string;
}

export interface StudioGalleryItem {
  id: string;
  url: string;
  caption?: string;
}

export interface StudioProfile {
  id: string;
  name: string;
  slogan?: string;
  description?: string;
  location?: string;
  logoUrl?: string;
  coverUrl?: string;
  whatsappNumber?: string;
  achievements?: string[];
  team?: StudioTeamMember[];
  gallery?: StudioGalleryItem[];
  updatedAt?: Timestamp;
}

export interface Appointment {
  id: string;
  ownerUid: string;
  artistId?: string;
  artistName: string;
  serviceId?: string;
  serviceName: string;
  servicePriceXaf: number;
  serviceOriginalPriceXaf?: number;
  discountPercent?: number;
  allowFullPayment?: boolean;
  depositExpectedXaf: number;
  depositPercent?: number;
  requestedDepositPercent?: number;
  amountPaidXaf: number;
  acceptedAt?: Timestamp;
  acceptedBy?: string;
  depositDeadlineAt?: Timestamp;
  rejectionReason?: string;
  producerUid?: string;
  producerName?: string;
  resourceId: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  status: AppointmentStatus;
  clientNote?: string;
  internalNote?: string;
  createdAt?: Timestamp;
}

export interface ProjectStep {
  id: string;
  name: string;
  status: 'todo' | 'in_progress' | 'done';
  updatedAt?: Timestamp;
}

export interface MusicProject {
  id: string;
  ownerUid: string;
  artistId?: string;
  artistName: string;
  title: string;
  type: string;
  producerUid: string;
  producerName: string;
  status: ProjectStatus;
  clientVisible: boolean;
  clientProgress: string;
  steps: ProjectStep[];
  priceXaf: number;
  targetDate?: Timestamp;
  createdAt?: Timestamp;
}

export interface Payment {
  id: string;
  ownerUid: string;
  artistName: string;
  projectId?: string;
  appointmentId?: string;
  allocationKey: string;
  splitType: SplitType;
  amountXaf: number;
  directCostsXaf: number;
  thirdPartyAmountXaf: number;
  shareableAmountXaf: number;
  method: PaymentMethod;
  reference?: string;
  status: 'approved' | 'reversed' | 'reversal';
  rateVersion: string;
  paidAt?: Timestamp;
  createdAt?: Timestamp;
  reversesPaymentId?: string;
}


export interface PaymentReceipt {
  id: string;
  ownerUid: string;
  artistName: string;
  projectId?: string;
  amountXaf: number;
  method: PaymentMethod;
  reference?: string;
  status: 'approved' | 'reversed';
  reversesPaymentId?: string;
  paidAt?: Timestamp;
  createdAt?: Timestamp;
}

export interface CommissionEntry {
  id: string;
  paymentId: string;
  allocationKey: string;
  rateVersion: string;
  beneficiaryRole: 'manager' | 'producer' | 'reserve';
  beneficiaryUid?: string | null;
  amountXaf: number;
  status: 'due' | 'paid' | 'retained' | 'reversed';
  createdAt?: Timestamp;
  paidAt?: Timestamp;
}

export interface Expense {
  id: string;
  label: string;
  category: string;
  amountXaf: number;
  treatment: 'general' | 'direct';
  status: 'declared' | 'to_approve' | 'joint_required' | 'approved' | 'paid' | 'rejected';
  jointApprovalRequired?: boolean;
  managerApprovedBy?: string | null;
  managerApprovedAt?: Timestamp;
  producerApprovedBy?: string | null;
  producerApprovedAt?: Timestamp;
  exceptional?: boolean;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  submittedBy: string;
  submittedByName: string;
  projectId?: string;
  reason?: string;
  createdAt?: Timestamp;
}

export interface RateSet {
  version: string;
  expenseApprovalThresholdXaf?: number | null;
  studio: { manager: number; producer: number; reserve: number };
  distribution: { manager: number; producer: number; reserve: number };
}

export interface NotificationItem {
  id: string;
  recipientUid: string;
  title: string;
  message: string;
  kind: string;
  readAt?: Timestamp | null;
  createdAt?: Timestamp;
}

export const DEFAULT_RATES: RateSet = {
  version: 'v1',
  studio: { manager: 25, producer: 50, reserve: 25 },
  distribution: { manager: 70, producer: 20, reserve: 10 },
};

export const DEFAULT_PROJECT_STEPS: ProjectStep[] = [
  { id: 'arrangement', name: 'Préparation / arrangement', status: 'todo' },
  { id: 'recording', name: 'Enregistrement', status: 'todo' },
  { id: 'mixing', name: 'Mixage', status: 'todo' },
  { id: 'mastering', name: 'Mastering', status: 'todo' },
  { id: 'quality', name: 'Vérification finale', status: 'todo' },
  { id: 'delivery', name: 'Livraison', status: 'todo' },
];

export const ROLE_LABELS: Record<Role, string> = {
  manager: 'Manager', producer: 'Producteur', client: 'Artiste / Client',
};

export function formatXaf(value: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;
}

export function formatDate(value?: Timestamp | Date | null, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : value.toDate();
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Douala', day: '2-digit', month: 'short', year: 'numeric', ...options,
  }).format(date);
}

export function timestampToDate(value?: Timestamp | null): Date | null {
  return value ? value.toDate() : null;
}
