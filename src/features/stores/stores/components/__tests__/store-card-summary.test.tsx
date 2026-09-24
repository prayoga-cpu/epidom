import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { StoreOverview } from "@/types/api/store-overview";

// No CurrencyProvider is mounted anywhere in this file: the figures must not
// depend on useCurrency().formatPrice.
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, intlLocale: "en-US" }),
}));

import { StoreCardSummary, formatStoreMoney } from "../store-card-summary";

function overview(o: Partial<StoreOverview> = {}): StoreOverview {
  return {
    storeId: "store-001",
    tagline: null,
    logoUrl: null,
    coverUrl: null,
    themeColor: null,
    currency: "IDR",
    market: "INDONESIA",
    stats: { revenue: 0, customerCount: 0, staffCount: 0 },
    ...o,
  };
}

describe("StoreCardSummary — slogan", () => {
  it("renders a non-empty slogan, clamped to two lines", () => {
    render(<StoreCardSummary summary={overview({ tagline: "Best kopi in town" })} showTotals />);
    const slogan = screen.getByText("Best kopi in town");
    expect(slogan.tagName).toBe("P");
    expect(slogan.className).toContain("line-clamp-2");
  });

  it("renders no slogan paragraph when there is none", () => {
    const { container } = render(<StoreCardSummary summary={overview()} showTotals />);
    expect(container.querySelector("p")).toBeNull();
  });
});

describe("StoreCardSummary — money in the store's own currency", () => {
  it("formats EUR revenue with its symbol and cents", () => {
    render(
      <StoreCardSummary
        summary={overview({
          currency: "EUR",
          market: "FRANCE",
          stats: { revenue: 1234.5, customerCount: 2, staffCount: 0 },
        })}
        showTotals
      />
    );
    expect(screen.getByText("€1,234.50")).toBeInTheDocument();
  });

  it("formats IDR revenue with no decimals", () => {
    render(
      <StoreCardSummary
        summary={overview({ stats: { revenue: 1234567, customerCount: 0, staffCount: 0 } })}
        showTotals
      />
    );
    expect(screen.getByText("IDR 1,234,567")).toBeInTheDocument();
  });

  it("falls back to code + number for a malformed currency code instead of throwing", () => {
    expect(formatStoreMoney(12.5, "not-a-code")).toBe("not-a-code 12.50");
  });
});

describe("StoreCardSummary — which cells show", () => {
  it("shows revenue, customers, market and currency; no staff cell when there are no staff", () => {
    render(
      <StoreCardSummary
        summary={overview({ stats: { revenue: 10, customerCount: 1234, staffCount: 0 } })}
        showTotals
      />
    );
    expect(screen.getByText("stores.summary.revenue")).toBeInTheDocument();
    expect(screen.getByText("stores.summary.customers")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.queryByText("stores.summary.staff")).toBeNull();
    expect(screen.getByText("stores.summary.market")).toBeInTheDocument();
    expect(screen.getByText("stores.summary.currency")).toBeInTheDocument();
    expect(screen.getByText("IDR")).toBeInTheDocument();
  });

  it("shows the staff cell once there are staff", () => {
    render(
      <StoreCardSummary
        summary={overview({ stats: { revenue: 10, customerCount: 0, staffCount: 3 } })}
        showTotals
      />
    );
    expect(screen.getByText("stores.summary.staff")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("keeps the revenue hint on the label", () => {
    render(<StoreCardSummary summary={overview()} showTotals />);
    expect(screen.getByText("stores.summary.revenue")).toHaveAttribute(
      "title",
      "stores.summary.revenueHint"
    );
  });

  it.each([
    ["FRANCE", "profile.feesAndTaxes.market.france"],
    ["INTERNATIONAL", "profile.feesAndTaxes.market.international"],
    ["INDONESIA", "profile.feesAndTaxes.market.indonesia"],
  ] as const)("labels the %s market with the fees-and-taxes key", (market, key) => {
    render(<StoreCardSummary summary={overview({ market })} showTotals />);
    expect(screen.getByText(key)).toBeInTheDocument();
  });

  it("with no stats (the server withheld them) shows only market and currency", () => {
    render(<StoreCardSummary summary={overview({ stats: null })} showTotals />);
    expect(screen.queryByText("stores.summary.revenue")).toBeNull();
    expect(screen.queryByText("stores.summary.customers")).toBeNull();
    expect(screen.queryByText("stores.summary.staff")).toBeNull();
    expect(screen.getByText("stores.summary.market")).toBeInTheDocument();
    expect(screen.getByText("stores.summary.currency")).toBeInTheDocument();
  });

  it("with showTotals false hides totals even when stats are present", () => {
    render(
      <StoreCardSummary
        summary={overview({ stats: { revenue: 999, customerCount: 5, staffCount: 2 } })}
        showTotals={false}
      />
    );
    expect(screen.queryByText("stores.summary.revenue")).toBeNull();
    expect(screen.queryByText("IDR 999")).toBeNull();
    expect(screen.queryByText("stores.summary.customers")).toBeNull();
    expect(screen.queryByText("stores.summary.staff")).toBeNull();
    expect(screen.getByText("stores.summary.market")).toBeInTheDocument();
  });
});

describe("StoreCardSummary — loading and missing", () => {
  it("shows a small skeleton while loading with no data yet (4 cells with totals, 2 without)", () => {
    const { rerender } = render(<StoreCardSummary summary={null} loading showTotals />);
    const skeleton = screen.getByTestId("store-card-summary-skeleton");
    expect(skeleton.children).toHaveLength(4);
    rerender(<StoreCardSummary summary={null} loading showTotals={false} />);
    expect(screen.getByTestId("store-card-summary-skeleton").children).toHaveLength(2);
  });

  it("renders nothing when there is no summary and nothing is loading (e.g. the overview failed)", () => {
    const { container } = render(<StoreCardSummary summary={null} showTotals />);
    expect(container).toBeEmptyDOMElement();
  });
});
