import { describe, expect, it } from 'vitest';
import { DEFAULT_RATES } from '../src/domain';
import { allocateShares, calculateShareDeltas, shareableAmount, validateRates } from '../src/financial';

describe('répartitions financières V1', () => {
  it('répartit 100 000 XAF en studio : 25/50/25', () => {
    expect(allocateShares(100_000, DEFAULT_RATES, 'studio')).toEqual({ manager: 25_000, producer: 50_000, reserve: 25_000 });
  });

  it('répartit 5 000 XAF en distribution : 70/20/10', () => {
    expect(allocateShares(5_000, DEFAULT_RATES, 'distribution')).toEqual({ manager: 3_500, producer: 1_000, reserve: 500 });
  });

  it('attribue intégralement le reliquat d’arrondi à la réserve', () => {
    expect(allocateShares(101, DEFAULT_RATES, 'studio')).toEqual({ manager: 25, producer: 50, reserve: 26 });
    expect(allocateShares(101, DEFAULT_RATES, 'distribution')).toEqual({ manager: 70, producer: 20, reserve: 11 });
  });

  it('fractionne les encaissements sans double commission ni perte d’arrondi', () => {
    const first = calculateShareDeltas(33_333, { manager: 0, producer: 0, reserve: 0 }, DEFAULT_RATES, 'studio');
    const second = calculateShareDeltas(100_000, first, DEFAULT_RATES, 'studio');
    expect({ manager: first.manager + second.manager, producer: first.producer + second.producer, reserve: first.reserve + second.reserve })
      .toEqual(allocateShares(100_000, DEFAULT_RATES, 'studio'));
  });

  it('déduit uniquement les frais directs documentés de la base partageable', () => {
    expect(shareableAmount(20_000, 3_500)).toBe(16_500);
    expect(shareableAmount(20_000, 3_500, 5_000)).toBe(11_500);
    expect(() => shareableAmount(1_000, 500, 501)).toThrow();
    expect(() => shareableAmount(1_000, 1_001)).toThrow();
    expect(() => shareableAmount(1_000.5, 0)).toThrow();
  });

  it('refuse une répartition qui ne totalise pas 100 %', () => {
    expect(() => validateRates({ ...DEFAULT_RATES, studio: { manager: 25, producer: 50, reserve: 24 } })).toThrow(/100 %/);
  });

  it('reste exact pour les entiers XAF proches de la limite sûre', () => {
    const base = Number.MAX_SAFE_INTEGER;
    const shares = allocateShares(base, DEFAULT_RATES, 'studio');
    expect(shares.manager + shares.producer + shares.reserve).toBe(base);
  });
});
