/**
 * /pos with an empty menu: the till can sell nothing, so whoever can add the
 * menu is sent to where it's added; anyone else still gets the till (its empty
 * state says who to ask). Never a redirect to a page the viewer can't open,
 * which would bounce them straight back here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(async () => ({ user: { id: "u1" } })),
}));
const verification = vi.hoisted(() => ({ verifyStoreAccess: vi.fn() }));
vi.mock("@/lib/utils/store-verification", () => verification);
const guard = vi.hoisted(() => ({ requireStaffPageAccess: vi.fn() }));
vi.mock("@/lib/auth/require-staff-page-access", () => guard);
const till = vi.hoisted(() => ({ countTillMenuItems: vi.fn(), resolveMenuSetupHref: vi.fn() }));
vi.mock("@/lib/pos/till-menu", () => till);
vi.mock("@/features/pos/components/pos-shell", () => ({
  PosShell: () => null,
}));

import PosPage from "../page";

const run = () => PosPage({ params: Promise.resolve({ storeId: "s1" }) });

beforeEach(() => {
  vi.clearAllMocks();
  verification.verifyStoreAccess.mockResolvedValue({
    store: { id: "s1", name: "Café", customProductsEnabled: false },
  });
  till.countTillMenuItems.mockResolvedValue(0);
  till.resolveMenuSetupHref.mockResolvedValue("/store/s1/data?from=pos");
});

describe("/pos with an empty menu", () => {
  it("sends a viewer who can add the menu to where it's added", async () => {
    await expect(run()).rejects.toThrow("redirect:/store/s1/data?from=pos");
    expect(guard.requireStaffPageAccess).toHaveBeenCalledWith("s1", "/pos");
    expect(till.countTillMenuItems).toHaveBeenCalledWith("s1", false);
  });

  it("keeps a viewer who can't add it on the till, with no setup link", async () => {
    till.resolveMenuSetupHref.mockResolvedValue(null);
    const element = (await run()) as React.ReactElement<{ menuSetupHref: string | null }>;
    expect(element.props.menuSetupHref).toBeNull();
  });

  it("a till with items opens as usual, carrying the link for its empty state", async () => {
    till.countTillMenuItems.mockResolvedValue(5);
    const element = (await run()) as React.ReactElement<{
      store: { id: string; name: string };
      menuSetupHref: string | null;
    }>;
    expect(element.props.store).toEqual({ id: "s1", name: "Café" });
    expect(element.props.menuSetupHref).toBe("/store/s1/data?from=pos");
  });
});
