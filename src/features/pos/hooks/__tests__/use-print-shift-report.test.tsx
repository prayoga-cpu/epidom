import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({ useI18n: () => ({ t: (k: string) => k }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const bluetooth = vi.fn();
const connected = vi.fn();
const printShiftReport = vi.fn();
vi.mock("@/lib/pwa/thermal-printer", () => ({
  isBluetoothSupported: () => bluetooth(),
  isPrinterConnected: () => connected(),
  printShiftReport: (input: unknown) => printShiftReport(input),
}));

const connect = vi.fn();
vi.mock("../use-printer-settings", () => ({
  usePrinterSettings: { getState: () => ({ connect }) },
}));

import { toast } from "sonner";
import { usePrintShiftReport } from "../use-print-shift-report";

const input = { report: {}, storeName: "Cafe", currency: "IDR" } as never;

async function run(options?: { pairIfNeeded?: boolean }) {
  const { result } = renderHook(() => usePrintShiftReport());
  let outcome: string | undefined;
  await act(async () => {
    outcome = await result.current.print(input, options);
  });
  return outcome;
}

beforeEach(() => {
  bluetooth.mockReset().mockReturnValue(true);
  connected.mockReset().mockReturnValue(true);
  connect.mockReset().mockResolvedValue(true);
  printShiftReport.mockReset().mockResolvedValue(undefined);
  vi.mocked(toast.error).mockReset();
  vi.mocked(toast.success).mockReset();
});

describe("usePrintShiftReport — automatic (pairIfNeeded: false)", () => {
  it("prints on a printer that is already connected", async () => {
    expect(await run({ pairIfNeeded: false })).toBe("printed");
    expect(printShiftReport).toHaveBeenCalledWith(input);
    expect(toast.success).toHaveBeenCalledWith("pos.print.success");
  });

  it("never opens a device chooser: nothing connected means skipped, quietly", async () => {
    connected.mockReturnValue(false);
    expect(await run({ pairIfNeeded: false })).toBe("skipped");
    expect(connect).not.toHaveBeenCalled();
    expect(printShiftReport).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("a browser with no Web Bluetooth is skipped without a complaint", async () => {
    bluetooth.mockReturnValue(false);
    expect(await run({ pairIfNeeded: false })).toBe("skipped");
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("usePrintShiftReport — a tap (pairIfNeeded defaults to true)", () => {
  it("pairs a printer first when none is connected, then prints", async () => {
    connected.mockReturnValue(false);
    expect(await run()).toBe("printed");
    expect(connect).toHaveBeenCalledTimes(1);
    expect(printShiftReport).toHaveBeenCalled();
  });

  it("a cancelled or failed pairing is reported and nothing is printed", async () => {
    connected.mockReturnValue(false);
    connect.mockResolvedValue(false);
    expect(await run()).toBe("failed");
    expect(toast.error).toHaveBeenCalledWith("pos.print.connectFailed");
    expect(printShiftReport).not.toHaveBeenCalled();
  });

  it("no Web Bluetooth is an error the cashier is told about", async () => {
    bluetooth.mockReturnValue(false);
    expect(await run()).toBe("failed");
    expect(toast.error).toHaveBeenCalledWith("pos.print.bluetoothUnsupported");
  });

  it("a printer that errors mid-print is reported, never thrown at closing a shift", async () => {
    printShiftReport.mockRejectedValue(new Error("Printer tidak terhubung"));
    expect(await run()).toBe("failed");
    expect(toast.error).toHaveBeenCalledWith("Printer tidak terhubung");
  });

  it("falls back to a generic message when the failure carries none", async () => {
    printShiftReport.mockRejectedValue(undefined);
    expect(await run()).toBe("failed");
    expect(toast.error).toHaveBeenCalledWith("pos.print.failed");
  });
});
