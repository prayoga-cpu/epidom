import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { configure, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils/formatting";

/**
 * Finance page root: the "This outlet / All outlets" scope that replaced the
 * standalone Owner dashboard, and the All outlets report itself.
 */

configure({ asyncUtilTimeout: 8000 });

const h = vi.hoisted(() => ({
  search: { current: "" },
  replace: vi.fn(),
  get: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: h.replace, push: vi.fn() }),
  usePathname: () => "/store/store-big/finance",
  useSearchParams: () => new URLSearchParams(h.search.current),
}));

const TEXT: Record<string, string> = {
  "pages.financeMixedCurrencies": "Mixed: {currencies}",
};
const t = (key: string) => TEXT[key] ?? key;
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t, intlLocale: "en-US" }),
}));

vi.mock("@/lib/api/client", () => ({ apiClient: { get: h.get } }));

// The single-outlet report is a 2,800-line component with a dozen queries of
// its own; here it only has to prove it received the scope switch.
vi.mock("../components/finance-client", () => ({
  FinanceClient: ({ scopeSwitch }: { scopeSwitch?: ReactNode }) => (
    <div data-testid="store-report">{scopeSwitch}</div>
  ),
}));

vi.mock("@/components/ui/date-range-field", () => ({
  DateRangeField: ({ from, to }: { from: string; to: string }) => (
    <span data-testid="date-range">{`${from}..${to}`}</span>
  ),
}));

import { FinanceReport } from "../components/finance-report";

/** A money string as Testing Library sees it: Intl puts a no-break space
 * between "IDR" and the amount, and getByText normalizes the page's text
 * (not the expected string) to plain spaces. */
const shown = (value: number, currency: string) =>
  formatCurrency(value, currency, "en-US").replace(/\s/g, " ");

function renderReport(canViewAllOutlets: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <FinanceReport
        storeId="store-big"
        staff={[]}
        categories={[]}
        canViewAllOutlets={canViewAllOutlets}
      />
    </QueryClientProvider>
  );
}

const outlet = (storeId: string, currency: string, revenue: number, netProfit: number) => ({
  storeId,
  name: storeId === "store-big" ? "Big" : "Small",
  image: null,
  currency,
  revenue,
  orderCount: 10,
  pendingOrders: 1,
  cogs: revenue / 4,
  grossProfit: (revenue * 3) / 4,
  grossMarginPct: 75,
  wasteLoss: 0,
  netProfit,
});

const SAME_CURRENCY = {
  from: "2026-09-01T00:00:00.000Z",
  to: "2026-09-15T23:59:59.000Z",
  businessName: "Biz",
  storeCount: 2,
  totalOrders: 20,
  totalPending: 2,
  currency: "EUR",
  mixedCurrencies: false,
  currencies: ["EUR"],
  totals: {
    revenue: 1200,
    cogs: 300,
    grossProfit: 900,
    grossMarginPct: 75,
    wasteLoss: 0,
    netProfit: 700,
  },
  stores: [outlet("store-big", "EUR", 1000, 600), outlet("store-small", "EUR", 200, 100)],
};

const MIXED_CURRENCY = {
  ...SAME_CURRENCY,
  currency: null,
  mixedCurrencies: true,
  currencies: ["EUR", "IDR"],
  totals: null,
  stores: [outlet("store-big", "EUR", 1000, 600), outlet("store-small", "IDR", 2_000_000, 900_000)],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.search.current = "";
  h.get.mockResolvedValue(SAME_CURRENCY);
});

describe("FinanceReport scope", () => {
  it("shows only this outlet's report, with no switch, to a viewer who can't see the roll-up", () => {
    h.search.current = "scope=all";
    renderReport(false);

    expect(screen.getByTestId("store-report")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "pages.financeScopeLabel" })).toBeNull();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("gives the owner of a multi-outlet business the switch on this outlet's report", () => {
    renderReport(true);

    const group = within(screen.getByTestId("store-report")).getByRole("group", {
      name: "pages.financeScopeLabel",
    });
    const thisOutlet = within(group).getByRole("button", { name: /financeScopeThisOutlet/ });
    expect(thisOutlet.getAttribute("aria-pressed")).toBe("true");
  });

  it("switching to All outlets puts scope=all in the URL and keeps the other params", () => {
    h.search.current = "from=2026-09-01&to=2026-09-15";
    renderReport(true);

    fireEvent.click(screen.getByRole("button", { name: /financeScopeAllOutlets/ }));

    expect(h.replace).toHaveBeenCalledWith(
      "/store/store-big/finance?from=2026-09-01&to=2026-09-15&scope=all",
      { scroll: false }
    );
  });
});

describe("All outlets report", () => {
  it("asks for the same whole-day window the single-outlet report uses", async () => {
    h.search.current = "scope=all&from=2026-09-01&to=2026-09-15";
    renderReport(true);

    await screen.findByText("Big");
    expect(h.get).toHaveBeenCalledWith(
      `/owner/summary?from=${encodeURIComponent("2026-09-01T00:00:00Z")}&to=${encodeURIComponent(
        "2026-09-15T23:59:59Z"
      )}`
    );
  });

  it("falls back to month-to-date when the URL carries a till-session datetime", async () => {
    h.search.current = "scope=all&from=2026-09-03T08:00:00.000Z&to=2026-09-03T16:00:00.000Z";
    renderReport(true);

    await screen.findByText("Big");
    expect(h.get.mock.calls[0][0]).not.toContain("08%3A00");
  });

  it("links each outlet to its own Finance report for the same dates", async () => {
    h.search.current = "scope=all&from=2026-09-01&to=2026-09-15";
    renderReport(true);

    const link = await screen.findByRole("link", { name: /Small/ });
    expect(link.getAttribute("href")).toBe(
      "/store/store-small/finance?from=2026-09-01&to=2026-09-15"
    );
  });

  it("adds up money when every outlet shares a currency", async () => {
    h.search.current = "scope=all";
    renderReport(true);

    await screen.findByText("Big");
    expect(screen.getByText("pages.financeTotal")).toBeTruthy();
    // Net profit total, in the shared currency — once in its KPI card, once in the footer.
    expect(screen.getAllByText(shown(700, "EUR")).length).toBe(2);
    expect(screen.queryByText(/^Mixed:/)).toBeNull();
  });

  it("shows each outlet in its own currency and never adds rupiah to euros", async () => {
    h.get.mockResolvedValue(MIXED_CURRENCY);
    h.search.current = "scope=all";
    renderReport(true);

    await screen.findByText("Big");
    expect(screen.getByText("Mixed: EUR, IDR")).toBeTruthy();
    expect(screen.getByText(shown(1000, "EUR"))).toBeTruthy();
    expect(screen.getByText(shown(2_000_000, "IDR"))).toBeTruthy();
    expect(screen.queryByText("pages.financeTotal")).toBeNull();
    // Counts still add up across currencies.
    expect(screen.getByText("pages.financeOutletCount")).toBeTruthy();
  });

  it("shows a retry instead of a blank page when the roll-up fails", async () => {
    h.get.mockRejectedValue(new Error("boom"));
    h.search.current = "scope=all";
    renderReport(true);

    expect((await screen.findAllByText("pages.financeLoadError")).length).toBeGreaterThan(0);
  });
});
