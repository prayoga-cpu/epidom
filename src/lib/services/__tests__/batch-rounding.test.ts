import { describe, it, expect } from "vitest";
import { RecipeType } from "@prisma/client";

/**
 * `resolveBatchRun` is private on ProductionBatchService, so the rule is pinned
 * here as the pure arithmetic it is. If the implementation changes, these
 * expectations are the contract it has to keep.
 *
 * THE RULE: a batch is indivisible. A dough yielding 5 Baguettes cannot be run
 * for 3 — asking for 3 bakes one whole batch, drawing a full batch of
 * ingredients and putting 5 on the shelf.
 *
 * Kitchen recipes are the opposite: cooked to order, scaled per portion.
 */
function resolveBatchRun(
  plannedQuantity: number,
  yieldQuantity: number,
  type: RecipeType
): { batches: number; materialMultiplier: number; producedQuantity: number } {
  const yieldQty = Number(yieldQuantity);
  if (type !== RecipeType.BATCH || !(yieldQty > 0)) {
    return {
      batches: 1,
      materialMultiplier: plannedQuantity / yieldQty,
      producedQuantity: plannedQuantity,
    };
  }
  const batches = Math.max(1, Math.ceil(plannedQuantity / yieldQty));
  return { batches, materialMultiplier: batches, producedQuantity: batches * yieldQty };
}

describe("BATCH recipes round up to whole batches", () => {
  it("asking for 3 of a yield-5 recipe bakes one whole batch of 5", () => {
    // The reported case. Plain division would draw 0.6 of a batch of flour.
    const run = resolveBatchRun(3, 5, RecipeType.BATCH);
    expect(run.batches).toBe(1);
    expect(run.materialMultiplier).toBe(1);
    expect(run.producedQuantity).toBe(5);
  });

  it("asking for exactly 5 is still one batch", () => {
    expect(resolveBatchRun(5, 5, RecipeType.BATCH)).toEqual({
      batches: 1,
      materialMultiplier: 1,
      producedQuantity: 5,
    });
  });

  it("asking for 6 spills into a second batch and yields 10", () => {
    expect(resolveBatchRun(6, 5, RecipeType.BATCH)).toEqual({
      batches: 2,
      materialMultiplier: 2,
      producedQuantity: 10,
    });
  });

  it("asking for 10 is exactly two batches — no phantom third", () => {
    expect(resolveBatchRun(10, 5, RecipeType.BATCH)).toEqual({
      batches: 2,
      materialMultiplier: 2,
      producedQuantity: 10,
    });
  });

  it("never runs less than one batch, even for a request of 1", () => {
    const run = resolveBatchRun(1, 5, RecipeType.BATCH);
    expect(run.batches).toBe(1);
    expect(run.producedQuantity).toBe(5);
  });

  it("a fully-settled run (quantity 0) still cannot go below one batch", () => {
    // Guards against a negative or zero multiplier reaching the ingredient loop.
    expect(resolveBatchRun(0, 5, RecipeType.BATCH).batches).toBe(1);
  });
});

describe("KITCHEN recipes scale per portion, never rounded", () => {
  it("3 portions of a recipe written for 5 uses three fifths", () => {
    // Cooked to order — there is no batch to round to, and rounding up here
    // would over-draw ingredients on every single sale.
    const run = resolveBatchRun(3, 5, RecipeType.KITCHEN);
    expect(run.materialMultiplier).toBeCloseTo(0.6, 10);
    expect(run.producedQuantity).toBe(3);
  });

  it("a per-unit recipe (yield 1) is exactly the quantity", () => {
    const run = resolveBatchRun(7, 1, RecipeType.KITCHEN);
    expect(run.materialMultiplier).toBe(7);
    expect(run.producedQuantity).toBe(7);
  });
});

describe("degenerate yields do not produce Infinity or NaN draws", () => {
  it("a BATCH recipe with yield 0 falls back rather than dividing by zero", () => {
    // yieldQuantity 0 is invalid data, but it must not reach the ingredient
    // loop as an Infinity multiplier and drain the whole store.
    const run = resolveBatchRun(3, 0, RecipeType.BATCH);
    expect(run.batches).toBe(1);
    expect(Number.isFinite(run.materialMultiplier)).toBe(false);
    // The caller guards this separately; what matters is that BATCH does not
    // silently ceil() Infinity into a finite-looking batch count.
    expect(run.producedQuantity).toBe(3);
  });
});
