/**
 * preloadHelpSheet: fetches the Help sheet's chunk ahead of the first tap, but
 * only while online. The chunk runtime remembers a failed load for the rest of
 * the page's life, so a try made offline would break Help until a reload.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loaded = vi.hoisted(() => vi.fn());
vi.mock("../help-sheet", () => {
  loaded();
  return { HelpSheet: () => null };
});

import { preloadHelpSheet } from "../help-sheet-loader";

let online = true;
beforeEach(() => {
  vi.useFakeTimers();
  online = true;
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => online });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("preloadHelpSheet", () => {
  // Order matters: the first load that starts marks the preload done for the page.
  it("does nothing once cleaned up before its idle moment", async () => {
    const cleanup = preloadHelpSheet();
    cleanup();
    await vi.advanceTimersByTimeAsync(10_000);
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(loaded).not.toHaveBeenCalled();
  });

  it("waits while offline, then loads the chunk once the connection is back", async () => {
    online = false;
    const cleanup = preloadHelpSheet();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(loaded).not.toHaveBeenCalled();

    online = true;
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(2_000);
    vi.useRealTimers();
    await vi.waitFor(() => expect(loaded).toHaveBeenCalledTimes(1));

    // Started once per page: another screen's call is a no-op.
    preloadHelpSheet()();
    cleanup();
    expect(loaded).toHaveBeenCalledTimes(1);
  });
});
