/**
 * The multi-printer Bluetooth registry, against a fake Web Bluetooth stack.
 *
 * What is being pinned: a role gets ITS printer's bytes and nobody else's; two
 * roles on one physical printer share one link and don't tear it down under each
 * other; a printer dropping out of range takes down exactly the roles riding it;
 * and prints never interleave.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRINTER_ROLES,
  PrinterNotConnectedError,
  PrinterTimeoutError,
  connectPrinter,
  disconnectPrinter,
  getPrinterDeviceName,
  isPrinterConnected,
  printBytes,
  subscribePrinterConnections,
} from "../printer-connection";

/** A fake BLE printer: records every write, and can drop the connection. */
function fakePrinter(id: string, name: string) {
  const written: number[][] = [];
  const listeners: Array<() => void> = [];
  const characteristic = {
    writeValueWithoutResponse: vi.fn(async (value: Uint8Array) => {
      written.push([...value]);
    }),
  };
  const gatt = {
    connected: false,
    connect: vi.fn(async () => {
      gatt.connected = true;
      return gatt;
    }),
    disconnect: vi.fn(() => {
      gatt.connected = false;
      for (const listener of listeners) listener();
    }),
    getPrimaryService: vi.fn(async () => ({ getCharacteristic: async () => characteristic })),
  };
  const device = {
    id,
    name,
    gatt,
    addEventListener: (_type: string, listener: () => void) => {
      listeners.push(listener);
    },
  };
  return { device, gatt, written, characteristic, dropOutOfRange: () => gatt.disconnect() };
}

const requestDevice = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, "bluetooth", {
    value: { requestDevice },
    configurable: true,
  });
});

afterEach(() => {
  for (const role of PRINTER_ROLES) disconnectPrinter(role);
  requestDevice.mockReset();
  vi.useRealTimers();
  // @ts-expect-error — undo the stub so other suites see no Bluetooth
  delete navigator.bluetooth;
});

/** Runs a print to completion under fake timers. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

describe("pairing", () => {
  it("binds the chosen printer to the role it was picked for", async () => {
    const kitchen = fakePrinter("dev-k", "XP-KITCHEN");
    requestDevice.mockResolvedValueOnce(kitchen.device);

    expect(await connectPrinter("KITCHEN")).toBe(true);

    expect(isPrinterConnected("KITCHEN")).toBe(true);
    expect(getPrinterDeviceName("KITCHEN")).toBe("XP-KITCHEN");
    // Other roles are untouched.
    expect(isPrinterConnected("MAIN")).toBe(false);
    expect(isPrinterConnected("BAR")).toBe(false);
  });

  it("resolves false — and changes nothing — when the picker is cancelled", async () => {
    requestDevice.mockRejectedValueOnce(
      Object.assign(new Error("cancelled"), { name: "NotFoundError" })
    );
    expect(await connectPrinter("BAR")).toBe(false);
    expect(isPrinterConnected("BAR")).toBe(false);
  });

  it("keeps a working printer when re-pairing the same role fails", async () => {
    const good = fakePrinter("dev-a", "GOOD");
    requestDevice.mockResolvedValueOnce(good.device);
    await connectPrinter("MAIN");

    requestDevice.mockRejectedValueOnce(
      Object.assign(new Error("nope"), { name: "NotFoundError" })
    );
    expect(await connectPrinter("MAIN")).toBe(false);

    expect(isPrinterConnected("MAIN")).toBe(true);
    expect(good.gatt.disconnect).not.toHaveBeenCalled();
  });

  it("tells subscribers about a connect and a disconnect, with the state already updated", async () => {
    // Recorded at call time: a subscriber must never be told BEFORE the registry is true.
    const seen: boolean[] = [];
    const unsubscribe = subscribePrinterConnections(() => seen.push(isPrinterConnected("MAIN")));
    requestDevice.mockResolvedValueOnce(fakePrinter("dev-a", "A").device);

    await connectPrinter("MAIN");
    expect(seen.at(-1)).toBe(true);

    disconnectPrinter("MAIN");
    expect(seen.at(-1)).toBe(false);
    // (More than one call is fine: a real gatt.disconnect() also fires its own event.)

    unsubscribe();
    const callsBefore = seen.length;
    requestDevice.mockResolvedValueOnce(fakePrinter("dev-b", "B").device);
    await connectPrinter("MAIN");
    expect(seen).toHaveLength(callsBefore);
  });
});

describe("a device that cannot be used", () => {
  it("lets go of a device it connected but found no printer profile on", async () => {
    // It passed the picker's filter but exposes neither known characteristic — a
    // printer in another mode, or the wrong model. Left connected, a single-central
    // printer would stay occupied until the page reloaded.
    const odd = fakePrinter("dev-odd", "NOT-A-PRINTER");
    odd.gatt.getPrimaryService.mockRejectedValue(new Error("no such service"));
    requestDevice.mockResolvedValueOnce(odd.device);

    expect(await connectPrinter("MAIN")).toBe(false);

    expect(odd.gatt.connect).toHaveBeenCalledTimes(1);
    expect(odd.gatt.disconnect).toHaveBeenCalledTimes(1);
    expect(isPrinterConnected("MAIN")).toBe(false);
  });
});

describe("two roles on one physical printer", () => {
  async function pairBoth() {
    const shared = fakePrinter("dev-shared", "XP-58");
    requestDevice.mockResolvedValue(shared.device);
    await connectPrinter("MAIN");
    await connectPrinter("KITCHEN");
    return shared;
  }

  it("opens ONE gatt connection for the two roles", async () => {
    const shared = await pairBoth();
    expect(shared.gatt.connect).toHaveBeenCalledTimes(1);
    expect(isPrinterConnected("MAIN")).toBe(true);
    expect(isPrinterConnected("KITCHEN")).toBe(true);
  });

  it("does not tear the link down when only one role lets go", async () => {
    const shared = await pairBoth();

    disconnectPrinter("KITCHEN");
    expect(isPrinterConnected("KITCHEN")).toBe(false);
    expect(isPrinterConnected("MAIN")).toBe(true);
    expect(shared.gatt.disconnect).not.toHaveBeenCalled();

    disconnectPrinter("MAIN");
    expect(shared.gatt.disconnect).toHaveBeenCalledTimes(1);
  });

  it("takes both roles down when the printer goes out of range", async () => {
    const shared = await pairBoth();
    shared.dropOutOfRange();
    expect(isPrinterConnected("MAIN")).toBe(false);
    expect(isPrinterConnected("KITCHEN")).toBe(false);
  });
});

describe("a printer dropping out of range", () => {
  it("takes down only the roles riding that device", async () => {
    const main = fakePrinter("dev-main", "MAIN-PRINTER");
    const bar = fakePrinter("dev-bar", "BAR-PRINTER");
    requestDevice.mockResolvedValueOnce(main.device).mockResolvedValueOnce(bar.device);
    await connectPrinter("MAIN");
    await connectPrinter("BAR");

    bar.dropOutOfRange();

    expect(isPrinterConnected("BAR")).toBe(false);
    expect(isPrinterConnected("MAIN")).toBe(true);
  });
});

describe("printBytes", () => {
  it("writes to the printer bound to the role, and to no other", async () => {
    const main = fakePrinter("dev-main", "MAIN");
    const kitchen = fakePrinter("dev-kitchen", "KITCHEN");
    requestDevice.mockResolvedValueOnce(main.device).mockResolvedValueOnce(kitchen.device);
    await connectPrinter("MAIN");
    await connectPrinter("KITCHEN");

    await settle(printBytes("KITCHEN", new Uint8Array([1, 2, 3])));

    expect(kitchen.written.flat()).toContain(1);
    expect(main.written).toHaveLength(0);
  });

  it("sends the bytes in small chunks, then the cut command on its own", async () => {
    const printer = fakePrinter("dev", "P");
    requestDevice.mockResolvedValueOnce(printer.device);
    await connectPrinter("MAIN");

    await settle(printBytes("MAIN", new Uint8Array(130).fill(7)));

    const chunks = printer.written;
    // 130 bytes at 64 per write: 64 + 64 + 2, then GS V A 3.
    expect(chunks.map((c) => c.length)).toEqual([64, 64, 2, 4]);
    expect(chunks[3]).toEqual([0x1d, 0x56, 0x41, 0x03]);
  });

  it("sends no cut when told not to (a sticker roll)", async () => {
    const printer = fakePrinter("dev", "P");
    requestDevice.mockResolvedValueOnce(printer.device);
    await connectPrinter("LABEL");

    await settle(printBytes("LABEL", new Uint8Array([9, 9]), { cut: false }));

    expect(printer.written).toEqual([[9, 9]]);
  });

  it("rejects with the missing role when its printer isn't connected", async () => {
    const result = printBytes("BAR", new Uint8Array([1]));
    await vi.runAllTimersAsync();
    await expect(result).rejects.toBeInstanceOf(PrinterNotConnectedError);
    await expect(result).rejects.toMatchObject({ role: "BAR" });
  });

  it("does not let one failed print poison the ones after it", async () => {
    const printer = fakePrinter("dev", "P");
    requestDevice.mockResolvedValueOnce(printer.device);
    await connectPrinter("MAIN");

    const failing = printBytes("BAR", new Uint8Array([1]));
    const fine = printBytes("MAIN", new Uint8Array([2]), { cut: false });
    await vi.runAllTimersAsync();

    await expect(failing).rejects.toBeInstanceOf(PrinterNotConnectedError);
    await expect(fine).resolves.toBeUndefined();
    expect(printer.written).toEqual([[2]]);
  });

  it("gives up on a write that never settles, drops that printer, and frees the queue", async () => {
    const stuck = fakePrinter("dev-stuck", "STUCK");
    stuck.characteristic.writeValueWithoutResponse.mockImplementationOnce(
      () => new Promise<void>(() => {})
    );
    requestDevice.mockResolvedValueOnce(stuck.device);
    await connectPrinter("MAIN");

    const first = printBytes("MAIN", new Uint8Array([1, 2, 3]), { cut: false });
    const outcome = expect(first).rejects.toBeInstanceOf(PrinterTimeoutError);
    await vi.advanceTimersByTimeAsync(10_000);
    await outcome;
    await expect(first).rejects.toMatchObject({ role: "MAIN" });

    // Dropped, so a write still pending in the OS can't splice into the next job,
    // and the UI is told it is down.
    expect(stuck.gatt.disconnect).toHaveBeenCalled();
    expect(isPrinterConnected("MAIN")).toBe(false);

    // The chain is free again: a healthy printer prints straight away.
    const fine = fakePrinter("dev-fine", "FINE");
    requestDevice.mockResolvedValueOnce(fine.device);
    await connectPrinter("MAIN");
    await settle(printBytes("MAIN", new Uint8Array([9]), { cut: false }));
    expect(fine.written).toEqual([[9]]);
  });

  it("bounds one stuck write, never a whole healthy job — a long print outlives the 10 s timeout", async () => {
    const printer = fakePrinter("dev", "P");
    requestDevice.mockResolvedValueOnce(printer.device);
    await connectPrinter("MAIN");

    // 30 KB is ~470 chunks at 30 ms each: about 14 s of pure chunk delay, longer than
    // the write timeout. Each write arms and clears its own timer, so it still completes.
    await settle(printBytes("MAIN", new Uint8Array(30_000).fill(1), { cut: false }));

    expect(isPrinterConnected("MAIN")).toBe(true);
    expect(printer.written.flat()).toHaveLength(30_000);
  });

  it("runs two prints strictly one after the other, never interleaved", async () => {
    const printer = fakePrinter("dev", "P");
    requestDevice.mockResolvedValue(printer.device);
    await connectPrinter("MAIN");
    await connectPrinter("KITCHEN");

    // Two jobs on the SAME physical printer, both longer than one chunk.
    const first = printBytes("MAIN", new Uint8Array(100).fill(1), { cut: false });
    const second = printBytes("KITCHEN", new Uint8Array(100).fill(2), { cut: false });
    await vi.runAllTimersAsync();
    await Promise.all([first, second]);

    const stream = printer.written.flat();
    expect(stream).toHaveLength(200);
    // All of job 1's bytes, then all of job 2's — never a splice.
    expect(stream.slice(0, 100).every((b) => b === 1)).toBe(true);
    expect(stream.slice(100).every((b) => b === 2)).toBe(true);
  });
});
