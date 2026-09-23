/**
 * Printing an order's kitchen / bar tickets and labels.
 *
 * The behaviour that matters operationally: a ticket that should have printed
 * but couldn't must NEVER be silent — the kitchen not hearing about an order is
 * the failure mode — while a ticket that did print asks for no applause.
 */
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() })
);
vi.mock("sonner", () => ({ toast }));
// Returns the key, except for the four strings that carry a {placeholder} —
// those get a real template so an assertion can see WHICH printer was named.
const TEMPLATES: Record<string, string> = {
  "pos.printers.notPrinted": "notPrinted {printers}",
  "pos.printers.notConnected": "notConnected {printer}",
  "pos.printers.connectFailed": "connectFailed {printer}",
  "pos.printers.sent": "sent {printers}",
  "pos.printers.notResponding": "notResponding {printer}",
};
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => TEMPLATES[key] ?? key }),
}));

const link = vi.hoisted(() => ({
  isBluetoothSupported: vi.fn(),
  isPrinterConnected: vi.fn(),
}));
vi.mock("@/lib/pwa/printer-connection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pwa/printer-connection")>()),
  ...link,
}));
const ticket = vi.hoisted(() => ({ printOrderTicket: vi.fn() }));
vi.mock("@/lib/pwa/order-ticket", () => ticket);
const labels = vi.hoisted(() => ({ printItemLabels: vi.fn() }));
vi.mock("@/lib/pwa/item-label", () => labels);

import { PrinterNotConnectedError, PrinterTimeoutError } from "@/lib/pwa/printer-connection";
import { DEFAULT_LABEL, DEFAULT_PRINTERS, usePrinterSettings } from "../use-printer-settings";
import { usePrintOrder, type OrderPrintInput } from "../use-print-order";

const STORE = "store-1";

const INPUT: OrderPrintInput = {
  context: { locale: "en", orderNumber: "POS-1", queueNumber: 7, orderType: "DINE_IN" },
  items: [
    {
      id: "l1",
      menuItemId: "m-bread",
      name: "Salt Bread",
      unitPrice: 1,
      quantity: 2,
      modifiers: [],
      lineTotal: 2,
    },
    {
      id: "l2",
      menuItemId: "m-latte",
      name: "Iced Latte",
      unitPrice: 1,
      quantity: 1,
      modifiers: [],
      lineTotal: 1,
    },
  ],
};

function wrapper() {
  const client = new QueryClient();
  client.setQueryData(["pos", "menu", STORE], {
    categories: [
      {
        items: [
          { id: "m-bread", department: "KITCHEN" },
          { id: "m-latte", department: "BAR" },
        ],
      },
    ],
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

/** Which printers are set up on this "till". */
function setUp(roles: Partial<Record<"KITCHEN" | "BAR" | "LABEL", boolean>>) {
  const connect = vi.fn().mockResolvedValue(true);
  usePrinterSettings.setState({
    printers: {
      ...DEFAULT_PRINTERS,
      KITCHEN: { ...DEFAULT_PRINTERS.KITCHEN, enabled: !!roles.KITCHEN },
      BAR: { ...DEFAULT_PRINTERS.BAR, enabled: !!roles.BAR },
      LABEL: { ...DEFAULT_PRINTERS.LABEL, enabled: !!roles.LABEL },
    },
    label: DEFAULT_LABEL,
    connect,
  });
  return connect;
}

const render = () => renderHook(() => usePrintOrder(STORE), { wrapper: wrapper() });

beforeEach(() => {
  vi.clearAllMocks();
  link.isBluetoothSupported.mockReturnValue(true);
  link.isPrinterConnected.mockReturnValue(true);
  ticket.printOrderTicket.mockResolvedValue(undefined);
  labels.printItemLabels.mockResolvedValue(undefined);
});

describe("when an order is placed (not interactive)", () => {
  it("prints on a connected kitchen printer and makes no noise about it", async () => {
    setUp({ KITCHEN: true });
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: false }));

    expect(ticket.printOrderTicket).toHaveBeenCalledTimes(1);
    expect(ticket.printOrderTicket.mock.calls[0][0]).toBe("KITCHEN");
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("routes each line by the cached POS menu: bread to the kitchen, latte to the bar", async () => {
    setUp({ KITCHEN: true, BAR: true });
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: false }));

    const byRole = Object.fromEntries(
      ticket.printOrderTicket.mock.calls.map(([role, t]) => [
        role,
        t.sections.flatMap((s: any) => s.items.map((i: any) => i.name)),
      ])
    );
    expect(byRole).toEqual({ KITCHEN: ["Salt Bread"], BAR: ["Iced Latte"] });
  });

  it("does NOT stay silent when a printer that should print isn't connected", async () => {
    setUp({ KITCHEN: true });
    link.isPrinterConnected.mockReturnValue(false);
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: false }));

    expect(ticket.printOrderTicket).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning.mock.calls[0][0]).toContain("notPrinted");
    expect(toast.warning.mock.calls[0][1].action.label).toBe("pos.printers.connectAndPrint");
  });

  it("never opens a device picker on its own", async () => {
    const connect = setUp({ KITCHEN: true });
    link.isPrinterConnected.mockReturnValue(false);
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: false }));
    expect(connect).not.toHaveBeenCalled();
  });

  it("finishes the job from the warning's 'Connect & print' tap, which may open the picker", async () => {
    const connect = setUp({ KITCHEN: true });
    link.isPrinterConnected.mockReturnValue(false);
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: false }));

    const { action } = toast.warning.mock.calls[0][1];
    await act(async () => {
      action.onClick();
    });

    expect(connect).toHaveBeenCalledWith("KITCHEN");
    expect(ticket.printOrderTicket).toHaveBeenCalledTimes(1);
  });

  it("skips a role that is set up but set NOT to print by itself", async () => {
    setUp({ KITCHEN: true });
    usePrinterSettings.setState({
      printers: {
        ...usePrinterSettings.getState().printers,
        KITCHEN: { ...usePrinterSettings.getState().printers.KITCHEN, autoPrint: false },
      },
    });
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: false }));

    expect(ticket.printOrderTicket).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("does nothing, and says nothing, for a shop with no kitchen, bar or label printer", async () => {
    setUp({});
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: false }));

    expect(ticket.printOrderTicket).not.toHaveBeenCalled();
    expect(labels.printItemLabels).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("stays quiet on a browser without Bluetooth", async () => {
    setUp({ KITCHEN: true });
    link.isBluetoothSupported.mockReturnValue(false);
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: false }));
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });
});

describe("when a cashier taps Print (interactive)", () => {
  it("pairs the printer first if it is down, prints, and confirms", async () => {
    const connect = setUp({ KITCHEN: true });
    link.isPrinterConnected.mockReturnValue(false);
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: true }));

    expect(connect).toHaveBeenCalledWith("KITCHEN");
    expect(ticket.printOrderTicket).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success.mock.calls[0][0]).toContain("sent");
  });

  it("pairs only ONE printer per tap — a picker consumes the tap — and reports the other", async () => {
    const connect = setUp({ KITCHEN: true, BAR: true });
    link.isPrinterConnected.mockReturnValue(false);
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: true }));

    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith("KITCHEN");
    expect(ticket.printOrderTicket).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning.mock.calls[0][0]).toContain("pos.printers.roles.BAR.name");
  });

  it("prints a role even when it is set not to print by itself", async () => {
    setUp({ KITCHEN: true });
    usePrinterSettings.setState({
      printers: {
        ...usePrinterSettings.getState().printers,
        KITCHEN: { ...usePrinterSettings.getState().printers.KITCHEN, autoPrint: false },
      },
    });
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: true }));
    expect(ticket.printOrderTicket).toHaveBeenCalledTimes(1);
  });

  it("reports a failed pairing and does not print", async () => {
    const connect = setUp({ KITCHEN: true });
    connect.mockResolvedValue(false);
    link.isPrinterConnected.mockReturnValue(false);
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: true }));

    expect(ticket.printOrderTicket).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error.mock.calls[0][0]).toContain("connectFailed");
  });

  it("tells the cashier on a browser without Bluetooth", async () => {
    setUp({ KITCHEN: true });
    link.isBluetoothSupported.mockReturnValue(false);
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: true }));
    expect(toast.error).toHaveBeenCalledWith("pos.print.bluetoothUnsupported");
  });
});

describe("failures", () => {
  it("surfaces the printer's own error, naming the printer, and never throws", async () => {
    setUp({ KITCHEN: true });
    ticket.printOrderTicket.mockRejectedValue(new Error("Paper out"));
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: false }));

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error.mock.calls[0][0]).toContain("pos.printers.roles.KITCHEN.name");
    expect(toast.error.mock.calls[0][0]).toContain("Paper out");
    expect(result.current.isPrinting).toBe(false);
  });

  it("names the missing printer when it dropped between the check and the write", async () => {
    setUp({ KITCHEN: true });
    ticket.printOrderTicket.mockRejectedValue(new PrinterNotConnectedError("KITCHEN"));
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: false }));
    expect(toast.error.mock.calls[0][0]).toContain("notConnected");
  });

  it("one printer failing does not stop the others", async () => {
    setUp({ KITCHEN: true, BAR: true });
    ticket.printOrderTicket.mockImplementation(async (role: string) => {
      if (role === "KITCHEN") throw new Error("Paper out");
    });
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: false }));

    expect(ticket.printOrderTicket).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});

describe("an on-demand printer (set up, but not printing by itself)", () => {
  // Kitchen prints by itself; the bar only when a cashier taps Print.
  const kitchenAutoBarOnDemand = () => {
    setUp({ KITCHEN: true, BAR: true });
    const { printers } = usePrinterSettings.getState();
    usePrinterSettings.setState({
      printers: { ...printers, BAR: { ...printers.BAR, autoPrint: false } },
    });
  };
  const sectionsOf = (call: unknown[]) =>
    (call[1] as { sections: Array<{ department: string }> }).sections.map((s) => s.department);

  it("gives the kitchen its own food only — never a BAR section for a bar that isn't printing", async () => {
    kitchenAutoBarOnDemand();
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: false }));

    expect(ticket.printOrderTicket).toHaveBeenCalledTimes(1);
    expect(ticket.printOrderTicket.mock.calls[0][0]).toBe("KITCHEN");
    expect(sectionsOf(ticket.printOrderTicket.mock.calls[0])).toEqual(["KITCHEN"]);
  });

  it("prints the drink at the bar — once — when a cashier asks for the tickets", async () => {
    kitchenAutoBarOnDemand();
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: true }));

    const byRole = Object.fromEntries(
      ticket.printOrderTicket.mock.calls.map((call) => [call[0], sectionsOf(call)])
    );
    expect(byRole).toEqual({ KITCHEN: ["KITCHEN"], BAR: ["BAR"] });
  });
});

describe("pairing happens before any bytes are sent", () => {
  it("opens the picker first, while the tap's user activation is still fresh", async () => {
    // Kitchen is already connected, the bar is not. A device picker needs the tap's
    // transient activation (about five seconds in Chrome); a ticket sent first would
    // spend some of it, and a label batch could spend all of it.
    const connect = setUp({ KITCHEN: true, BAR: true });
    link.isPrinterConnected.mockImplementation((role: string) => role === "KITCHEN");
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: true }));

    expect(connect).toHaveBeenCalledWith("BAR");
    expect(ticket.printOrderTicket).toHaveBeenCalledTimes(2);
    expect(connect.mock.invocationCallOrder[0]).toBeLessThan(
      Math.min(...ticket.printOrderTicket.mock.invocationCallOrder)
    );
  });
});

describe("a send-time failure is retryable", () => {
  it("offers Try again, which retries only the printer that failed", async () => {
    setUp({ KITCHEN: true, BAR: true });
    ticket.printOrderTicket.mockImplementationOnce(async () => {
      throw new Error("Paper out");
    });
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: false }));

    expect(toast.error).toHaveBeenCalledTimes(1);
    const options = toast.error.mock.calls[0][1];
    expect(options.action.label).toBe("pos.printers.retry");
    expect(ticket.printOrderTicket).toHaveBeenCalledTimes(2); // kitchen failed, bar fine

    ticket.printOrderTicket.mockClear();
    await act(async () => {
      options.action.onClick();
    });

    expect(ticket.printOrderTicket).toHaveBeenCalledTimes(1);
    expect(ticket.printOrderTicket.mock.calls[0][0]).toBe("KITCHEN");
  });

  it("names a wedged printer as not responding, not as a generic failure", async () => {
    setUp({ KITCHEN: true });
    ticket.printOrderTicket.mockRejectedValue(new PrinterTimeoutError("KITCHEN"));
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: false }));

    expect(toast.error.mock.calls[0][0]).toContain("notResponding");
    expect(toast.error.mock.calls[0][0]).toContain("pos.printers.roles.KITCHEN.name");
  });
});

describe("a malformed order", () => {
  // A line the planner can't read must never escape into the checkout's success
  // path, which would skip the order-complete screen for a sale already made.
  const broken = {
    ...INPUT,
    items: [{ ...INPUT.items[0], modifiers: undefined as never }],
  };

  it("never throws into the sale, and says nothing when nobody tapped Print", async () => {
    setUp({ KITCHEN: true });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = render();

    await act(() => result.current.printOrder(broken, { interactive: false }));

    expect(ticket.printOrderTicket).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("tells a cashier who tapped Print that it failed", async () => {
    setUp({ KITCHEN: true });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = render();

    await act(() => result.current.printOrder(broken, { interactive: true }));

    expect(toast.error).toHaveBeenCalledWith("pos.print.failed");
    spy.mockRestore();
  });
});

describe("labels", () => {
  it("prints the stickers on the label printer, one per unit", async () => {
    setUp({ LABEL: true });
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: false }));

    expect(ticket.printOrderTicket).not.toHaveBeenCalled();
    expect(labels.printItemLabels).toHaveBeenCalledTimes(1);
    const [stickers, config] = labels.printItemLabels.mock.calls[0];
    expect(stickers).toHaveLength(3); // 2 bread + 1 latte
    expect(config).toMatchObject({ language: "ESCPOS", paperWidth: 32 });
  });

  it("hands the label printer its configured language and size", async () => {
    setUp({ LABEL: true });
    usePrinterSettings.setState({
      label: { ...DEFAULT_LABEL, language: "TSPL", widthMm: 50, heightMm: 40, gapMm: 3 },
    });
    const { result } = render();
    await act(() => result.current.printOrder(INPUT, { interactive: false }));

    expect(labels.printItemLabels.mock.calls[0][1]).toMatchObject({
      language: "TSPL",
      widthMm: 50,
      heightMm: 40,
      gapMm: 3,
    });
  });
});
