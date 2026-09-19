import { describe, it, expect } from "vitest";
import { isBackOfficeAppPath, isPosAppPath, isResumableAppPath } from "../last-visited";

describe("isResumableAppPath", () => {
  it("no longer resumes onto the legacy root /profile", () => {
    // /profile is redirect-only now (deactivated accounts aside), so a stale
    // cookie holding it must be ignored rather than replayed through a redirect.
    expect(isResumableAppPath("/profile")).toBe(false);
    expect(isResumableAppPath("/store/cljabc12345/profile")).toBe(true);
  });

  it("still resumes the store picker", () => {
    expect(isResumableAppPath("/stores")).toBe(true);
  });
});

describe("isBackOfficeAppPath", () => {
  it("accepts a real Back Office section", () => {
    expect(isBackOfficeAppPath("/store/cljabc12345/finance")).toBe(true);
    expect(isBackOfficeAppPath("/store/cljabc12345/staff?tab=roster")).toBe(true);
  });

  it("rejects POS Mode pages — this is the whole reason it's separate from isResumableAppPath", () => {
    expect(isBackOfficeAppPath("/store/cljabc12345/pos")).toBe(false);
    expect(isBackOfficeAppPath("/store/cljabc12345/pos/orders")).toBe(false);
    expect(isBackOfficeAppPath("/store/cljabc12345/pos/kds")).toBe(false);
    // /tables isn't nested under /pos in the URL, but it's still a POS Mode
    // route (posModeNavItems) — the whole reason this isn't a bare prefix check.
    expect(isBackOfficeAppPath("/store/cljabc12345/tables")).toBe(false);
  });

  it("rejects root-level paths (not inside a store)", () => {
    expect(isBackOfficeAppPath("/profile")).toBe(false);
    expect(isBackOfficeAppPath("/stores")).toBe(false);
  });

  it("rejects anything isResumableAppPath already rejects", () => {
    expect(isBackOfficeAppPath("//evil.com")).toBe(false);
    expect(isBackOfficeAppPath("/store/short/finance")).toBe(false);
    expect(isBackOfficeAppPath("/store/cljabc12345/not-a-real-section")).toBe(false);
  });
});

describe("isPosAppPath", () => {
  it("accepts every POS Mode section, including tables and this store's own schedule view", () => {
    expect(isPosAppPath("/store/cljabc12345/pos")).toBe(true);
    expect(isPosAppPath("/store/cljabc12345/pos/orders")).toBe(true);
    expect(isPosAppPath("/store/cljabc12345/pos/kds")).toBe(true);
    expect(isPosAppPath("/store/cljabc12345/pos/schedule")).toBe(true);
    expect(isPosAppPath("/store/cljabc12345/tables")).toBe(true);
  });

  it("rejects Back Office pages — this is the whole reason it's separate from isBackOfficeAppPath", () => {
    expect(isPosAppPath("/store/cljabc12345/finance")).toBe(false);
    expect(isPosAppPath("/store/cljabc12345/staff")).toBe(false);
  });

  it("rejects anything isResumableAppPath already rejects", () => {
    expect(isPosAppPath("//evil.com")).toBe(false);
    expect(isPosAppPath("/store/short/pos")).toBe(false);
  });
});
