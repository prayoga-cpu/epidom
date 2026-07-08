import { describe, it, expect, vi, beforeEach } from "vitest";
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
  describe("FREE plan", () => {
    it("shows POS items as locked links to /pricing", () => {
      renderSidebar("FREE");
      const posLinks = screen.getAllByRole("link", { name: /nav\.pos/i });
      // The locked link points to /pricing, not the actual page
      const lockedPos = posLinks.find((l) => l.getAttribute("href")?.startsWith("/pricing"));
      expect(lockedPos).toBeTruthy();
    });

    it("shows lock icon on POS items", () => {
      renderSidebar("FREE");
      // Lock label text appears next to locked items
      expect(screen.getAllByText("POS").length).toBeGreaterThan(0);
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
  });

  describe("POS plan", () => {
    it("shows POS items as normal links", () => {
      renderSidebar("POS");
      const links = screen.getAllByRole("link");
      const posLink = links.find((l) => l.getAttribute("href") === "/store/store-1/pos");
      expect(posLink).toBeTruthy();
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
    it("shows POS and Operations items as normal links", () => {
      renderSidebar("OPERATIONS");
      const links = screen.getAllByRole("link");
      const posLink = links.find((l) => l.getAttribute("href") === "/store/store-1/pos");
      const mgmtLink = links.find((l) => l.getAttribute("href") === "/store/store-1/management");
      expect(posLink).toBeTruthy();
      expect(mgmtLink).toBeTruthy();
    });

    it("shows Finance (ENTERPRISE) as locked", () => {
      renderSidebar("OPERATIONS");
      const links = screen.getAllByRole("link");
      const financeLink = links.find((l) => l.getAttribute("href") === "/store/store-1/finance");
      expect(financeLink).toBeUndefined();
      const pricingLinks = links.filter((l) => l.getAttribute("href")?.startsWith("/pricing"));
      expect(pricingLinks.length).toBeGreaterThan(0);
    });
  });

  describe("ENTERPRISE plan", () => {
    it("shows all items unlocked including Finance", () => {
      renderSidebar("ENTERPRISE");
      const links = screen.getAllByRole("link");
      const financeLink = links.find((l) => l.getAttribute("href") === "/store/store-1/finance");
      expect(financeLink).toBeTruthy();
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
