/**
 * The per-role printer settings store.
 *
 * The part that can hurt a live shop is migration: a till that already has its
 * receipt printer set up must come out of the upgrade with the SAME auto-print
 * and paper width, not silently reset — and a stored blob from before a role
 * existed must not leave that role undefined.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const connection = vi.hoisted(() => ({
  connectPrinter: vi.fn(),
  disconnectPrinter: vi.fn(),
  getPrinterDeviceName: vi.fn(),
}));
vi.mock("@/lib/pwa/printer-connection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pwa/printer-connection")>()),
  ...connection,
}));

import {
  DEFAULT_LABEL,
  DEFAULT_PRINTERS,
  migratePrinterSettings,
  usePrinterSettings,
} from "../use-printer-settings";

const KEY = "epidom-pos-printer-settings";
const state = () => usePrinterSettings.getState();

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  usePrinterSettings.setState({
    printers: DEFAULT_PRINTERS,
    label: DEFAULT_LABEL,
    connecting: null,
  });
});

describe("migratePrinterSettings", () => {
  it("turns the old single printer into MAIN, keeping its auto-print and paper width", () => {
    const migrated = migratePrinterSettings({ autoPrint: true, paperWidth: 48 }, 0);
    expect(migrated.printers?.MAIN).toMatchObject({
      enabled: true,
      autoPrint: true,
      paperWidth: 48,
    });
  });

  it("leaves every other role at its default — off", () => {
    const migrated = migratePrinterSettings({ autoPrint: true, paperWidth: 48 }, 0);
    for (const role of ["KITCHEN", "BAR", "LABEL"] as const) {
      expect(migrated.printers?.[role]).toEqual(DEFAULT_PRINTERS[role]);
      expect(migrated.printers?.[role].enabled).toBe(false);
    }
  });

  it("does not trust garbage in the old blob", () => {
    const migrated = migratePrinterSettings({ autoPrint: "yes", paperWidth: 58 }, 0);
    expect(migrated.printers?.MAIN).toMatchObject({ autoPrint: false, paperWidth: 32 });
  });

  it("passes a current-version blob straight through", () => {
    const blob = { printers: DEFAULT_PRINTERS, label: DEFAULT_LABEL };
    expect(migratePrinterSettings(blob, 1)).toBe(blob);
  });
});

describe("rehydrating from storage", () => {
  it("upgrades a real v0 blob in place", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ state: { autoPrint: true, paperWidth: 48 }, version: 0 })
    );
    await usePrinterSettings.persist.rehydrate();
    expect(state().printers.MAIN).toMatchObject({ autoPrint: true, paperWidth: 48, enabled: true });
    expect(state().printers.KITCHEN).toEqual(DEFAULT_PRINTERS.KITCHEN);
  });

  it("fills in a role the stored blob predates instead of leaving it undefined", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        state: { printers: { MAIN: { ...DEFAULT_PRINTERS.MAIN, paperWidth: 48 } } },
        version: 1,
      })
    );
    await usePrinterSettings.persist.rehydrate();
    expect(state().printers.MAIN.paperWidth).toBe(48);
    for (const role of ["KITCHEN", "BAR", "LABEL"] as const) {
      expect(state().printers[role]).toEqual(DEFAULT_PRINTERS[role]);
    }
    expect(state().label).toEqual(DEFAULT_LABEL);
  });

  it("keeps the receipt printer on even if a stored blob says otherwise", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        state: { printers: { MAIN: { ...DEFAULT_PRINTERS.MAIN, enabled: false } } },
        version: 1,
      })
    );
    await usePrinterSettings.persist.rehydrate();
    expect(state().printers.MAIN.enabled).toBe(true);
  });

  it("persists the settings but never the live link state", () => {
    state().setEnabled("KITCHEN", true);
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}").state;
    expect(Object.keys(stored).sort()).toEqual(["label", "printers"]);
    expect(stored.printers.KITCHEN.enabled).toBe(true);
  });
});

describe("per-role settings", () => {
  it("keeps each role's auto-print and paper width independent", () => {
    state().setPaperWidth("KITCHEN", 48);
    state().setAutoPrint("MAIN", true);
    state().setAutoPrint("BAR", false);

    expect(state().printers.KITCHEN.paperWidth).toBe(48);
    expect(state().printers.MAIN.paperWidth).toBe(32);
    expect(state().printers.MAIN.autoPrint).toBe(true);
    expect(state().printers.BAR.autoPrint).toBe(false);
    expect(state().printers.KITCHEN.autoPrint).toBe(true);
  });

  it("can switch a role on, but never the receipt printer off", () => {
    state().setEnabled("BAR", true);
    expect(state().printers.BAR.enabled).toBe(true);

    state().setEnabled("MAIN", false);
    expect(state().printers.MAIN.enabled).toBe(true);
  });

  it("lets go of a printer's Bluetooth link when its role is switched off", () => {
    state().setEnabled("BAR", true);
    connection.disconnectPrinter.mockClear();

    state().setEnabled("BAR", false);
    expect(connection.disconnectPrinter).toHaveBeenCalledWith("BAR");

    // Switching one ON must not touch a link.
    connection.disconnectPrinter.mockClear();
    state().setEnabled("BAR", true);
    expect(connection.disconnectPrinter).not.toHaveBeenCalled();
  });

  it("merges a label patch instead of replacing the label settings", () => {
    state().setLabel({ language: "TSPL", widthMm: 50 });
    expect(state().label).toEqual({ ...DEFAULT_LABEL, language: "TSPL", widthMm: 50 });
  });
});

describe("connect / disconnect", () => {
  it("pairs the role it was asked for and remembers the device's name as a hint", async () => {
    connection.connectPrinter.mockResolvedValue(true);
    connection.getPrinterDeviceName.mockReturnValue("XP-BAR");

    const ok = await state().connect("BAR");

    expect(ok).toBe(true);
    expect(connection.connectPrinter).toHaveBeenCalledWith("BAR");
    expect(state().printers.BAR.deviceName).toBe("XP-BAR");
    expect(state().connecting).toBeNull();
  });

  it("defaults to the receipt printer, as every pre-multi-printer caller expects", async () => {
    connection.connectPrinter.mockResolvedValue(true);
    connection.getPrinterDeviceName.mockReturnValue(null);
    await state().connect();
    expect(connection.connectPrinter).toHaveBeenCalledWith("MAIN");
  });

  it("keeps the last-known name and reports failure when the picker is cancelled", async () => {
    usePrinterSettings.setState({
      printers: { ...DEFAULT_PRINTERS, BAR: { ...DEFAULT_PRINTERS.BAR, deviceName: "XP-OLD" } },
    });
    connection.connectPrinter.mockResolvedValue(false);

    expect(await state().connect("BAR")).toBe(false);
    expect(state().printers.BAR.deviceName).toBe("XP-OLD");
    expect(state().connecting).toBeNull();
  });

  it("marks which role's picker is open while it is", async () => {
    let finish!: (ok: boolean) => void;
    connection.connectPrinter.mockReturnValue(new Promise<boolean>((r) => (finish = r)));

    const pending = state().connect("KITCHEN");
    expect(state().connecting).toBe("KITCHEN");
    finish(false);
    await pending;
    expect(state().connecting).toBeNull();
  });

  it("disconnects the role it was asked for", () => {
    state().disconnect("KITCHEN");
    expect(connection.disconnectPrinter).toHaveBeenCalledWith("KITCHEN");
  });
});
