import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: "en" }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({ currency: "EUR" }),
}));
const { toast } = vi.hoisted(() => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("sonner", () => ({ toast }));

const link = vi.hoisted(() => ({
  isBluetoothSupported: vi.fn(),
  isPrinterConnected: vi.fn(),
}));
vi.mock("@/lib/pwa/printer-connection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pwa/printer-connection")>()),
  ...link,
}));
const test = vi.hoisted(() => ({ printTestPage: vi.fn() }));
vi.mock("@/lib/pwa/printer-test", () => test);

import type { PrinterRole } from "@/lib/pwa/printer-connection";
import { PrinterSettingsDialog } from "../printer-settings-dialog";
import {
  DEFAULT_LABEL,
  DEFAULT_PRINTERS,
  usePrinterSettings,
} from "../../hooks/use-printer-settings";

const state = () => usePrinterSettings.getState();

/** The card (<section>) for one printer, found by its title. */
const card = (role: "MAIN" | "KITCHEN" | "BAR" | "LABEL") =>
  screen.getByText(`pos.printers.roles.${role}.name`).closest("section") as HTMLElement;

const TEST = { name: "pos.printers.test" };
const CONNECT = { name: "pos.printers.connect" };

let connect: Mock<(role?: PrinterRole) => Promise<boolean>>;

beforeEach(() => {
  vi.clearAllMocks();
  link.isBluetoothSupported.mockReturnValue(true);
  link.isPrinterConnected.mockReturnValue(true);
  test.printTestPage.mockResolvedValue(undefined);
  connect = vi.fn<(role?: PrinterRole) => Promise<boolean>>().mockResolvedValue(true);
  usePrinterSettings.setState({
    printers: DEFAULT_PRINTERS,
    label: DEFAULT_LABEL,
    connected: { MAIN: false, KITCHEN: false, BAR: false, LABEL: false },
    connecting: null,
    connect,
  });
});

const open = () => render(<PrinterSettingsDialog open onOpenChange={() => {}} />);

describe("PrinterSettingsDialog — one card per printer", () => {
  it("lists the receipt, kitchen, bar and label printers, each described", () => {
    open();
    for (const role of ["MAIN", "KITCHEN", "BAR", "LABEL"]) {
      expect(screen.getByText(`pos.printers.roles.${role}.name`)).toBeInTheDocument();
      expect(screen.getByText(`pos.printers.roles.${role}.desc`)).toBeInTheDocument();
    }
  });

  it("opens only the receipt printer's controls until the others are switched on", () => {
    open();
    expect(within(card("MAIN")).getByRole("button", TEST)).toBeInTheDocument();
    for (const role of ["KITCHEN", "BAR", "LABEL"] as const) {
      expect(within(card(role)).queryByRole("button", TEST)).toBeNull();
    }
  });

  it("gives the receipt printer no off switch — it is the till's own", () => {
    open();
    expect(within(card("MAIN")).queryByRole("switch", { name: "pos.printers.enable" })).toBeNull();
    for (const role of ["KITCHEN", "BAR", "LABEL"] as const) {
      expect(
        within(card(role)).getByRole("switch", { name: "pos.printers.enable" })
      ).toBeInTheDocument();
    }
  });

  it("switching a printer on reveals its controls, and off hides them again", () => {
    open();
    const toggle = within(card("KITCHEN")).getByRole("switch", { name: "pos.printers.enable" });

    fireEvent.click(toggle);
    expect(state().printers.KITCHEN.enabled).toBe(true);
    expect(within(card("KITCHEN")).getByRole("button", TEST)).toBeInTheDocument();
    // The others stay closed.
    expect(within(card("BAR")).queryByRole("button", TEST)).toBeNull();

    fireEvent.click(toggle);
    expect(state().printers.KITCHEN.enabled).toBe(false);
    expect(within(card("KITCHEN")).queryByRole("button", TEST)).toBeNull();
  });
});

describe("PrinterSettingsDialog — pairing and paper", () => {
  it("pairs the printer whose Connect was tapped, and no other", () => {
    usePrinterSettings.setState({
      printers: { ...DEFAULT_PRINTERS, BAR: { ...DEFAULT_PRINTERS.BAR, enabled: true } },
    });
    open();
    fireEvent.click(within(card("BAR")).getByRole("button", CONNECT));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith("BAR");
  });

  it("shows the connected device's name, or the last one used while it is down", () => {
    usePrinterSettings.setState({
      printers: {
        ...DEFAULT_PRINTERS,
        MAIN: { ...DEFAULT_PRINTERS.MAIN, deviceName: "XP-58" },
      },
    });
    const { rerender } = open();
    expect(
      within(card("MAIN")).getByText(/pos.print.notConnected · pos.printers.lastUsed/)
    ).toBeTruthy();

    usePrinterSettings.setState({
      connected: { MAIN: true, KITCHEN: false, BAR: false, LABEL: false },
    });
    rerender(<PrinterSettingsDialog open onOpenChange={() => {}} />);
    expect(within(card("MAIN")).getByText("pos.printers.connectedAs")).toBeInTheDocument();
  });

  it("sets each printer's paper width on its own", () => {
    usePrinterSettings.setState({
      printers: { ...DEFAULT_PRINTERS, KITCHEN: { ...DEFAULT_PRINTERS.KITCHEN, enabled: true } },
    });
    open();
    fireEvent.click(
      within(card("KITCHEN")).getByRole("button", { name: "pos.print.paperWidth80" })
    );
    expect(state().printers.KITCHEN.paperWidth).toBe(48);
    expect(state().printers.MAIN.paperWidth).toBe(32);
  });

  it("keeps auto-print per printer, worded for what that printer prints", () => {
    usePrinterSettings.setState({
      printers: { ...DEFAULT_PRINTERS, KITCHEN: { ...DEFAULT_PRINTERS.KITCHEN, enabled: true } },
    });
    open();
    expect(within(card("MAIN")).getByText("pos.print.autoPrint")).toBeInTheDocument();
    expect(within(card("KITCHEN")).getByText("pos.printers.autoPrintTicket")).toBeInTheDocument();

    fireEvent.click(within(card("KITCHEN")).getAllByRole("switch").at(-1)!);
    expect(state().printers.KITCHEN.autoPrint).toBe(false);
    expect(state().printers.MAIN.autoPrint).toBe(false); // untouched default
  });
});

describe("PrinterSettingsDialog — test print", () => {
  it("prints the role's own layout at THAT printer's paper width", async () => {
    usePrinterSettings.setState({
      printers: {
        ...DEFAULT_PRINTERS,
        KITCHEN: { ...DEFAULT_PRINTERS.KITCHEN, enabled: true, paperWidth: 48 },
      },
    });
    open();
    fireEvent.click(within(card("KITCHEN")).getByRole("button", TEST));

    await waitFor(() => expect(test.printTestPage).toHaveBeenCalledTimes(1));
    expect(test.printTestPage).toHaveBeenCalledWith(
      "KITCHEN",
      expect.objectContaining({ width: 48, locale: "en", currency: "EUR" })
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("pos.printers.testDone"));
  });

  it("pairs first if the printer is down, and does not print if pairing fails", async () => {
    link.isPrinterConnected.mockReturnValue(false);
    connect.mockResolvedValue(false);
    open();
    fireEvent.click(within(card("MAIN")).getByRole("button", TEST));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(connect).toHaveBeenCalledWith("MAIN");
    expect(test.printTestPage).not.toHaveBeenCalled();
  });

  it("surfaces the printer's own error", async () => {
    test.printTestPage.mockRejectedValue(new Error("Paper out"));
    open();
    fireEvent.click(within(card("MAIN")).getByRole("button", TEST));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Paper out"));
  });
});

describe("PrinterSettingsDialog — the label printer", () => {
  const enableLabel = () =>
    usePrinterSettings.setState({
      printers: { ...DEFAULT_PRINTERS, LABEL: { ...DEFAULT_PRINTERS.LABEL, enabled: true } },
    });
  const WIDTH = /pos\.printers\.label\.width/;

  it("offers ESC/POS and TSPL, defaulting to ESC/POS with no sticker-size fields", () => {
    enableLabel();
    open();
    expect(within(card("LABEL")).getByRole("button", { name: "ESC/POS" })).toBeInTheDocument();
    expect(within(card("LABEL")).getByRole("button", { name: "TSPL" })).toBeInTheDocument();
    expect(within(card("LABEL")).queryByLabelText(WIDTH)).toBeNull();
  });

  it("TSPL asks for the sticker size in mm instead of a paper width", () => {
    enableLabel();
    open();
    const paper = { name: "pos.print.paperWidth58" };
    expect(within(card("LABEL")).getByRole("button", paper)).toBeInTheDocument();

    fireEvent.click(within(card("LABEL")).getByRole("button", { name: "TSPL" }));

    expect(state().label.language).toBe("TSPL");
    expect(within(card("LABEL")).getByLabelText(WIDTH)).toHaveValue(40);
    expect(within(card("LABEL")).getByLabelText(/pos\.printers\.label\.height/)).toHaveValue(30);
    expect(within(card("LABEL")).getByLabelText(/pos\.printers\.label\.gap/)).toHaveValue(2);
    expect(within(card("LABEL")).queryByRole("button", paper)).toBeNull();
  });

  it("commits a CLAMPED size on blur, not on every keystroke", () => {
    enableLabel();
    usePrinterSettings.setState({ label: { ...DEFAULT_LABEL, language: "TSPL" } });
    open();
    const width = within(card("LABEL")).getByLabelText(WIDTH);

    // Typing "999" must not be squashed digit by digit, nor saved half-typed.
    fireEvent.change(width, { target: { value: "999" } });
    expect(width).toHaveValue(999);
    expect(state().label.widthMm).toBe(40);

    fireEvent.blur(width);
    expect(state().label.widthMm).toBe(110);
    expect(width).toHaveValue(110);
  });

  it("commits on Enter too, and falls to the minimum for an empty field", () => {
    enableLabel();
    usePrinterSettings.setState({ label: { ...DEFAULT_LABEL, language: "TSPL" } });
    open();
    const height = within(card("LABEL")).getByLabelText(/pos\.printers\.label\.height/);

    fireEvent.change(height, { target: { value: "" } });
    fireEvent.keyDown(height, { key: "Enter" });
    expect(state().label.heightMm).toBe(15);
  });

  it("chooses which lines get a sticker", () => {
    enableLabel();
    open();
    fireEvent.click(
      within(card("LABEL")).getByRole("button", { name: "pos.printers.label.scopeBar" })
    );
    expect(state().label.scope).toBe("BAR");
  });

  it("is upfront that label printing isn't verified on every model", () => {
    enableLabel();
    open();
    expect(within(card("LABEL")).getByText("pos.printers.label.untested")).toBeInTheDocument();
  });
});

describe("PrinterSettingsDialog — a browser without Bluetooth", () => {
  it("says so, and offers neither Connect nor Test print", () => {
    link.isBluetoothSupported.mockReturnValue(false);
    open();
    expect(screen.getByText("pos.print.bluetoothUnsupported")).toBeInTheDocument();
    expect(screen.queryByRole("button", CONNECT)).toBeNull();
    expect(within(card("MAIN")).getByRole("button", TEST)).toBeDisabled();
  });
});
