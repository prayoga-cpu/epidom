import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/features/dashboard/alerts/hooks/use-alerts-count", () => ({
  useAlertsCount: () => 0,
}));
vi.mock("@/features/dashboard/shared/hooks/use-current-store", () => ({
  useCurrentStore: () => ({ storeId: "store-1" }),
}));
vi.mock("@/features/dashboard/shared/store-switcher", () => ({
  StoreSwitcher: () => null,
}));
vi.mock("@/components/lang/lang-switcher", () => ({ default: () => null }));
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

const mockSubData = vi.fn();
vi.mock("@/features/stores/stores/hooks/use-subscription-status", () => ({
  useSubscriptionStatus: () => mockSubData(),
}));

import { Sidebar } from "@/features/dashboard/shared/sidebar";

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderSidebar(plan: string | null) {
  mockSubData.mockReturnValue({
    data: plan ? { subscription: { plan }, hasSubscription: true } : null,
  });
  return render(<Sidebar />);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Sidebar plan gating", () => {
  // /pos/orders, /pos/kds, /tables moved into the (pos-mode) shell's own
  // bottom tab bar (docs/dashboard-revamp.md); /menu was retired as a
  // standalone rail item in favor of Storefront's Menu tab
  // (docs/back-office-revamp.md). None of these three should ever render in
  // this rail again, at any plan tier. /pos itself DOES render — but only as
  // the single "switch to POS" CTA at the top of the nav, not a
  // dashboardNavigation item — see the dedicated describe block below.
  it("never renders /pos/orders, /pos/kds, /tables or /menu, at any plan tier", () => {
    for (const plan of ["FREE", "POS", "OPERATIONS", "ENTERPRISE"]) {
      renderSidebar(plan);
      const hrefs = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
      for (const removed of [
        "/store/store-1/pos/orders",
        "/store/store-1/pos/kds",
        "/store/store-1/tables",
        "/store/store-1/menu",
      ]) {
        expect(hrefs).not.toContain(removed);
      }
    }
  });

  // The one deliberate way from Back Office into the POS Mode shell
  // (docs/back-office-revamp.md) — a single CTA at the top of the nav,
  // gated on plan tier and (defensively) staff allowedPages, not a
  // dashboardNavigation item.
  describe("Switch-to-POS CTA", () => {
    it("below POS tier: links to the upgrade flow, not /pos", () => {
      renderSidebar("FREE");
      const posLinks = screen.getAllByRole("link", { name: /nav\.pos/i });
      const ctaLink = posLinks.find((l) => l.getAttribute("href")?.startsWith("/pricing"));
      expect(ctaLink).toBeTruthy();
      const hrefs = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
      expect(hrefs).not.toContain("/store/store-1/pos");
    });

    it("at POS tier or above: links directly to /pos", () => {
      for (const plan of ["POS", "OPERATIONS", "ENTERPRISE"]) {
        renderSidebar(plan);
        const hrefs = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
        expect(hrefs).toContain("/store/store-1/pos");
      }
    });
  });

  describe("FREE plan", () => {
    it("shows an event-framed locked hint, not just the generic plan badge", () => {
      renderSidebar("FREE");
      // Data is OPERATIONS-gated with lockedHintKey "nav.lockedHint.data" —
      // the mock i18n passes keys through verbatim.
      expect(screen.getByText("nav.lockedHint.data")).toBeInTheDocument();
    });

    it("shows Operations items as locked", () => {
      renderSidebar("FREE");
      const links = screen.getAllByRole("link");
      const pricingLinks = links.filter((l) => l.getAttribute("href")?.startsWith("/pricing"));
      // Multiple locked items should point to /pricing#plans
      expect(pricingLinks.length).toBeGreaterThan(3);
    });

    it("shows Profile/Dashboard/Storefront as normal unlocked links", () => {
      renderSidebar("FREE");
      const profileLink = screen.getByRole("link", { name: /nav\.profile/i });
      expect(profileLink.getAttribute("href")).toBe("/store/store-1/profile");
    });

    it("Owner (ENTERPRISE) is locked", () => {
      renderSidebar("FREE");
      const links = screen.getAllByRole("link");
      const ownerLink = links.find((l) => l.getAttribute("href") === "/store/store-1/owner");
      expect(ownerLink).toBeUndefined();
    });
  });

  describe("POS plan", () => {
    it("shows the POS-tier-gated /menu item as a locked link (retired standalone page)", () => {
      renderSidebar("POS");
      // /menu has no rail entry anymore at any tier — it's grantable-only,
      // reached via Storefront's Menu tab instead.
      const links = screen.getAllByRole("link");
      const menuLink = links.find((l) => l.getAttribute("href") === "/store/store-1/menu");
      expect(menuLink).toBeUndefined();
    });

    it("shows Operations items as locked", () => {
      renderSidebar("POS");
      // /management should point to /pricing (locked)
      const links = screen.getAllByRole("link");
      const mgmtLink = links.find((l) => l.getAttribute("href") === "/store/store-1/management");
      expect(mgmtLink).toBeUndefined();
      const pricingLinks = links.filter((l) => l.getAttribute("href")?.startsWith("/pricing"));
      expect(pricingLinks.length).toBeGreaterThan(0);
    });
  });

  describe("OPERATIONS plan", () => {
    it("shows /management as a normal link", () => {
      renderSidebar("OPERATIONS");
      const links = screen.getAllByRole("link");
      const mgmtLink = links.find((l) => l.getAttribute("href") === "/store/store-1/management");
      expect(mgmtLink).toBeTruthy();
    });

    it("shows Finance and Owner (ENTERPRISE) as locked", () => {
      renderSidebar("OPERATIONS");
      const links = screen.getAllByRole("link");
      const financeLink = links.find((l) => l.getAttribute("href") === "/store/store-1/finance");
      const ownerLink = links.find((l) => l.getAttribute("href") === "/store/store-1/owner");
      expect(financeLink).toBeUndefined();
      expect(ownerLink).toBeUndefined();
      const pricingLinks = links.filter((l) => l.getAttribute("href")?.startsWith("/pricing"));
      expect(pricingLinks.length).toBeGreaterThan(0);
    });
  });

  describe("ENTERPRISE plan", () => {
    it("shows all items unlocked including Finance and Owner", () => {
      renderSidebar("ENTERPRISE");
      const links = screen.getAllByRole("link");
      const financeLink = links.find((l) => l.getAttribute("href") === "/store/store-1/finance");
      const ownerLink = links.find((l) => l.getAttribute("href") === "/store/store-1/owner");
      expect(financeLink).toBeTruthy();
      expect(ownerLink).toBeTruthy();
      const pricingLinks = links.filter((l) => l.getAttribute("href")?.startsWith("/pricing"));
      expect(pricingLinks.length).toBe(0);
    });
  });

  describe("no subscription / error state", () => {
    it("defaults to FREE (all premium items locked) without crashing", () => {
      mockSubData.mockReturnValue({ data: null });
      expect(() => render(<Sidebar />)).not.toThrow();
      const links = screen.getAllByRole("link");
      const pricingLinks = links.filter((l) => l.getAttribute("href")?.startsWith("/pricing"));
      expect(pricingLinks.length).toBeGreaterThan(0);
    });
  });
});
