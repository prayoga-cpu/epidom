import { describe, it, expect, afterEach } from "vitest";
import { buildOrderHistoryParams } from "../use-order-history";
import type { OrderHistoryFilters } from "../../types/pos.types";

/** A full filter set with nothing applied; each test overrides only what it is about. */
const filters = (overrides: Partial<OrderHistoryFilters> = {}): OrderHistoryFilters => ({
  q: "",
  status: "ALL",
  source: "ALL",
  from: "",
  to: "",
  unpaidOnly: false,
  productId: "ALL",
  department: "ALL",
  staffId: "ALL",
  paymentMethod: "ALL",
  ...overrides,
});

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe("buildOrderHistoryParams — the date range", () => {
  it("sends a date-only range as the user's own day, not a UTC day", () => {
    process.env.TZ = "Asia/Jakarta";
    const params = buildOrderHistoryParams(filters({ from: "2026-09-19", to: "2026-09-19" }), 25);
    // 00:00 → 23:59:59.999 in Jakarta. The old `…T00:00:00Z` window began at 07:00 local,
    // so an order rung up at 03:00 fell into "yesterday".
    expect(params.get("from")).toBe("2026-09-18T17:00:00.000Z");
    expect(params.get("to")).toBe("2026-09-19T16:59:59.999Z");
  });

  it("covers the whole range across several days", () => {
    process.env.TZ = "Asia/Makassar";
    const params = buildOrderHistoryParams(filters({ from: "2026-09-13", to: "2026-09-19" }), 25);
    expect(params.get("from")).toBe("2026-09-12T16:00:00.000Z");
    expect(params.get("to")).toBe("2026-09-19T15:59:59.999Z");
  });

  it("passes a full ISO datetime through untouched (a till session's minute-precision window)", () => {
    const params = buildOrderHistoryParams(
      filters({ from: "2026-09-19T01:30:00.000Z", to: "2026-09-19T09:45:00.000Z" }),
      25
    );
    expect(params.get("from")).toBe("2026-09-19T01:30:00.000Z");
    expect(params.get("to")).toBe("2026-09-19T09:45:00.000Z");
  });

  it("never produces the doubled-suffix garbage a datetime once did", () => {
    const params = buildOrderHistoryParams(filters({ from: "2026-08-09T22:00:00.000Z" }), 25);
    expect(params.get("from")).not.toMatch(/ZT00:00:00Z$/);
  });

  it("sends no range at all for 'all time'", () => {
    const params = buildOrderHistoryParams(filters(), 25);
    expect(params.has("from")).toBe(false);
    expect(params.has("to")).toBe(false);
  });

  it("still carries the other filters and the paging", () => {
    const params = buildOrderHistoryParams(
      filters({ q: "budi", status: "READY", from: "2026-09-19", unpaidOnly: true }),
      25,
      "cursor-1"
    );
    expect(params.get("take")).toBe("25");
    expect(params.get("q")).toBe("budi");
    expect(params.get("status")).toBe("READY");
    expect(params.get("unpaid")).toBe("1");
    expect(params.get("cursor")).toBe("cursor-1");
  });
});
