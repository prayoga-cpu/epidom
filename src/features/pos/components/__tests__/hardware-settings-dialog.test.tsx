/**
 * Hardware settings — printers and the barcode scanner paired to this device,
 * opened from the POS Mode More drawer on any POS screen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: "en" }),
}));
vi.mock("@/components/providers/currency-provider", () => ({
  useCurrency: () => ({ currency: "EUR" }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/pwa/printer-connection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pwa/printer-connection")>()),
  isBluetoothSupported: () => true,
  isPrinterConnected: () => false,
}));
vi.mock("@/lib/pwa/printer-test", () => ({ printTestPage: vi.fn() }));

import { HardwareSettingsDialog } from "../hardware-settings-dialog";
import { usePosScannerSettings } from "../../hooks/use-pos-scanner-settings";

function renderDialog(menu?: { categories: unknown[] }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (menu) client.setQueryData(["pos", "menu", "s1"], menu);
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  const view = render(
    <QueryClientProvider client={client}>
      <HardwareSettingsDialog storeId="s1" open={true} onOpenChange={() => {}} />
    </QueryClientProvider>
  );
  return { ...view, fetchSpy };
}

/** Types into the test field like a scanner, then Enter, with controlled timestamps. */
function scanInto(input: HTMLElement, code: string, gap = 10, start = 1000) {
  const press = (key: string, at: number) => {
    const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    Object.defineProperty(ev, "timeStamp", { value: at });
    act(() => {
      input.dispatchEvent(ev);
    });
  };
  [...code].forEach((c, i) => press(c, start + i * gap));
  press("Enter", start + code.length * gap);
}

/** Opens the scanner tab and returns its panel (the printers panel stays mounted beside it). */
const openScannerTab = () => {
  fireEvent.mouseDown(screen.getByRole("tab", { name: /cashierCheckout\.scan\.title/ }), {
    button: 0,
  });
  return within(
    screen.getAllByRole("tabpanel").find((panel) => panel.getAttribute("data-state") === "active")!
  );
};

beforeEach(() => {
  localStorage.clear();
  usePosScannerSettings.setState({ enabled: true, speed: "standard" });
});

describe("HardwareSettingsDialog", () => {
  it("is one dialog with a tab per kind of hardware, printers first", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "pos.hardware.title" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "pos.printers.title",
      "cashierCheckout.scan.title",
    ]);
    // The same printer cards as the Printers dialog.
    expect(screen.getByText("pos.printers.roles.MAIN.name")).toBeInTheDocument();
    expect(screen.getByText("pos.printers.roles.LABEL.name")).toBeInTheDocument();
  });

  it("keeps the printer cards mounted on the scanner tab — a half-typed label size survives", () => {
    renderDialog();
    openScannerTab();
    const printers = screen.getByText("pos.printers.roles.MAIN.name").closest('[role="tabpanel"]');
    expect(printers).toHaveAttribute("data-state", "inactive");
  });

  it("the scanner test takes focus, so a scanner's Enter can't press a switch or button", async () => {
    renderDialog();
    const scanner = openScannerTab();
    // A frame later: in a browser the tapped tab takes focus after the panel mounts.
    await waitFor(() =>
      expect(scanner.getByRole("textbox", { name: "cashierCheckout.scan.testTitle" })).toHaveFocus()
    );
  });

  it("checks a scan against the menu this device already has cached — without fetching it", () => {
    const { fetchSpy } = renderDialog({
      categories: [{ items: [{ name: "Ramen", barcode: "5901234123457" }] }],
    });
    const scanner = openScannerTab();
    scanInto(
      scanner.getByRole("textbox", { name: "cashierCheckout.scan.testTitle" }),
      "5901234123457"
    );
    expect(scanner.getByRole("status")).toHaveTextContent("cashierCheckout.scan.testMatch");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("with no menu on this device it says the scanner works — never a false 'no such item'", () => {
    renderDialog();
    const scanner = openScannerTab();
    scanInto(
      scanner.getByRole("textbox", { name: "cashierCheckout.scan.testTitle" }),
      "5901234123457"
    );
    const status = scanner.getByRole("status");
    expect(status).toHaveTextContent("cashierCheckout.scan.testWorks");
    expect(status).toHaveTextContent("cashierCheckout.scan.testMenuUnknown");
    expect(status).not.toHaveTextContent("cashierCheckout.scan.testNoMatch");
  });

  it("says the scan-anywhere switch is about the Cashier screen, the only one listening", () => {
    renderDialog();
    const scanner = openScannerTab();
    expect(scanner.getByText("cashierCheckout.scan.settingEnabledCashier")).toBeInTheDocument();
    fireEvent.click(scanner.getByRole("switch"));
    expect(usePosScannerSettings.getState().enabled).toBe(false);
  });
});
