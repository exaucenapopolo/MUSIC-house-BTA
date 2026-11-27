import type { RateSet, SplitType } from './domain';

export interface Shares {
  manager: number;
  producer: number;
  reserve: number;
}

function assertWholeXaf(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} doit être un montant XAF entier positif ou nul.`);
  }
}

export function validateRates(rates: RateSet): void {
  for (const type of ['studio', 'distribution'] as const) {
    const entries = rates[type];
    const values = [entries.manager, entries.producer, entries.reserve];
    if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 100)) {
      throw new Error(`Les pourcentages ${type} doivent être des entiers entre 0 et 100.`);
    }
    if (values.reduce((sum, value) => sum + value, 0) !== 100) {
      throw new Error(`La répartition ${type} doit totaliser exactement 100 %.`);
    }
  }
}

/** Allocates a cumulative shareable amount. The reserve receives every FCFA of rounding remainder. */
export function allocateShares(baseXaf: number, rates: RateSet, type: SplitType): Shares {
  assertWholeXaf(baseXaf, 'La base partageable');
  validateRates(rates);
  const selected = rates[type];
  // Divide before multiplying to keep every intermediate integer within Number.MAX_SAFE_INTEGER.
  const wholeHundreds = Math.floor(baseXaf / 100);
  const remainder = baseXaf % 100;
  const manager = wholeHundreds * selected.manager + Math.floor((remainder * selected.manager) / 100);
  const producer = wholeHundreds * selected.producer + Math.floor((remainder * selected.producer) / 100);
  const reserve = baseXaf - manager - producer;
  return { manager, producer, reserve };
}

/** Returns the incremental shares to post after previous validated payments for this allocation key. */
export function calculateShareDeltas(
  cumulativeBaseXaf: number,
  previousShares: Shares,
  rates: RateSet,
  type: SplitType,
): Shares {
  const target = allocateShares(cumulativeBaseXaf, rates, type);
  const delta = {
    manager: target.manager - previousShares.manager,
    producer: target.producer - previousShares.producer,
    reserve: target.reserve - previousShares.reserve,
  };
  if (Object.values(delta).some((value) => value < 0)) {
    throw new Error('Les commissions existantes dépassent la répartition attendue. Vérifiez le registre avant de continuer.');
  }
  return delta;
}

export function shareableAmount(amountXaf: number, directCostsXaf: number, thirdPartyAmountXaf = 0): number {
  assertWholeXaf(amountXaf, 'Le paiement');
  assertWholeXaf(directCostsXaf, 'Les frais directs');
  assertWholeXaf(thirdPartyAmountXaf, 'Le montant dû à un tiers');
  if (directCostsXaf + thirdPartyAmountXaf > amountXaf) {
    throw new Error('Les frais directs et les sommes dues à des tiers ne peuvent pas dépasser le paiement.');
  }
  return amountXaf - directCostsXaf - thirdPartyAmountXaf;
}
