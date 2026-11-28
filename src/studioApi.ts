import { auth } from './firebase';

export async function callStudioApi(action: string, payload: Record<string, unknown> = {}): Promise<any> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Votre session a expiré. Reconnectez-vous.');
  const token = await user.getIdToken();
  const response = await fetch('/api/studio', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success !== true) {
    throw new Error(result.error || 'Le service du studio est momentanément indisponible.');
  }
  return result.result;
}

export async function notifyStudioEmail(action: string, payload: Record<string, unknown> = {}): Promise<boolean> {
  try {
    await callStudioApi(action, payload);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[MUSIC HOUSE EMAIL]', message);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('music-house-email-error', { detail: message }));
    }
    return false;
  }
}
