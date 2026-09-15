import { describe, it, expect } from "vitest";
import { isOfflinePersistedQueryKey } from "../query-persister";

describe("isOfflinePersistedQueryKey", () => {
  it("persists POS core domains", () => {
    expect(isOfflinePersistedQueryKey(["pos", "menu", "store-1"])).toBe(true);
    expect(isOfflinePersistedQueryKey(["pos", "orders", "store-1"])).toBe(true);
    expect(isOfflinePersistedQueryKey(["pos", "staff-list", "store-1"])).toBe(true);
    expect(isOfflinePersistedQueryKey(["pos", "kds-settings", "store-1"])).toBe(true);
  });

  it("persists the inventory/staff reference domains", () => {
    expect(isOfflinePersistedQueryKey(["materials", "store-1", "list", undefined])).toBe(true);
    expect(isOfflinePersistedQueryKey(["staff-schedules", "store-1", "2026-08-01"])).toBe(true);
    expect(isOfflinePersistedQueryKey(["staff", "store-1"])).toBe(true);
  });

  it("excludes POS domains that are large, reporting-shaped, or out of scope", () => {
    expect(isOfflinePersistedQueryKey(["pos", "order-history", "store-1"])).toBe(false);
    expect(
      isOfflinePersistedQueryKey(["pos", "order-history-payment-totals", "store-1"])
    ).toBe(false);
    expect(isOfflinePersistedQueryKey(["pos", "order-receipt-sends", "store-1", "order-1"])).toBe(
      false
    );
  });

  it("excludes Finance Reports, Billing, and other combinatorial/live-only domains", () => {
    // "finance-summary"/etc (Finance Reports) are keyed by date-range + up to
    // 5 filter dimensions — deliberately not mirrored (see query-persister.ts).
    expect(isOfflinePersistedQueryKey(["finance-summary", "store-1", "2026-01-01"])).toBe(false);
    expect(isOfflinePersistedQueryKey(["admin", "capacity"])).toBe(false);
    expect(isOfflinePersistedQueryKey(["subscription-status"])).toBe(false);
    expect(isOfflinePersistedQueryKey(["custom-development-requests"])).toBe(false);
    expect(isOfflinePersistedQueryKey(["supplier-orders", "store-1"])).toBe(false);
    expect(isOfflinePersistedQueryKey(["stock-movements", "store-1"])).toBe(false);
    expect(isOfflinePersistedQueryKey(["analytics-orders", "store-1"])).toBe(false);
  });

  it("persists the newly-added shell+data domains", () => {
    expect(isOfflinePersistedQueryKey(["storefront", "store-1"])).toBe(true);
    expect(isOfflinePersistedQueryKey(["recipes", "store-1", "list"])).toBe(true);
    expect(isOfflinePersistedQueryKey(["products", "store-1", "list"])).toBe(true);
    expect(isOfflinePersistedQueryKey(["suppliers", "store-1", "list"])).toBe(true);
    expect(isOfflinePersistedQueryKey(["tables", "store-1"])).toBe(true);
    expect(isOfflinePersistedQueryKey(["alerts", "list", "store-1"])).toBe(true);
    expect(isOfflinePersistedQueryKey(["finance-settings", "store-1"])).toBe(true);
    expect(isOfflinePersistedQueryKey(["receipt-settings", "store-1"])).toBe(true);
  });

  it("does not match a bare prefix by coincidence — segments must align in order", () => {
    // "pos" alone (no second segment) should never match a two-segment prefix rule
    expect(isOfflinePersistedQueryKey(["pos"])).toBe(false);
    // A key that merely contains "materials" later isn't a match — position matters
    expect(isOfflinePersistedQueryKey(["pos", "materials", "store-1"])).toBe(false);
  });
});
