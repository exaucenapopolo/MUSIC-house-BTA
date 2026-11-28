import { auth } from './firebase';

export type StudioPaymentAction = 'initiate' | 'verify';

export async function callPaymentApi(action: StudioPaymentAction, payload: Record<string, unknown>) {
  const user = auth?.currentUser;
  if (!user) throw new Error('Connectez-vous pour accéder au paiement.');
  const token = await user.getIdToken();
  const response = await fetch('/api/payments', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ ...payload, action }),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Le service de paiement est momentanément indisponible.');
  }
  return data.result as Record<string, unknown>;
}
