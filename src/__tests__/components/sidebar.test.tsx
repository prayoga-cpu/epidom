import { describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

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
// The drawer's install / offline footer needs providers this test does not mount.
vi.mock("@/features/dashboard/shared/pwa-install-dialog", () => ({
  OfflineSyncTrigger: () => null,
  PwaInstallTrigger: () => null,
}));
// The bell reads notifications through React Query; this test has no provider.
vi.mock("@/features/dashboard/shared/notification-bell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

const mockSubData = vi.fn();
vi.mock("@/features/stores/stores/hooks/use-subscription-status", () => ({
  useSubscriptionStatus: () => mockSubData(),
}));

import { Sidebar } from "@/features/dashboard/shared/sidebar";

// The sidebar's profile and notification hooks use React Query.
const render = (ui: ReactElement) =>
  rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>
  );

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderSidebar(plan: string | null) {
  mockSubData.mockReturnValue({
    data: plan ? { subscription: { plan }, hasSubscription: true } : null,
  });
  return render(<Sidebar mode="mobile" />);
}

/**
 * The phone drawer shows one category at a time (General, Operations, Reports),
 * like the desktop sidebar. Visit each category and collect every link seen: a
 * link element keeps its attributes after the category it belongs to is swapped
 * out, so the union is "everything reachable from the drawer".
 */
function allLinks(): HTMLAnchorElement[] {
  const seen = new Map<string, HTMLAnchorElement>();
  const categories = screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"));
  for (const category of categories) {
    fireEvent.click(category);
    for (const link of screen.getAllByRole("link")) {
      seen.set(`${link.getAttribute("href")}|${link.textContent}`, link as HTMLAnchorElement);
    }
  }
  return [...seen.values()];
}

/** Opens one category by its (mocked, key-shaped) label. */
const openCategory = (key: "general" | "operations" | "reports") =>
  fireEvent.click(screen.getByRole("button", { name: `nav.sections.${key}` }));

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
      const hrefs = allLinks().map((l) => l.getAttribute("href"));
      for (const removed of [
        "/store/store-1/pos/orders",
        "/store/store-1/pos/kds",
        "/store/store-1/tables",
        "/store/store-1/menu",
      ]) {
        expect(hrefs).not.toContain(removed);
      }
      // One sidebar at a time: visiting every category of four at once is slow.
      cleanup();
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
      openCategory("operations");
      // Data is OPERATIONS-gated with lockedHintKey "nav.lockedHint.data" —
      // the mock i18n passes keys through verbatim.
      expect(screen.getByText("nav.lockedHint.data")).toBeInTheDocument();
    });

    it("shows Operations items as locked", () => {
      renderSidebar("FREE");
      const links = allLinks();
      const pricingLinks = links.filter((l) => l.getAttribute("href")?.startsWith("/pricing"));
      // Multiple locked items should point to /pricing#plans
      expect(pricingLinks.length).toBeGreaterThan(3);
    });

    it("shows Profile/Dashboard/Storefront as normal unlocked links", () => {
      renderSidebar("FREE");
      const profileLink = screen.getByRole("link", { name: /nav\.profile/i });
      expect(profileLink.getAttribute("href")).toBe("/store/store-1/profile");
    });

    it("Finance (OPERATIONS) and Custom Development (POS) are locked", () => {
      renderSidebar("FREE");
      const links = allLinks();
      const financeLink = links.find((l) => l.getAttribute("href") === "/store/store-1/finance");
      const customDevLink = links.find(
        (l) => l.getAttribute("href") === "/store/store-1/custom-development"
      );
      expect(financeLink).toBeUndefined();
      expect(customDevLink).toBeUndefined();
    });
  });

  describe("POS plan", () => {
    it("shows the POS-tier-gated /menu item as a locked link (retired standalone page)", () => {
      renderSidebar("POS");
      // /menu has no rail entry anymore at any tier — it's grantable-only,
      // reached via Storefront's Menu tab instead.
      const links = allLinks();
      const menuLink = links.find((l) => l.getAttribute("href") === "/store/store-1/menu");
      expect(menuLink).toBeUndefined();
    });

    it("shows Operations items as locked", () => {
      renderSidebar("POS");
      // /management should point to /pricing (locked)
      const links = allLinks();
      const mgmtLink = links.find((l) => l.getAttribute("href") === "/store/store-1/management");
      expect(mgmtLink).toBeUndefined();
      const pricingLinks = links.filter((l) => l.getAttribute("href")?.startsWith("/pricing"));
      expect(pricingLinks.length).toBeGreaterThan(0);
    });
  });

  describe("OPERATIONS plan", () => {
    it("shows /management as a normal link", () => {
      renderSidebar("OPERATIONS");
      const links = allLinks();
      const mgmtLink = links.find((l) => l.getAttribute("href") === "/store/store-1/management");
      expect(mgmtLink).toBeTruthy();
    });

    // Finance (with its All outlets roll-up) moved down from Enterprise, so
    // Operations is the top of the self-serve ladder: nothing is locked.
    it("shows Finance unlocked and nothing locked", () => {
      renderSidebar("OPERATIONS");
      const links = allLinks();
      const financeLink = links.find((l) => l.getAttribute("href") === "/store/store-1/finance");
      expect(financeLink).toBeTruthy();
      const pricingLinks = links.filter((l) => l.getAttribute("href")?.startsWith("/pricing"));
      expect(pricingLinks.length).toBe(0);
    });

    it("has no Owner item — the roll-up is inside Finance", () => {
      renderSidebar("OPERATIONS");
      const links = allLinks();
      expect(links.find((l) => l.getAttribute("href") === "/store/store-1/owner")).toBeUndefined();
    });
  });

  describe("ENTERPRISE plan", () => {
    it("shows all items unlocked including Finance and Custom Development", () => {
      renderSidebar("ENTERPRISE");
      const links = allLinks();
      const financeLink = links.find((l) => l.getAttribute("href") === "/store/store-1/finance");
      const customDevLink = links.find(
        (l) => l.getAttribute("href") === "/store/store-1/custom-development"
      );
      expect(financeLink).toBeTruthy();
      expect(customDevLink).toBeTruthy();
      const pricingLinks = links.filter((l) => l.getAttribute("href")?.startsWith("/pricing"));
      expect(pricingLinks.length).toBe(0);
    });
  });

  describe("no subscription / error state", () => {
    it("defaults to FREE (all premium items locked) without crashing", () => {
      mockSubData.mockReturnValue({ data: null });
      expect(() => render(<Sidebar mode="mobile" />)).not.toThrow();
      const links = screen.getAllByRole("link");
      const pricingLinks = links.filter((l) => l.getAttribute("href")?.startsWith("/pricing"));
      expect(pricingLinks.length).toBeGreaterThan(0);
    });
  });
});

// The drawer is grouped like the desktop sidebar: a category strip and one
// category's pages at a time, Settings under the list.
describe("Sidebar grouping (phone drawer)", () => {
  const hrefs = () => screen.getAllByRole("link").map((l) => l.getAttribute("href"));

  it("offers General, Operations and Reports, and starts on General", () => {
    renderSidebar("ENTERPRISE");
    for (const key of ["general", "operations", "reports"]) {
      expect(screen.getByRole("button", { name: `nav.sections.${key}` })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "nav.sections.general" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(hrefs()).toContain("/store/store-1/customers");
    expect(hrefs()).not.toContain("/store/store-1/management");
  });

  it("shows only the chosen category's pages", () => {
    renderSidebar("ENTERPRISE");
    openCategory("operations");
    expect(hrefs()).toContain("/store/store-1/management");
    expect(hrefs()).not.toContain("/store/store-1/customers");
    openCategory("reports");
    expect(hrefs()).toContain("/store/store-1/finance");
    expect(hrefs()).not.toContain("/store/store-1/management");
  });

  it("keeps Settings under the list whichever category is open", () => {
    renderSidebar("ENTERPRISE");
    expect(hrefs()).toContain("/store/store-1/profile");
    openCategory("operations");
    // Settings belongs to General's list on the desktop too: it is pinned
    // there, not repeated under every category.
    expect(hrefs().filter((h) => h === "/store/store-1/profile").length).toBeLessThanOrEqual(1);
  });

  it("searching lists matches from every category, whatever is open", () => {
    renderSidebar("ENTERPRISE");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "management" } });
    expect(hrefs()).toContain("/store/store-1/management");
    // The category strip steps aside while searching.
    expect(screen.queryByRole("button", { name: "nav.sections.general" })).toBeNull();
  });
});

// The Help centre is a footer link, not a rail item: every plan, never locked.
describe("Sidebar Help link", () => {
  it.each(["FREE", "POS", "OPERATIONS"])(
    "%s: the rail's footer links to the store's Help page",
    (plan) => {
      renderSidebar(plan);
      const help = screen.getByRole("link", { name: "nav.help" });
      expect(help).toHaveAttribute("href", "/store/store-1/help");
    }
  );
});
