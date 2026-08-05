import { describe, it, expect, vi, afterEach } from "vitest";
import { reverseGeocode } from "../geocode";

describe("reverseGeocode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the display_name on a successful lookup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ display_name: "Jl. Sudirman, Jakarta" }),
      })
    );
    const result = await reverseGeocode(-6.2, 106.8);
    expect(result).toBe("Jl. Sudirman, Jakarta");
  });

  it("returns null on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await reverseGeocode(-6.2, 106.8);
    expect(result).toBeNull();
  });

  it("returns null when fetch throws (timeout/network failure)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error"))
    );
    const result = await reverseGeocode(-6.2, 106.8);
    expect(result).toBeNull();
  });

  it("returns null when the response has no display_name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    );
    const result = await reverseGeocode(-6.2, 106.8);
    expect(result).toBeNull();
  });
});
