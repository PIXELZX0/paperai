import { describe, expect, it } from "vitest";
import { evaluateBudget } from "./budget.js";

describe("evaluateBudget", () => {
  it("allows unlimited budgets when limit is zero", () => {
    expect(evaluateBudget({ limitCents: 0, spentCents: 1000 }).allowed).toBe(true);
  });

  it("blocks when spend exceeds the limit", () => {
    expect(evaluateBudget({ limitCents: 100, spentCents: 100 }).allowed).toBe(false);
  });

  it("blocks charges that would exceed the remaining budget", () => {
    expect(evaluateBudget({ limitCents: 500, spentCents: 450, nextChargeCents: 100 })).toMatchObject({
      allowed: false,
      reason: "insufficient_headroom",
    });
  });
});
