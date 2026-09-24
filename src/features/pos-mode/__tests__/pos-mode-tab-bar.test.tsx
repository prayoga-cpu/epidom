import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  usePathname: () => "/store/store-1/pos",
}));
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

const mockPosSession = vi.fn();
vi.mock("@/features/pos/hooks/use-pos-session", () => ({
  usePosSession: () => mockPosSession(),
}));

const mockKdsSettings = vi.fn();
vi.mock("@/features/pos/hooks/use-kds-settings", () => ({
  useKdsSettings: () => mockKdsSettings(),
}));

import { PosModeTabBar } from "../pos-mode-tab-bar";

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderTabBar(opts: {
  allowedPages: string[] | null;
  staffRole?: string | null;
  kitchenDisplayEnabled?: boolean;
}) {
  mockPosSession.mockReturnValue({
    isActive: opts.allowedPages !== null,
    storeId: "store-1",
    staffRole: opts.staffRole ?? null,
    allowedPages: opts.allowedPages,
  });
  mockKdsSettings.mockReturnValue({
    data: { kitchenDisplayEnabled: opts.kitchenDisplayEnabled ?? true },
  });
  return render(<PosModeTabBar storeId="store-1" />);
}

function tabHrefs() {
  return screen.getAllByRole("link").map((l) => l.getAttribute("href"));
}

// ── Tests: role matrix ──────────────────────────────────────────────────────

describe("PosModeTabBar role matrix", () => {
  it("Owner (no active persona, allowedPages null) sees all four tabs", () => {
    renderTabBar({ allowedPages: null });
    const hrefs = tabHrefs();
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/store/store-1/pos",
        "/store/store-1/pos/orders",
        "/store/store-1/pos/kds",
        "/store/store-1/tables",
      ])
    );
    expect(hrefs).toHaveLength(4);
  });

  it("Cashier's default allowedPages hides Dapur, shows the other three", () => {
    renderTabBar({
      allowedPages: ["/pos", "/pos/orders", "/tables", "/pos/schedule"],
      staffRole: "CASHIER",
    });
    const hrefs = tabHrefs();
    expect(hrefs).not.toContain("/store/store-1/pos/kds");
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/store/store-1/pos",
        "/store/store-1/pos/orders",
        "/store/store-1/tables",
      ])
    );
    expect(hrefs).toHaveLength(3);
  });

  it("Kitchen's default allowedPages shows only Dapur", () => {
    renderTabBar({
      allowedPages: ["/pos/kds", "/pos/schedule"],
      staffRole: "KITCHEN",
    });
    expect(tabHrefs()).toEqual(["/store/store-1/pos/kds"]);
  });

  it("Manager's default allowedPages includes all four POS Mode tabs", () => {
    renderTabBar({
      allowedPages: [
        "/dashboard",
        "/storefront",
        "/pos",
        "/pos/orders",
        "/pos/kds",
        "/tables",
        "/menu",
        "/management",
        "/production",
        "/data",
        "/alerts",
        "/schedule",
        "/pos/schedule",
      ],
      staffRole: "MANAGER",
    });
    expect(tabHrefs()).toHaveLength(4);
  });

  it("an Owner-role StaffMember row (e.g. seeded accounts) is treated as unrestricted, not filtered", () => {
    // Mirrors sidebar.tsx's own staffAllowedPages rule: role-based, not
    // ID-based — a StaffMember row can itself have role OWNER.
    renderTabBar({ allowedPages: ["/pos"], staffRole: "OWNER" });
    expect(tabHrefs()).toHaveLength(4);
  });
});

// ── Tests: kitchenDisplayEnabled ────────────────────────────────────────────

describe("PosModeTabBar kitchen-display toggle", () => {
  it("hides Dapur entirely when kitchenDisplayEnabled is false, even for an unrestricted persona", () => {
    renderTabBar({ allowedPages: null, kitchenDisplayEnabled: false });
    expect(tabHrefs()).not.toContain("/store/store-1/pos/kds");
    expect(tabHrefs()).toHaveLength(3);
  });

  it("shows Dapur when kitchenDisplayEnabled is true", () => {
    renderTabBar({ allowedPages: null, kitchenDisplayEnabled: true });
    expect(tabHrefs()).toContain("/store/store-1/pos/kds");
  });
});
