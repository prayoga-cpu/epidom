import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const mockReport = vi.fn();
vi.mock("@/features/pos/hooks/use-my-shift", () => ({ useShiftReport: () => mockReport() }));

const mockPrint = vi.fn();
vi.mock("@/features/pos/hooks/use-print-shift-report", () => ({
  usePrintShiftReport: () => ({ print: mockPrint, isPrinting: false }),
}));
vi.mock("@/features/pos/hooks/use-printer-settings", () => ({
  usePrinterSettings: (selector: (s: unknown) => unknown) =>
    selector({ printers: { MAIN: { paperWidth: 48 } } }),
}));

const mockBluetooth = vi.fn();
vi.mock("@/lib/pwa/thermal-printer", () => ({ isBluetoothSupported: () => mockBluetooth() }));

import { toast } from "sonner";
import { ShiftClosedDialog } from "../shift/shift-closed-dialog";

const response = {
  storeName: "Tahoma Coffee & Eatery",
  currency: "IDR",
  shiftLabel: "Sam",
  report: {
    window: {
      from: "2026-08-08T11:00:00.000Z",
      to: "2026-08-08T19:00:00.000Z",
      isOpen: false,
    },
    sales: {
      grossSales: 147_800,
      discount: 0,
      serviceCharge: 0,
      tax: 0,
      processingFee: 0,
      delivery: 0,
      refund: 0,
      total: 147_800,
    },
    invoices: { count: 5, averagePerInvoice: 29_560 },
    cancellations: { invoiceCount: 0, itemCount: 0, total: 0 },
    byOrderType: [],
    byGuest: null,
    byPaymentMethod: [],
    byProduct: { categories: [], totalQuantity: 0, totalGross: 0 },
    cashDrawer: {
      scope: "SHIFT",
      staffName: "Sam",
      openedAt: "2026-08-08T11:00:00.000Z",
      closedAt: "2026-08-08T19:00:00.000Z",
      tillCount: 1,
      hasOpenTill: false,
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
      closingCash: 0,
      cashDifference: -80_000,
    },
  },
};

const ended = { shiftId: "shift-1", staffName: "Sam" };

// Inside act: the auto-print resolves a promise and sets state right after mount.
async function renderDialog() {
  const onDone = vi.fn();
  await act(async () => {
    render(<ShiftClosedDialog storeId="s1" ended={ended} onDone={onDone} />);
  });
  return { onDone };
}

const printButton = () => screen.getByRole("button", { name: /pos\.shift\.printReport/ });

beforeEach(() => {
  mockReport.mockReset();
  mockPrint.mockReset();
  mockBluetooth.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  mockReport.mockReturnValue({ data: response, isLoading: false });
  mockPrint.mockResolvedValue("skipped");
  mockBluetooth.mockReturnValue(true);
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  vi.spyOn(window, "open").mockImplementation(() => null);
});

describe("ShiftClosedDialog — preview", () => {
  it("previews the very same report document that gets printed, with the closing count on it", async () => {
    await renderDialog();
    expect(screen.getByRole("heading", { name: "pos.shift.closedTitle" })).toBeInTheDocument();
    // The real ShiftReportDocument, not a stand-in: store, the shift title, and
    // the cash block with the closing count and the variance (labels.en).
    expect(screen.getByText("Tahoma Coffee & Eatery")).toBeInTheDocument();
    expect(screen.getByText("SHIFT REPORT")).toBeInTheDocument();
    expect(screen.getByText("Closing Cash")).toBeInTheDocument();
    expect(screen.getByText("Difference").closest("div")).toHaveTextContent("80,000");
  });

  it("loading: says so, and Print waits for the report", async () => {
    mockReport.mockReturnValue({ data: undefined, isLoading: true });
    await renderDialog();
    expect(screen.getByText("pos.shift.previewLoading")).toBeInTheDocument();
    expect(printButton()).toBeDisabled();
    expect(mockPrint).not.toHaveBeenCalled();
  });

  it("a report that fails to load still leaves the link usable", async () => {
    mockReport.mockReturnValue({ data: undefined, isLoading: false });
    await renderDialog();
    expect(screen.getByText("pos.shift.previewFailed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pos\.shift\.openReport/ })).toBeInTheDocument();
  });
});

describe("ShiftClosedDialog — printing", () => {
  it("prints by itself, once, on the connected receipt printer — with the store's own data at the till's paper width", async () => {
    mockPrint.mockResolvedValue("printed");
    let rerender!: ReturnType<typeof render>["rerender"];
    await act(async () => {
      rerender = render(
        <ShiftClosedDialog storeId="s1" ended={ended} onDone={() => {}} />
      ).rerender;
    });

    await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(1));
    const [input, options] = mockPrint.mock.calls[0];
    expect(options).toEqual({ pairIfNeeded: false });
    expect(input).toMatchObject({
      storeName: "Tahoma Coffee & Eatery",
      currency: "IDR",
      locale: "en",
      width: 48,
      shiftLabel: "Sam",
      report: response.report,
    });
    expect(await screen.findByText("pos.shift.printedAuto")).toBeInTheDocument();

    // A re-render must not put a second copy on paper.
    rerender(<ShiftClosedDialog storeId="s1" ended={ended} onDone={() => {}} />);
    expect(mockPrint).toHaveBeenCalledTimes(1);
  });

  it("no printer connected: no popup and no error — a hint, and the Print button is the way in", async () => {
    mockPrint.mockResolvedValue("skipped");
    await renderDialog();

    expect(await screen.findByText("pos.shift.printNeedsPrinter")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("no Bluetooth at all (iPad Safari): does not talk about a printer to connect", async () => {
    mockBluetooth.mockReturnValue(false);
    mockPrint.mockResolvedValue("skipped");
    await renderDialog();

    await waitFor(() => expect(mockPrint).toHaveBeenCalled());
    expect(screen.queryByText("pos.shift.printNeedsPrinter")).toBeNull();
  });

  it("the Print button pairs a printer if it has to", async () => {
    mockPrint.mockResolvedValue("skipped");
    await renderDialog();
    await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(1));

    mockPrint.mockResolvedValue("printed");
    fireEvent.click(printButton());

    await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(2));
    expect(mockPrint.mock.calls[1][1]).toEqual({ pairIfNeeded: true });
    expect(await screen.findByText("pos.shift.printedAuto")).toBeInTheDocument();
  });

  it("without Web Bluetooth the Print button falls back to the browser's print dialog on the report page", async () => {
    mockBluetooth.mockReturnValue(false);
    await renderDialog();
    await waitFor(() => expect(mockPrint).toHaveBeenCalledTimes(1));

    fireEvent.click(printButton());

    expect(window.open).toHaveBeenCalledWith(
      "/store/s1/pos/orders/daily-report?shiftId=shift-1",
      "_blank"
    );
    // Thermal print was only ever the silent auto attempt, never the button.
    expect(mockPrint).toHaveBeenCalledTimes(1);
  });
});

describe("ShiftClosedDialog — the link", () => {
  it("Open report is a real link to the standalone report page, in a new tab, without auto-printing", async () => {
    await renderDialog();
    const link = screen.getByRole("link", { name: /pos\.shift\.openReport/ });
    expect(link).toHaveAttribute(
      "href",
      "/store/s1/pos/orders/daily-report?shiftId=shift-1&print=0"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("Copy link puts the absolute URL on the clipboard", async () => {
    await renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /pos\.shift\.copyLink/ }));

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        `${window.location.origin}/store/s1/pos/orders/daily-report?shiftId=shift-1&print=0`
      )
    );
    expect(toast.success).toHaveBeenCalledWith("pos.shift.linkCopied");
  });

  it("a clipboard that refuses is reported, not swallowed", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("denied"));
    await renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /pos\.shift\.copyLink/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("pos.shift.copyFailed"));
  });

  it("Done dismisses", async () => {
    const { onDone } = await renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "pos.shift.done" }));
    expect(onDone).toHaveBeenCalled();
  });
});
