import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/lang/i18n-provider", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

import { PosModeFullscreenToggle } from "../pos-mode-fullscreen-toggle";

// jsdom has no Fullscreen API: each test installs exactly the one it describes.
const root = document.documentElement as unknown as Record<string, unknown>;
const doc = document as unknown as Record<string, unknown>;
let current: Element | null = null;

function install({ prefixed = false } = {}) {
  const enter = vi.fn(async () => {
    current = document.documentElement;
    document.dispatchEvent(new Event(prefixed ? "webkitfullscreenchange" : "fullscreenchange"));
  });
  const exit = vi.fn(async () => {
    current = null;
    document.dispatchEvent(new Event(prefixed ? "webkitfullscreenchange" : "fullscreenchange"));
  });
  const enterKey = prefixed ? "webkitRequestFullscreen" : "requestFullscreen";
  const exitKey = prefixed ? "webkitExitFullscreen" : "exitFullscreen";
  const elementKey = prefixed ? "webkitFullscreenElement" : "fullscreenElement";
  Object.defineProperty(root, enterKey, { value: enter, configurable: true });
  Object.defineProperty(doc, exitKey, { value: exit, configurable: true });
  Object.defineProperty(doc, elementKey, { get: () => current, configurable: true });
  return { enter, exit, keys: [enterKey, exitKey, elementKey] };
}

let installed: string[] = [];
afterEach(() => {
  for (const key of installed) {
    delete root[key];
    delete doc[key];
  }
  installed = [];
  current = null;
});

describe("PosModeFullscreenToggle", () => {
  it("renders nothing where the browser has no fullscreen (iPhone Safari)", () => {
    const { container } = render(<PosModeFullscreenToggle />);
    expect(container).toBeEmptyDOMElement();
  });

  it("enters fullscreen, then offers to exit it", async () => {
    const api = install();
    installed = api.keys;
    render(<PosModeFullscreenToggle />);

    const button = screen.getByRole("button", { name: "cashierCheckout.topBar.fullscreen" });
    // A touch target, not a bare icon (AGENTS.md: >= 40px).
    expect(button.className).toContain("size-10");
    await act(async () => {
      fireEvent.click(button);
    });
    expect(api.enter).toHaveBeenCalledTimes(1);

    const exit = screen.getByRole("button", { name: "cashierCheckout.topBar.exitFullscreen" });
    expect(exit).toHaveAttribute("aria-pressed", "true");
    await act(async () => {
      fireEvent.click(exit);
    });
    expect(api.exit).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "cashierCheckout.topBar.fullscreen" })
    ).toBeInTheDocument();
  });

  it("falls back to the WebKit-prefixed API older iPad Safari has", async () => {
    const api = install({ prefixed: true });
    installed = api.keys;
    render(<PosModeFullscreenToggle />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.topBar.fullscreen" }));
    });
    expect(api.enter).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "cashierCheckout.topBar.exitFullscreen" })
    ).toBeInTheDocument();
  });

  it("never lets a refused request escape the click", async () => {
    const api = install();
    installed = api.keys;
    api.enter.mockRejectedValueOnce(new Error("Permissions check failed"));
    render(<PosModeFullscreenToggle />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "cashierCheckout.topBar.fullscreen" }));
    });
    // Still windowed, still offering fullscreen.
    expect(
      screen.getByRole("button", { name: "cashierCheckout.topBar.fullscreen" })
    ).toBeInTheDocument();
  });
});
