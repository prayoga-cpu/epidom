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

  it("excludes finance, admin, and marketing domains entirely", () => {
    expect(isOfflinePersistedQueryKey(["finance", "store-1"])).toBe(false);
    expect(isOfflinePersistedQueryKey(["admin", "capacity"])).toBe(false);
    expect(isOfflinePersistedQueryKey(["storefront", "store-1"])).toBe(false);
    expect(isOfflinePersistedQueryKey(["supplier-orders", "store-1"])).toBe(false);
  });

  it("does not match a bare prefix by coincidence — segments must align in order", () => {
    // "pos" alone (no second segment) should never match a two-segment prefix rule
    expect(isOfflinePersistedQueryKey(["pos"])).toBe(false);
    // A key that merely contains "materials" later isn't a match — position matters
    expect(isOfflinePersistedQueryKey(["pos", "materials", "store-1"])).toBe(false);
  });
});
