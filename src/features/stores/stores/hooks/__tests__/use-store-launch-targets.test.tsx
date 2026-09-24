import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { LAST_VISITED_BACK_OFFICE_COOKIE, LAST_VISITED_POS_COOKIE } from "@/lib/last-visited";
import { defaultBackOfficeHref, useStoreLaunchTargets } from "../use-store-launch-targets";

// Store ids must look like real ones: isResumableAppPath rejects ids shorter than 8.
const ID = "store-s1-abc";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("useStoreLaunchTargets", () => {
  it("defaults to the bare till and the dashboard", () => {
    const { result } = renderHook(() => useStoreLaunchTargets(ID, "dashboard"));
    expect(result.current).toEqual({
      posHref: `/store/${ID}/pos`,
      backOfficeHref: `/store/${ID}/dashboard`,
    });
  });

  it("resumes the last POS and Back Office pages visited in this store", async () => {
    localStorage.setItem(LAST_VISITED_POS_COOKIE, `/store/${ID}/pos/orders`);
    localStorage.setItem(LAST_VISITED_BACK_OFFICE_COOKIE, `/store/${ID}/finance`);
    const { result } = renderHook(() => useStoreLaunchTargets(ID, "dashboard"));
    await waitFor(() =>
      expect(result.current).toEqual({
        posHref: `/store/${ID}/pos/orders`,
        backOfficeHref: `/store/${ID}/finance`,
      })
    );
  });

  it("ignores paths saved for another store", async () => {
    localStorage.setItem(LAST_VISITED_POS_COOKIE, "/store/other-store-99/pos/kds");
    localStorage.setItem(LAST_VISITED_BACK_OFFICE_COOKIE, "/store/other-store-99/finance");
    const { result } = renderHook(() => useStoreLaunchTargets(ID, "dashboard"));
    // Give the effect its chance to run before asserting nothing changed.
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toEqual({
      posHref: `/store/${ID}/pos`,
      backOfficeHref: `/store/${ID}/dashboard`,
    });
  });

  it("rejects a POS path saved under the Back Office key, and the other way round", async () => {
    localStorage.setItem(LAST_VISITED_BACK_OFFICE_COOKIE, `/store/${ID}/pos/orders`);
    localStorage.setItem(LAST_VISITED_POS_COOKIE, `/store/${ID}/finance`);
    const { result } = renderHook(() => useStoreLaunchTargets(ID, "dashboard"));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.backOfficeHref).toBe(`/store/${ID}/dashboard`);
    expect(result.current.posHref).toBe(`/store/${ID}/pos`);
  });

  it("falls back to the default landing section, and 'pos' to the dashboard", () => {
    expect(
      renderHook(() => useStoreLaunchTargets(ID, "storefront")).result.current.backOfficeHref
    ).toBe(`/store/${ID}/storefront`);
    expect(renderHook(() => useStoreLaunchTargets(ID, "pos")).result.current.backOfficeHref).toBe(
      `/store/${ID}/dashboard`
    );
    expect(defaultBackOfficeHref(ID, "data")).toBe(`/store/${ID}/data`);
  });

  it("uses the defaults when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const { result } = renderHook(() => useStoreLaunchTargets(ID, "dashboard"));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toEqual({
      posHref: `/store/${ID}/pos`,
      backOfficeHref: `/store/${ID}/dashboard`,
    });
  });
});
