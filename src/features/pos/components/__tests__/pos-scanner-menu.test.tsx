import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";

const STRINGS: Record<string, string> = {
  "cashierCheckout.scan.focus": "Scan barcode",
  "cashierCheckout.scan.title": "Barcode scanner",
  "cashierCheckout.scan.testTitle": "Test your scanner",
  "cashierCheckout.scan.testPlaceholder": "Scan a barcode…",
  "cashierCheckout.scan.testMatch": "Matches {name}",
  "cashierCheckout.scan.testNoMatch": "No menu item has this barcode",
  "cashierCheckout.scan.testDetail": "Read {code} · slowest pause {gap} ms",
  "cashierCheckout.scan.testTyped": "That looked like typing, not a scan",
  "cashierCheckout.scan.testTypedDetail": "Slowest pause {gap} ms; a scan needs under {limit} ms.",
  "cashierCheckout.scan.settingEnabled": "Scan anywhere on this screen",
  "cashierCheckout.scan.speedLabel": "Scanner speed",
  "cashierCheckout.scan.speedStandard": "Standard",
  "cashierCheckout.scan.speedSlow": "Slow / Bluetooth",
};
vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => STRINGS[k] ?? k }),
}));

import { PosScannerMenu } from "../pos-scanner-menu";
import { usePosScannerSettings } from "../../hooks/use-pos-scanner-settings";

const categories = [
  {
    items: [
      { name: "Ramen", barcode: "5901234123457" },
      { name: "Tea", barcode: null },
    ],
  },
];

beforeEach(() => {
  localStorage.clear();
  usePosScannerSettings.setState({ enabled: true, speed: "standard" });
});

// No `document.body.innerHTML = ""` here: the Radix popover portals into <body>,
// and wiping it before Testing Library's own cleanup unmounts makes React try to
// remove nodes that are already gone.

function renderMenu() {
  // The trigger is absolutely positioned against the search box; any relative parent will do.
  return render(
    <div className="relative">
      <PosScannerMenu categories={categories} />
    </div>
  );
}

const trigger = () => screen.getByRole("button", { name: "Scan barcode" });

function openPanel() {
  fireEvent.click(trigger());
  return screen.getByRole("dialog", { name: "Barcode scanner" });
}

/** Types into the test field like a scanner (`gap` ms between keys), then Enter, with controlled timestamps. */
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

describe("PosScannerMenu", () => {
  it("is closed until the scan button is tapped, then offers a test field and settings", () => {
    renderMenu();
    expect(screen.queryByRole("dialog")).toBeNull();

    const panel = openPanel();
    expect(within(panel).getByPlaceholderText("Scan a barcode…")).toBeInTheDocument();
    expect(within(panel).getByRole("switch")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Slow / Bluetooth" })).toBeInTheDocument();
  });

  it("keeps the scan button a full 40px square so it stays a real tap target", () => {
    renderMenu();
    expect(trigger().className).toContain("size-10");
  });

  it("reports a scanned code the menu has, and how slow the slowest pause was", () => {
    renderMenu();
    const panel = openPanel();
    scanInto(within(panel).getByPlaceholderText("Scan a barcode…"), "5901234123457");

    const status = within(panel).getByRole("status");
    expect(status).toHaveTextContent("Matches Ramen");
    expect(status).toHaveTextContent("Read 5901234123457 · slowest pause 10 ms");
  });

  it("says so when the scanner works but the menu has no such barcode", () => {
    renderMenu();
    const panel = openPanel();
    scanInto(within(panel).getByPlaceholderText("Scan a barcode…"), "0000000000000");

    const status = within(panel).getByRole("status");
    expect(status).toHaveTextContent("No menu item has this barcode");
    expect(status).toHaveTextContent("Read 0000000000000");
  });

  it("calls slow input typing, and shows the numbers that explain it", () => {
    renderMenu();
    const panel = openPanel();
    scanInto(within(panel).getByPlaceholderText("Scan a barcode…"), "12345678", 200);

    const status = within(panel).getByRole("status");
    expect(status).toHaveTextContent("That looked like typing, not a scan");
    expect(status).toHaveTextContent("Slowest pause 200 ms; a scan needs under 50 ms.");
  });

  it("judges by the chosen speed: a 100ms scanner fails at Standard and passes at Slow", () => {
    renderMenu();
    const panel = openPanel();
    const field = () => within(panel).getByPlaceholderText("Scan a barcode…");

    scanInto(field(), "5901234123457", 100);
    expect(within(panel).getByRole("status")).toHaveTextContent("That looked like typing");

    fireEvent.click(within(panel).getByRole("button", { name: "Slow / Bluetooth" }));
    scanInto(field(), "5901234123457", 100, 9000);
    expect(within(panel).getByRole("status")).toHaveTextContent("Matches Ramen");

    // …and the limit it quotes is Slow's, not Standard's.
    scanInto(field(), "12345678", 300, 20000);
    expect(within(panel).getByRole("status")).toHaveTextContent("a scan needs under 120 ms");
  });

  it("writes the settings to the per-device store", () => {
    renderMenu();
    const panel = openPanel();

    const standard = within(panel).getByRole("button", { name: "Standard" });
    const slow = within(panel).getByRole("button", { name: "Slow / Bluetooth" });
    expect(standard).toHaveAttribute("aria-pressed", "true");
    expect(slow).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(slow);
    expect(usePosScannerSettings.getState().speed).toBe("slow");
    expect(slow).toHaveAttribute("aria-pressed", "true");

    const anywhere = within(panel).getByRole("switch");
    expect(anywhere).toBeChecked();
    fireEvent.click(anywhere);
    expect(usePosScannerSettings.getState().enabled).toBe(false);
  });

  it("does not carry an old verdict into the next visit", () => {
    renderMenu();
    let panel = openPanel();
    scanInto(within(panel).getByPlaceholderText("Scan a barcode…"), "5901234123457");
    expect(within(panel).getByRole("status")).toHaveTextContent("Matches Ramen");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    panel = openPanel();
    expect(within(panel).getByRole("status")).toBeEmptyDOMElement();
  });
});
