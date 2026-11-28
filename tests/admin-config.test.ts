import { describe, expect, it } from 'vitest';
import { getServiceAccountFromEnv, parseServiceAccountJson } from '../api/_lib/admin.js';

const privateKey = '-----BEGIN PRIVATE KEY-----\nABCDEF\n-----END PRIVATE KEY-----\n';
const account = {
  type: 'service_account',
  project_id: 'music-house-bta',
  private_key_id: 'test-key-id',
  private_key: privateKey,
  client_email: 'firebase-adminsdk@example.iam.gserviceaccount.com',
  token_uri: 'https://oauth2.googleapis.com/token',
};

describe('configuration Firebase Admin', () => {
  it('parse le JSON avant de normaliser les sauts de ligne de la clé privée', () => {
    const parsed = parseServiceAccountJson(JSON.stringify(account));
    expect(parsed.project_id).toBe('music-house-bta');
    expect(parsed.private_key).toBe('-----BEGIN PRIVATE KEY-----\nABCDEF\n-----END PRIVATE KEY-----');
  });
  it('accepte le nom historique FIREBASE_SERVICE_ACCOUNT', () => {
    const parsed = getServiceAccountFromEnv({
      FIREBASE_SERVICE_ACCOUNT: JSON.stringify(account), FIREBASE_PROJECT_ID: 'music-house-bta',
    });
    expect(parsed.client_email).toBe(account.client_email);
  });
  it('donne la priorité à FIREBASE_SERVICE_ACCOUNT_KEY', () => {
    const parsed = getServiceAccountFromEnv({
      FIREBASE_SERVICE_ACCOUNT_KEY: JSON.stringify(account),
      FIREBASE_SERVICE_ACCOUNT: '{not-json}', FIREBASE_PROJECT_ID: 'music-house-bta',
    });
    expect(parsed.project_id).toBe('music-house-bta');
  });
  it('refuse une clé provenant d’un autre projet Firebase', () => {
    expect(() => getServiceAccountFromEnv({
      FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ ...account, project_id: 'another-project' }),
      FIREBASE_PROJECT_ID: 'music-house-bta',
    })).toThrow(/appartient au projet/);
  });
  it('explique quelles variables sont requises si le compte est absent', () => {
    expect(() => getServiceAccountFromEnv({})).toThrow(/FIREBASE_SERVICE_ACCOUNT_KEY ou FIREBASE_SERVICE_ACCOUNT/);
  });
  it('refuse un JSON valide qui n’est pas un compte de service complet', () => {
    expect(() => parseServiceAccountJson(JSON.stringify({ type: 'service_account' }))).toThrow(/champs type/);
  });
});
