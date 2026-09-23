import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LabelLanguage } from "@/lib/pwa/item-label";
import {
  PRINTER_ROLES,
  connectPrinter,
  disconnectPrinter,
  getPrinterDeviceName,
  isBluetoothSupported,
  isPrinterConnected,
  subscribePrinterConnections,
  type PrinterRole,
} from "@/lib/pwa/printer-connection";
import type { LabelScope } from "../lib/print-plan";

// 32 cols = 58mm, 48 cols = 80mm — matches ReceiptData["width"] in
// thermal-printer.ts.
export type PaperWidth = 32 | 48;

/**
 * One printer's settings, keyed by what it is FOR (see PrinterRole). All of it
 * is per-device/till, not store-wide: which physical printers are paired to THIS
 * tablet is a fact about the tablet, and a Bluetooth pairing never leaves it.
 */
export interface PrinterRoleSettings {
  /** MAIN is always on; Kitchen / Bar / Label are opt-in. */
  enabled: boolean;
  /** Print this role's document by itself when an order is placed. */
  autoPrint: boolean;
  paperWidth: PaperWidth;
  /** Advertised name of the last device paired to this role — only a hint for
   * the picker after a reload, since the pairing itself never survives one. */
  deviceName: string | null;
}

export interface LabelSettings {
  language: LabelLanguage;
  /** TSPL only: physical sticker size and gap, in mm. */
  widthMm: number;
  heightMm: number;
  gapMm: number;
  /** Which lines get a sticker. */
  scope: LabelScope;
}

export const DEFAULT_PRINTERS: Record<PrinterRole, PrinterRoleSettings> = {
  // Receipt auto-print has always defaulted to off (not every customer wants one).
  MAIN: { enabled: true, autoPrint: false, paperWidth: 32, deviceName: null },
  // The others are opt-in via `enabled`, so once someone has set one up, printing
  // automatically is the whole point — a kitchen ticket you have to remember to
  // ask for is not a kitchen ticket.
  KITCHEN: { enabled: false, autoPrint: true, paperWidth: 32, deviceName: null },
  BAR: { enabled: false, autoPrint: true, paperWidth: 32, deviceName: null },
  LABEL: { enabled: false, autoPrint: true, paperWidth: 32, deviceName: null },
};

export const DEFAULT_LABEL: LabelSettings = {
  language: "ESCPOS",
  widthMm: 40,
  heightMm: 30,
  gapMm: 2,
  scope: "ALL",
};

interface PersistedPrinterSettings {
  printers: Record<PrinterRole, PrinterRoleSettings>;
  label: LabelSettings;
}

interface PrinterSettingsState extends PersistedPrinterSettings {
  /** Live link state, mirrored from the connection registry — never persisted. */
  connected: Record<PrinterRole, boolean>;
  /** The role whose device picker is currently open, if any. */
  connecting: PrinterRole | null;
  setEnabled: (role: PrinterRole, value: boolean) => void;
  setAutoPrint: (role: PrinterRole, value: boolean) => void;
  setPaperWidth: (role: PrinterRole, value: PaperWidth) => void;
  setLabel: (patch: Partial<LabelSettings>) => void;
  connect: (role?: PrinterRole) => Promise<boolean>;
  disconnect: (role?: PrinterRole) => void;
}

// Not persisted (see partialize below) — a Bluetooth pairing never survives a
// reload, so a stale "connected: true" would just misrepresent the hardware.
const readConnected = (): Record<PrinterRole, boolean> => {
  const supported = isBluetoothSupported();
  return Object.fromEntries(
    PRINTER_ROLES.map((role) => [role, supported && isPrinterConnected(role)])
  ) as Record<PrinterRole, boolean>;
};

/**
 * Persist v0 stored ONE printer: `{ autoPrint, paperWidth }`. That printer is
 * the till's receipt printer, so it becomes MAIN — an existing device keeps its
 * auto-print and paper-width choice instead of silently resetting to defaults.
 */
export function migratePrinterSettings(
  persisted: unknown,
  version: number
): Partial<PersistedPrinterSettings> {
  if (version < 1 && persisted && typeof persisted === "object") {
    const old = persisted as { autoPrint?: unknown; paperWidth?: unknown };
    return {
      printers: {
        ...DEFAULT_PRINTERS,
        MAIN: {
          ...DEFAULT_PRINTERS.MAIN,
          autoPrint: old.autoPrint === true,
          paperWidth: old.paperWidth === 48 ? 48 : 32,
        },
      },
    };
  }
  return (persisted ?? {}) as Partial<PersistedPrinterSettings>;
}

export const usePrinterSettings = create<PrinterSettingsState>()(
  persist(
    (set) => {
      const patchRole = (role: PrinterRole, patch: Partial<PrinterRoleSettings>) =>
        set((state) => ({
          printers: { ...state.printers, [role]: { ...state.printers[role], ...patch } },
        }));

      return {
        printers: DEFAULT_PRINTERS,
        label: DEFAULT_LABEL,
        connected: readConnected(),
        connecting: null,

        setEnabled: (role, value) => {
          // The till's receipt printer can't be switched off, only left unpaired.
          if (role === "MAIN") return;
          // Turning a printer off also lets go of its Bluetooth link.
          if (!value) disconnectPrinter(role);
          patchRole(role, { enabled: value });
        },
        setAutoPrint: (role, value) => patchRole(role, { autoPrint: value }),
        setPaperWidth: (role, value) => patchRole(role, { paperWidth: value }),
        setLabel: (patch) => set((state) => ({ label: { ...state.label, ...patch } })),

        connect: async (role = "MAIN") => {
          set({ connecting: role });
          try {
            const ok = await connectPrinter(role);
            if (ok) {
              const name = getPrinterDeviceName(role);
              if (name) patchRole(role, { deviceName: name });
            }
            set({ connected: readConnected() });
            return ok;
          } finally {
            set({ connecting: null });
          }
        },

        disconnect: (role = "MAIN") => {
          disconnectPrinter(role);
          set({ connected: readConnected() });
        },
      };
    },
    {
      name: "epidom-pos-printer-settings",
      version: 1,
      migrate: (persisted, version) =>
        migratePrinterSettings(persisted, version) as unknown as PrinterSettingsState,
      // Per-role merge, not the default shallow one: a stored `printers` object
      // that predates a role would otherwise REPLACE the defaults and leave that
      // role undefined.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<PersistedPrinterSettings>;
        const printers = Object.fromEntries(
          PRINTER_ROLES.map((role) => [
            role,
            { ...current.printers[role], ...stored.printers?.[role] },
          ])
        ) as Record<PrinterRole, PrinterRoleSettings>;
        printers.MAIN = { ...printers.MAIN, enabled: true };
        return { ...current, printers, label: { ...current.label, ...stored.label } };
      },
      partialize: (state) => ({ printers: state.printers, label: state.label }),
    }
  )
);

// A printer can drop with no click at all (out of range, powered off), and two
// roles can ride one device — so the flags follow the registry, not the buttons.
subscribePrinterConnections(() => usePrinterSettings.setState({ connected: readConnected() }));
