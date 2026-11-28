import { describe, expect, it } from 'vitest';

describe('modules API Vercel', () => {
  it('charge les handlers serveur du studio et des paiements sans exécuter de requête', async () => {
    const [studio, payments] = await Promise.all([
      import('../api/studio.js'),
      import('../api/payments.js'),
    ]);
    expect(typeof studio.default).toBe('function');
    expect(typeof payments.default).toBe('function');
  });
});
