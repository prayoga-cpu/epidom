import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";

/**
 * The PDF companion prints the same totals as the screen: every table closes
 * on its total, and the P&L reaches profit after expenses.
 */

vi.setConfig({ testTimeout: 60_000 });

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key, formatDateTime: (v: string) => v }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({
    formatPrice: (v: number | null | undefined) => {
      const n = Number(v ?? 0);
      return `${n < 0 ? "-" : ""}€${Math.abs(n).toFixed(2)}`;
    },
  }),
}));
vi.mock("@/features/dashboard/shared/components/print-report-shell", () => ({
  PrintReportShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { FinancePrintView } from "../components/finance-print-view";

const SUMMARY = {
  revenue: 1110,
  grossRevenue: 1200,
  discountAmount: 90,
  refundAmount: 100,
  cogs: 400,
  grossProfit: 500,
  grossMarginPct: 55.56,
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
  awaitingPaymentAmount: 0,
  awaitingPaymentCount: 0,
  buckets: [
    {
      date: "2026-10-01",
      orderCount: 10,
      revenue: 1110,
      discountAmount: 90,
      refundAmount: 100,
      taxCollected: 110,
      netSales: 900,
    },
  ],
};

function renderView() {
  return render(
    <FinancePrintView
      storeName="Test"
      currency="EUR"
      from="2026-10-01"
      to="2026-10-06"
      generatedAt="2026-10-06T10:00:00Z"
      filters={{ staffLabel: null, categoryId: null, categoryName: null, department: null }}
      summary={SUMMARY}
      channels={[]}
      paymentMethods={[
        { paymentMethod: "CASH", orderCount: 6, revenue: 660, percentOfTotal: 59.5 },
        { paymentMethod: "QRIS", orderCount: 5, revenue: 450, percentOfTotal: 40.5 },
      ]}
      topItems={[]}
      topItemsTotals={null}
      itemMargin={[
        {
          name: "Latte",
          orderCount: 5,
          totalQuantity: 7,
          totalRevenue: 350,
          totalCost: 100,
          margin: 250,
          marginPct: 71.4,
        },
        {
          name: "Grab item",
          orderCount: 1,
          totalQuantity: 1,
          totalRevenue: 50,
          totalCost: null,
          margin: null,
          marginPct: null,
        },
      ]}
      categories={[]}
      categoryTotals={null}
      departments={[]}
      shifts={[]}
      scheduleShiftRows={[]}
      scheduleTotals={null}
      wasteReasons={[]}
      wasteEntries={[]}
      wasteTotals={{ count: 0, value: 0 }}
      expenses={{ total: 250, byCategory: [{ category: "RENT", count: 1, amount: 250 }] }}
    />
  );
}

describe("FinancePrintView", () => {
  it("prints the P&L down to profit after expenses", () => {
    renderView();
    const row = screen.getByText("pages.financeProfitAfterExpenses").closest("tr") as HTMLElement;
    expect(within(row).getByText("€150.00")).toBeTruthy();
  });

  it("closes Payment Method on its total", () => {
    renderView();
    const section = screen.getByText("pages.financePayments").closest("section") as HTMLElement;
    const footer = section.querySelector("tfoot") as HTMLElement;
    expect(within(footer).getByText("11")).toBeTruthy();
    expect(within(footer).getByText("€1110.00")).toBeTruthy();
  });

  it("totals Item Margin over costed items and lists the uncosted apart", () => {
    renderView();
    const costed = screen.getByText("pages.financeCostedTotal").closest("tr") as HTMLElement;
    expect(within(costed).getByText("€350.00")).toBeTruthy();
    expect(within(costed).getByText("€250.00")).toBeTruthy();
    const uncosted = screen.getByText("pages.financeUncostedItems").closest("tr") as HTMLElement;
    expect(within(uncosted).getByText("€50.00")).toBeTruthy();
  });
});
