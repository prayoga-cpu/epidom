import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTodayKey } from "../use-today-key";

// Local-time constructors throughout, so this holds in any timezone.
const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) =>
  new Date(y, mo - 1, d, h, mi, s);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useTodayKey", () => {
  it("is the user's local date", () => {
    vi.setSystemTime(at(2026, 9, 19, 14, 30));
    const { result } = renderHook(() => useTodayKey());
    expect(result.current).toBe("2026-09-19");
  });

  it("rolls over by itself at local midnight — a till left open overnight moves to the new day", () => {
    vi.setSystemTime(at(2026, 9, 19, 23, 59, 30));
    const { result } = renderHook(() => useTodayKey());
    expect(result.current).toBe("2026-09-19");

    act(() => {
      vi.advanceTimersByTime(31_000); // 00:00:01 on the 20th
    });
    expect(result.current).toBe("2026-09-20");
  });

  it("keeps rolling over on the following nights too", () => {
    vi.setSystemTime(at(2026, 9, 19, 23, 59, 50));
    const { result } = renderHook(() => useTodayKey());
    act(() => {
      vi.advanceTimersByTime(11_000);
    });
    expect(result.current).toBe("2026-09-20");
    act(() => {
      vi.advanceTimersByTime(24 * 3_600_000);
    });
    expect(result.current).toBe("2026-09-21");
  });

  it("catches up when the tab wakes after the clock jumped (a tablet asleep overnight never fires its timer)", () => {
    vi.setSystemTime(at(2026, 9, 19, 22, 0));
    const { result } = renderHook(() => useTodayKey());
    expect(result.current).toBe("2026-09-19");

    // The device slept: time moved on with no timer having run.
    vi.setSystemTime(at(2026, 9, 20, 8, 0));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe("2026-09-20");
  });

  it("stops its timer and listeners when unmounted", () => {
    vi.setSystemTime(at(2026, 9, 19, 12, 0));
    const { unmount } = renderHook(() => useTodayKey());
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
