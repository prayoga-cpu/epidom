import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { configure, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * The single-outlet Finance report: the P&L statement adds up, every report
 * table closes on its totals, and the KPI cards follow the statement.
 */

configure({ asyncUtilTimeout: 8000 });
// The first render compiles a large component tree; on a loaded machine that
// alone can pass vitest's default per-test limit.
vi.setConfig({ testTimeout: 60_000 });

const h = vi.hoisted(() => ({
  search: { current: "" },
  replace: vi.fn(),
  get: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: h.replace, push: vi.fn() }),
  usePathname: () => "/store/s1/finance",
  useSearchParams: () => new URLSearchParams(h.search.current),
}));

// Keys come back as themselves; {placeholders} stay visible for assertions.
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    intlLocale: "en-US",
    formatDateTime: (v: string) => v,
    formatDayDate: (v: Date) => v.toISOString().slice(0, 10),
    formatTimeOnly: (v: string) => v,
  }),
}));

// Sign before the symbol, as Intl prints a negative amount.
const money = (v: number | null | undefined) => {
  const n = Number(v ?? 0);
  return `${n < 0 ? "-" : ""}€${Math.abs(n).toFixed(2)}`;
};
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({ currency: "EUR", formatPrice: (v: number | null | undefined) => money(v) }),
}));

vi.mock("@/lib/api/client", () => ({ apiClient: { get: h.get } }));
vi.mock("@/features/dashboard/data/custom-products/hooks/use-custom-products-settings", () => ({
  useCustomProductsSettings: () => ({ data: null }),
}));
vi.mock("@/features/pos/hooks/use-store-shifts", () => ({ useStoreShifts: () => ({ data: [] }) }));
vi.mock("@/features/dashboard/management/waste/hooks/use-waste", () => ({
  useWasteEntries: () => ({
    data: { entries: [], total: 0, sumValue: 0 },
    isLoading: false,
    isError: false,
  }),
  useDeleteWasteEntry: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/features/dashboard/management/waste/waste-form-dialog", () => ({
  WasteFormDialog: () => null,
}));
vi.mock("@/features/guide/components/page-intro", () => ({ PageIntro: () => null }));
vi.mock("@/components/ui/date-range-field", () => ({
  DateRangeField: ({ from, to }: { from: string; to: string }) => <span>{`${from}..${to}`}</span>,
}));

import { FinanceClient } from "../components/finance-client";

// 1,110 charged = 1,000 sales + 110 tax (11%); 90 off in discounts; 100
// refunded; 400 COGS; 20 card fees; 50 delivery-app commission; 30 waste.
const SUMMARY = {
  from: "2026-10-01T00:00:00Z",
  to: "2026-10-06T23:59:59Z",
  revenue: 1110,
  grossRevenue: 1200,
  discountAmount: 90,
  refundAmount: 100,
  cogs: 400,
  grossProfit: 500,
  grossMarginPct: 55.56,
  unknownCostLines: 0,
  unknownCostRevenue: 0,
  wasteLoss: 30,
  taxCollected: 110,
  serviceCharge: 0,
  processingFee: 20,
  netSales: 900,
  netRevenue: 880,
  platformCommission: 50,
  netProfit: 400,
  orderCount: 10,
  deliveryFee: 0,
  awaitingPaymentAmount: 60,
  awaitingPaymentCount: 2,
  buckets: [
    {
      date: "2026-10-01",
      orderCount: 4,
      revenue: 600,
      discountAmount: 40,
      refundAmount: 100,
      taxCollected: 50,
      netSales: 450,
    },
    {
      date: "2026-10-02",
      orderCount: 6,
      revenue: 510,
      discountAmount: 50,
      refundAmount: 0,
      taxCollected: 60,
      netSales: 450,
    },
  ],
};

const RESPONSES: Record<string, unknown> = {
  summary: SUMMARY,
  channels: {
    channels: [
      {
        source: "POS",
        label: "POS Cashier",
        orderCount: 8,
        revenue: 860,
        commissionPct: 0,
        commissionAmount: 0,
        refundAmount: 100,
        taxAmount: 85,
        processingFeeAmount: 20,
        netRevenue: 655,
      },
      {
        source: "GOFOOD",
        label: "GoFood",
        orderCount: 2,
        revenue: 250,
        commissionPct: 20,
        commissionAmount: 50,
        refundAmount: 0,
        taxAmount: 25,
        processingFeeAmount: 0,
        netRevenue: 175,
      },
    ],
  },
  "top-items": {
    items: [
      { name: "Latte", orderCount: 5, totalQuantity: 7, totalRevenue: 350 },
      { name: "Cake", orderCount: 3, totalQuantity: 3, totalRevenue: 150 },
    ],
    totals: { itemCount: 5, totalQuantity: 14, totalRevenue: 700 },
  },
  "by-category": {
    categories: [
      {
        categoryId: "c1",
        categoryName: "Drinks",
        orderItemCount: 6,
        orderCount: 5,
        totalQuantity: 9,
        totalRevenue: 450,
      },
      {
        categoryId: null,
        categoryName: "Uncategorized",
        orderItemCount: 3,
        orderCount: 3,
        totalQuantity: 5,
        totalRevenue: 550,
      },
    ],
    totals: { orderCount: 7, totalQuantity: 14, totalRevenue: 1000 },
  },
  "by-department": {
    departments: [
      { department: "KITCHEN", orderItemCount: 4, totalQuantity: 6, totalRevenue: 600 },
      { department: "BAR", orderItemCount: 5, totalQuantity: 8, totalRevenue: 400 },
    ],
  },
  "by-shift": { shifts: [] },
  "by-schedule-shift": { rows: [], totals: null },
  "by-payment-method": {
    methods: [
      { paymentMethod: "CASH", orderCount: 6, revenue: 660, percentOfTotal: 59.5 },
      { paymentMethod: "QRIS", orderCount: 5, revenue: 450, percentOfTotal: 40.5 },
    ],
  },
  "cash-reconciliation": { shifts: [] },
  "by-item-margin": { items: [] },
  "by-waste-reason": { reasons: [] },
  expenses: {
    expenses: [
      {
        id: "e1",
        date: "2026-10-01",
        category: "RENT",
        description: null,
        amount: 250,
      },
    ],
    total: 250,
    byCategory: [{ category: "RENT", count: 1, amount: 250 }],
  },
};

function respond(endpoint: string) {
  const path = endpoint.split("?")[0];
  const key = path.split("/finance/")[1];
  if (key && key in RESPONSES) return Promise.resolve(RESPONSES[key]);
  return Promise.reject(new Error(`unmocked ${endpoint}`));
}

function renderReport(search = "") {
  h.search.current = search;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<FinanceClient storeId="s1" staff={[]} categories={[]} />, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.get.mockImplementation(respond);
});

describe("FinanceClient — P&L statement", () => {
  it("prints the statement top to bottom, down to profit after expenses", async () => {
    renderReport();

    // Net profit 400 − 250 of rent.
    expect(await screen.findByText("€150.00")).toBeTruthy();
    const statement = screen.getByText("pages.financeProfitAfterExpenses").closest("div.max-w-2xl");
    expect(statement).toBeTruthy();
    const text = statement!.textContent ?? "";
    const order = [
      "pages.financeGrossRevenue",
      "pages.financeDiscount",
      "pages.financeRevenue",
      "pages.financeRefund",
      "pages.financeTax",
      "pages.financeNetSales",
      "pages.financeCogs",
      "pages.financeGrossProfit",
      "pages.financeProcessingFee",
      "pages.financePlatformCommission",
      "pages.financeWasteLoss",
      "pages.financeNetProfit",
      "pages.financeOperatingExpenses",
      "pages.financeProfitAfterExpenses",
    ].map((label) => text.indexOf(label));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Deductions print negative; Net sales is 1,110 − 100 − 110.
    expect(within(statement as HTMLElement).getByText("-€110.00")).toBeTruthy();
    expect(within(statement as HTMLElement).getAllByText("€900.00").length).toBeGreaterThan(0);
  });

  it("leaves store-wide expenses out of a statement narrowed by a filter", async () => {
    renderReport("channel=GOFOOD");

    expect(await screen.findByText("pages.financeExpensesFilteredNote")).toBeTruthy();
    expect(screen.queryByText("pages.financeProfitAfterExpenses")).toBeNull();
  });

  it("flags orders still waiting for payment on the Revenue card", async () => {
    renderReport();
    expect(await screen.findByText("pages.financeAwaitingPaymentShort")).toBeTruthy();
  });
});

describe("FinanceClient — report totals", () => {
  it("closes By Channel on its totals", async () => {
    renderReport("tab=channels");
    const footer = (await screen.findAllByText("pages.financeTotal"))
      .map((el) => el.closest("tfoot"))
      .find(Boolean) as HTMLElement;
    expect(footer).toBeTruthy();
    // 860 + 250 revenue, 655 + 175 net.
    expect(within(footer).getByText("€1110.00")).toBeTruthy();
    expect(within(footer).getByText("€830.00")).toBeTruthy();
    expect(within(footer).getByText("-€50.00")).toBeTruthy();
  });

  it("splits Top Items into the rows shown, everything else, and all items", async () => {
    renderReport("tab=items");
    expect((await screen.findAllByText("pages.financeTopSubtotal")).length).toBeGreaterThan(0);
    const footer = screen
      .getAllByText("pages.financeAllItems")
      .map((el) => el.closest("tfoot"))
      .find(Boolean) as HTMLElement;
    expect(within(footer).getByText("€500.00")).toBeTruthy(); // shown
    expect(within(footer).getByText("€200.00")).toBeTruthy(); // the other 3 items
    expect(within(footer).getByText("€700.00")).toBeTruthy(); // all items
  });

  it("bridges By Category's items subtotal to revenue", async () => {
    renderReport("tab=category");
    const footer = (await screen.findAllByText("pages.financeItemsSubtotal"))
      .map((el) => el.closest("tfoot"))
      .find(Boolean) as HTMLElement;
    expect(within(footer).getByText("€1000.00")).toBeTruthy();
    // 1,110 revenue − 1,000 of items = 110 of tax/discount/delivery adjustments.
    expect(within(footer).getByText("€110.00")).toBeTruthy();
    expect(within(footer).getByText("€1110.00")).toBeTruthy();
    // Distinct orders, not the column's 5 + 3.
    expect(within(footer).getByText("7")).toBeTruthy();
  });

  it("adds the Daily columns up to the summary", async () => {
    renderReport("tab=daily");
    const footer = (await screen.findAllByText("pages.financeTotal"))
      .map((el) => el.closest("tfoot"))
      .find(Boolean) as HTMLElement;
    expect(within(footer).getByText("10")).toBeTruthy();
    expect(within(footer).getByText("€1110.00")).toBeTruthy();
    expect(within(footer).getByText("€900.00")).toBeTruthy();
  });

  it("shows the Department split's total and shares", async () => {
    renderReport();
    expect(await screen.findByText("pages.financeItemsSubtotal")).toBeTruthy();
    expect(screen.getByText(/^60% ·/)).toBeTruthy();
  });

  it("says which active filters a report doesn't apply", async () => {
    renderReport("tab=channels&channel=GOFOOD");
    expect(await screen.findByText("pages.financeFilterIgnored")).toBeTruthy();
  });
});
