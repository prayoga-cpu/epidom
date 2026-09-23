import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReceiptData } from "@/lib/pwa/thermal-printer";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en" }),
}));

const { toast } = vi.hoisted(() => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("sonner", () => ({ toast }));

const printer = vi.hoisted(() => ({
  isBluetoothSupported: vi.fn(),
  isPrinterConnected: vi.fn(),
  printReceipt: vi.fn(),
  connectPrinter: vi.fn(),
  disconnectPrinter: vi.fn(),
}));
vi.mock("@/lib/pwa/thermal-printer", () => printer);

import { usePrintReceipt } from "../use-print-receipt";
import { usePrinterSettings } from "../use-printer-settings";

const receipt = { orderNumber: "A-1" } as unknown as ReceiptData;

beforeEach(() => {
  printer.isBluetoothSupported.mockReturnValue(true);
  printer.isPrinterConnected.mockReturnValue(true);
  printer.printReceipt.mockResolvedValue(undefined);
});

describe("usePrintReceipt", () => {
  it("prints on a connected printer and confirms", async () => {
    const { result } = renderHook(() => usePrintReceipt());
    await act(() => result.current.print(receipt));
    expect(printer.printReceipt).toHaveBeenCalledWith(receipt);
    expect(toast.success).toHaveBeenCalledWith("pos.print.success");
  });

  it("says so — and does nothing else — when the browser has no Bluetooth", async () => {
    printer.isBluetoothSupported.mockReturnValue(false);
    const { result } = renderHook(() => usePrintReceipt());
    await act(() => result.current.print(receipt));
    expect(toast.error).toHaveBeenCalledWith("pos.print.bluetoothUnsupported");
    expect(printer.printReceipt).not.toHaveBeenCalled();
  });

  it("pairs through the printer-settings store first when no printer is connected", async () => {
    printer.isPrinterConnected.mockReturnValue(false);
    const connect = vi.fn().mockResolvedValue(true);
    usePrinterSettings.setState({ connect });
    const { result } = renderHook(() => usePrintReceipt());
    await act(() => result.current.print(receipt));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(printer.printReceipt).toHaveBeenCalledWith(receipt);
  });

  it("reports a failed pairing and does not print", async () => {
    printer.isPrinterConnected.mockReturnValue(false);
    usePrinterSettings.setState({ connect: vi.fn().mockResolvedValue(false) });
    const { result } = renderHook(() => usePrintReceipt());
    await act(() => result.current.print(receipt));
    expect(toast.error).toHaveBeenCalledWith("pos.print.connectFailed");
    expect(printer.printReceipt).not.toHaveBeenCalled();
  });

  it("surfaces the printer's own error and never throws", async () => {
    printer.printReceipt.mockRejectedValue(new Error("Paper out"));
    const { result } = renderHook(() => usePrintReceipt());
    await act(() => result.current.print(receipt));
    expect(toast.error).toHaveBeenCalledWith("Paper out");
    expect(result.current.isPrinting).toBe(false);
  });

  it("falls back to the generic message when the error has none", async () => {
    printer.printReceipt.mockRejectedValue(undefined);
    const { result } = renderHook(() => usePrintReceipt());
    await act(() => result.current.print(receipt));
    expect(toast.error).toHaveBeenCalledWith("pos.print.failed");
  });

  it("isPrinting is true only while a print is in flight", async () => {
    let finish!: () => void;
    printer.printReceipt.mockReturnValue(new Promise<void>((r) => (finish = r)));
    const { result } = renderHook(() => usePrintReceipt());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.print(receipt);
    });
    expect(result.current.isPrinting).toBe(true);
    await act(async () => {
      finish();
      await pending;
    });
    expect(result.current.isPrinting).toBe(false);
  });
});
