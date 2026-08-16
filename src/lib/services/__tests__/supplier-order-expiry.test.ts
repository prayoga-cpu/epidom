import { describe, it, expect } from "vitest";

/**
 * The rule used when a supplier order is marked RECEIVED and each line's
 * requested DLC is carried onto Material.expirationDate.
 *
 * Mirrors the condition in
 * src/app/api/stores/[id]/supplier-orders/[orderId]/route.ts — kept here as a
 * pure function so the three branches are pinned independently of Prisma.
 */
function shouldTakeExpiry(
  incoming: Date | null,
  current: Date | null,
  receivedAt: Date
): boolean {
  return !!incoming && (!current || current < receivedAt || incoming < current);
}

const RECEIVED_AT = new Date("2026-08-16T00:00:00Z");
const d = (iso: string) => new Date(iso);

describe("carrying a delivery's DLC onto the material", () => {
  it("takes the incoming date when the material has none", () => {
    expect(shouldTakeExpiry(d("2026-09-01"), null, RECEIVED_AT)).toBe(true);
  });

  it("takes a sooner date over a later one already on file", () => {
    // Single next-expiry field: a batch expiring sooner must not be masked.
    expect(shouldTakeExpiry(d("2026-09-01"), d("2026-12-01"), RECEIVED_AT)).toBe(true);
  });

  it("keeps the existing date when the incoming one is later", () => {
    expect(shouldTakeExpiry(d("2026-12-01"), d("2026-09-01"), RECEIVED_AT)).toBe(false);
  });

  it("replaces an already-expired date even though the incoming one is later", () => {
    // Regression: plain "soonest wins" rejected this, because any future date
    // loses to a past one. Nothing clears expirationDate as stock is consumed,
    // so the material stayed pinned as expired and kept showing under the
    // Stock page's "expired" filter after a fresh delivery.
    expect(shouldTakeExpiry(d("2026-11-01"), d("2026-07-01"), RECEIVED_AT)).toBe(true);
  });

  it("replaces a date that expired the day before receipt", () => {
    expect(shouldTakeExpiry(d("2026-10-01"), d("2026-08-15"), RECEIVED_AT)).toBe(true);
  });

  it("does nothing when the line carries no DLC", () => {
    // Dry goods and non-perishables — must not wipe a date already on file.
    expect(shouldTakeExpiry(null, d("2026-09-01"), RECEIVED_AT)).toBe(false);
    expect(shouldTakeExpiry(null, null, RECEIVED_AT)).toBe(false);
  });

  it("takes an incoming date that is itself already past", () => {
    // Odd but deliberate: a backdated receipt should still record what
    // arrived rather than silently keep a stale value.
    expect(shouldTakeExpiry(d("2026-08-10"), d("2026-08-12"), RECEIVED_AT)).toBe(true);
  });
});
