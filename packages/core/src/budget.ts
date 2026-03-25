export interface BudgetGuardInput {
  limitCents: number;
  spentCents: number;
  nextChargeCents?: number;
}

export interface BudgetGuardResult {
  allowed: boolean;
  remainingCents: number;
  reason?: string;
}

export function evaluateBudget(input: BudgetGuardInput): BudgetGuardResult {
  const remainingCents = Math.max(0, input.limitCents - input.spentCents);
  const nextChargeCents = input.nextChargeCents ?? 0;

  if (input.limitCents <= 0) {
    return { allowed: true, remainingCents: Number.POSITIVE_INFINITY };
  }

  if (input.spentCents >= input.limitCents) {
    return { allowed: false, remainingCents: 0, reason: "budget_exhausted" };
  }

  if (nextChargeCents > remainingCents) {
    return { allowed: false, remainingCents, reason: "insufficient_headroom" };
  }

  return { allowed: true, remainingCents };
}
