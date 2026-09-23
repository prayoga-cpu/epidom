import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, formatDateTime: (d: string) => `DT(${d})` }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({
    currency: "IDR",
    formatPrice: (v: number, c?: string) => `${c ?? "?"} ${v}`,
  }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const mockReport = vi.fn();
const mockClose = vi.fn();
vi.mock("@/features/pos/hooks/use-active-shift", () => ({
  useShiftReport: () => mockReport(),
  useCloseShift: () => mockClose(),
}));

import { toast } from "sonner";
import { ApiClientError } from "@/lib/api/client";
import { FinishShiftScreen } from "../shift/finish-shift-screen";

const shift = {
  id: "shift-1",
  openedAt: "2026-08-08T11:00:00.000Z",
  closedAt: null,
  openingCash: "0",
  closingCash: null,
  staffMember: { id: "staff-1", name: "Sam", role: "CASHIER" },
};

// The reference screens: no float, 80.000 cash sales, 67.800 by QRIS.
function reportResponse(drawerOverrides: Record<string, unknown> = {}) {
  return {
    storeName: "Tahoma Coffee & Eatery",
    currency: "IDR",
    shiftLabel: "Sam",
    report: {
      window: { from: shift.openedAt, to: "2026-08-08T19:00:00.000Z", isOpen: true },
      sales: { total: 147_800 },
      invoices: { count: 5, averagePerInvoice: 29_560 },
      cancellations: { invoiceCount: 1, itemCount: 2, total: 5_000 },
      byPaymentMethod: [
        { paymentMethod: "CASH", orderCount: 4, revenue: 80_000, percentOfTotal: 54 },
        { paymentMethod: "QRIS", orderCount: 1, revenue: 67_800, percentOfTotal: 46 },
      ],
      cashDrawer: {
        scope: "SHIFT",
        openingCash: 0,
        cashSales: 80_000,
        cashRefunds: 0,
        tips: 0,
        pettyIn: 0,
        pettyOut: 0,
        drops: 0,
        tipPayouts: 0,
        unlinkedCashSales: 0,
        expectedCash: 80_000,
        closingCash: null,
        cashDifference: null,
        ...drawerOverrides,
      },
    },
  };
}

let refetch: ReturnType<typeof vi.fn>;
let mutateAsync: ReturnType<typeof vi.fn>;

function renderScreen(props: Partial<Parameters<typeof FinishShiftScreen>[0]> = {}) {
  const onBack = vi.fn();
  const onEnded = vi.fn();
  render(
    <FinishShiftScreen storeId="s1" shift={shift} onBack={onBack} onEnded={onEnded} {...props} />
  );
  return { onBack, onEnded };
}

const countInput = () => screen.getByLabelText("pos.shift.countedCash");
const endButton = () => screen.getByRole("button", { name: "pos.shift.endShift" });

beforeEach(() => {
  vi.mocked(toast.error).mockReset();
  refetch = vi.fn().mockResolvedValue({});
  mutateAsync = vi.fn().mockResolvedValue({});
  mockReport.mockReturnValue({
    data: reportResponse(),
    isLoading: false,
    isError: false,
    refetch,
  });
  mockClose.mockReturnValue({ mutateAsync, isPending: false });
});

describe("FinishShiftScreen — what the cashier sees", () => {
  it("shows the shift's start, the cash rows and the expected total", () => {
    renderScreen();
    expect(screen.getByText(`DT(${shift.openedAt})`)).toBeInTheDocument();
    expect(screen.getByText("pages.openingCash")).toBeInTheDocument();
    expect(screen.getByText("pages.cashSales")).toBeInTheDocument();
    expect(screen.getByText("pages.expectedCash").closest("div")).toHaveTextContent("IDR 80000");
  });

  it("only lists movement categories something happened in", () => {
    renderScreen();
    expect(screen.queryByText("pages.cashTips")).toBeNull();
    expect(screen.queryByText("pages.cashMovementTypePettyOut")).toBeNull();
  });

  it("lists non-cash payments with their order counts, and their total — cash stays in the drawer section", () => {
    renderScreen();
    const payments = screen.getByText("pos.shift.paymentsSection").closest("div")!;
    // The QRIS row: its label, its order count and its amount on one line.
    const qrisRow = within(payments)
      .getByText(/publicOrder\.paymentMethods\.QRIS/)
      .closest("div")!;
    expect(qrisRow).toHaveTextContent("pos.shift.orderCountOne");
    expect(qrisRow).toHaveTextContent("IDR 67800");
    // …and the total beneath it (equal here because QRIS is the only non-cash method).
    expect(within(payments).getByText("pos.shift.paymentsTotal").closest("div")).toHaveTextContent(
      "IDR 67800"
    );
    expect(within(payments).queryByText(/paymentMethods\.CASH/)).toBeNull();
  });

  it("shows how many orders the shift took, and the cancelled ones apart from them", () => {
    renderScreen();
    const orders = screen.getByText("pos.shift.orders").closest("div")!;
    expect(orders).toHaveTextContent("5");
    expect(screen.getByText("pos.shift.cancelledOrders").closest("div")).toHaveTextContent("1");
    expect(screen.getByText("pos.shift.totalSales").closest("div")).toHaveTextContent("IDR 147800");
  });

  it("surfaces cash no till was linked to, without counting it", () => {
    mockReport.mockReturnValue({
      data: reportResponse({ unlinkedCashSales: 12_500 }),
      isLoading: false,
      isError: false,
      refetch,
    });
    renderScreen();
    expect(screen.getByText("pos.shift.unlinkedCash").closest("div")).toHaveTextContent(
      "IDR 12500"
    );
    // Expected total is still the server's figure — 80.000, not 92.500.
    expect(screen.getByText("pages.expectedCash").closest("div")).toHaveTextContent("IDR 80000");
  });

  it("a failed load offers a retry instead of a blank screen", () => {
    mockReport.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "common.actions.retry" }));
    expect(refetch).toHaveBeenCalled();
    expect(screen.queryByText("pos.shift.cashSection")).toBeNull();
  });
});

describe("FinishShiftScreen — counting the drawer", () => {
  it("cannot end the shift until a count is typed, and says why", () => {
    renderScreen();
    expect(endButton()).toBeDisabled();
    expect(screen.getByText("pos.shift.countedRequired")).toBeInTheDocument();
    expect(screen.getByText("pos.shift.differencePending")).toBeInTheDocument();
  });

  it("counting nothing is a count of zero and reads as a full shortage", () => {
    renderScreen();
    fireEvent.change(countInput(), { target: { value: "0" } });

    expect(endButton()).toBeEnabled();
    const difference = screen.getByRole("status");
    expect(difference).toHaveTextContent("IDR -80000");
    expect(difference).toHaveTextContent("pos.shift.differenceShort");
  });

  it("an exact count is balanced; an overage is flagged as over", () => {
    renderScreen();
    fireEvent.change(countInput(), { target: { value: "80000" } });
    expect(screen.getByRole("status")).toHaveTextContent("pos.shift.differenceBalanced");

    fireEvent.change(countInput(), { target: { value: "81000" } });
    expect(screen.getByRole("status")).toHaveTextContent("pos.shift.differenceOver");
    expect(screen.getByRole("status")).toHaveTextContent("+IDR 1000");
  });

  it("the count is not pre-filled with the expected cash", () => {
    renderScreen();
    expect(countInput()).toHaveValue("");
  });
});

describe("FinishShiftScreen — ending the shift", () => {
  async function countAndEnd(count: string, note?: string) {
    fireEvent.change(countInput(), { target: { value: count } });
    if (note !== undefined) {
      fireEvent.change(screen.getByLabelText("pos.shift.note"), { target: { value: note } });
    }
    fireEvent.click(endButton());
    return await screen.findByText("pos.shift.confirmTitle");
  }

  it("asks for confirmation first, showing the numbers about to be signed off", async () => {
    renderScreen();
    await countAndEnd("0", "  drawer short, will check  ");

    // Re-read the figures before signing off, not up to 30s old.
    expect(refetch).toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Tahoma Coffee & Eatery")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("IDR 80000"); // expected
    expect(dialog).toHaveTextContent("IDR -80000"); // difference
    expect(dialog).toHaveTextContent("IDR 67800"); // other payments
    expect(dialog).toHaveTextContent("drawer short, will check");
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("shows a dash for an empty note", async () => {
    renderScreen();
    await countAndEnd("80000");
    expect(screen.getByRole("dialog")).toHaveTextContent("pos.shift.confirmNone");
  });

  it("Cancel leaves the shift open", async () => {
    renderScreen();
    await countAndEnd("80000");
    fireEvent.click(screen.getByRole("button", { name: "common.actions.cancel" }));

    await waitFor(() => expect(screen.queryByText("pos.shift.confirmTitle")).toBeNull());
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("confirming closes the shift with the counted cash and the trimmed note, then hands over to the report", async () => {
    const { onEnded } = renderScreen();
    await countAndEnd("79500", "  short 500  ");

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "pos.shift.endShift" }));

    await waitFor(() => expect(onEnded).toHaveBeenCalled());
    expect(mutateAsync).toHaveBeenCalledWith({
      shiftId: "shift-1",
      closingCash: 79_500,
      notes: "short 500",
    });
    expect(onEnded).toHaveBeenCalledWith({ shiftId: "shift-1", staffName: "Sam" });
  });

  it("an empty note is sent as no note at all", async () => {
    renderScreen();
    await countAndEnd("80000", "   ");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "pos.shift.endShift" })
    );

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync).toHaveBeenCalledWith({
      shiftId: "shift-1",
      closingCash: 80_000,
      notes: undefined,
    });
  });

  // The shift is the store's, so "somebody else already finished it" is routine now: a
  // 409 says so instead of inviting a retry that can never succeed.
  it("a 409 says the shift was already ended — not the generic 'try again'", async () => {
    mutateAsync.mockRejectedValue(
      new ApiClientError(
        { success: false, error: { code: "CONFLICT", message: "Shift is already closed" } } as never,
        409
      )
    );
    const { onEnded } = renderScreen();
    await countAndEnd("80000");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "pos.shift.endShift" })
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("pos.shift.alreadyEnded"));
    expect(toast.error).not.toHaveBeenCalledWith("pos.shift.endFailed");
    expect(onEnded).not.toHaveBeenCalled();
  });

  it("a failed close reports it and does not move on to the report", async () => {
    mutateAsync.mockRejectedValue(new Error("boom"));
    const { onEnded } = renderScreen();
    await countAndEnd("80000");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "pos.shift.endShift" })
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("pos.shift.endFailed"));
    expect(onEnded).not.toHaveBeenCalled();
  });
});

describe("FinishShiftScreen — going back", () => {
  it("Back returns to the shift without closing anything (header arrow and footer button)", () => {
    const { onBack } = renderScreen();
    const backButtons = screen.getAllByRole("button", { name: "pos.shift.back" });
    expect(backButtons).toHaveLength(2);
    backButtons.forEach((b) => fireEvent.click(b));
    expect(onBack).toHaveBeenCalledTimes(2);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("the two footer buttons share the row with flex-1, never w-full", () => {
    renderScreen();
    for (const button of [
      endButton(),
      screen.getAllByRole("button", { name: "pos.shift.back" })[1],
    ]) {
      expect(button.className).toContain("flex-1");
      expect(button.className).not.toContain("w-full");
      expect(button.className).toContain("h-12");
    }
  });
});
