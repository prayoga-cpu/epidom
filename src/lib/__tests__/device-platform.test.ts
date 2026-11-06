import { describe, expect, it } from "vitest";
import { detectPlatform, PLATFORM_NAME } from "../device-platform";

const UA = {
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  ipadOld:
    "Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  chromebook:
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  linux: "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
};

describe("detectPlatform", () => {
  it.each([
    ["macSafari", "macos"],
    ["iphone", "ios"],
    ["ipadOld", "ipados"],
    ["android", "android"],
    ["windows", "windows"],
    ["chromebook", "chromeos"],
    ["linux", "linux"],
  ] as const)("reads %s as %s from the user agent", (key, platform) => {
    expect(detectPlatform({ userAgent: UA[key], maxTouchPoints: 0 })).toBe(platform);
  });

  it("an iPad asking for the desktop site reports a Mac: its touch screen gives it away", () => {
    expect(detectPlatform({ userAgent: UA.macSafari, maxTouchPoints: 5 })).toBe("ipados");
  });

  it("prefers Chromium's platform hint over the user agent", () => {
    expect(detectPlatform({ userAgent: UA.linux, userAgentData: { platform: "Chrome OS" } })).toBe(
      "chromeos"
    );
    expect(detectPlatform({ userAgent: UA.windows, userAgentData: { platform: "macOS" } })).toBe(
      "macos"
    );
  });

  it("an empty hint falls back to the user agent", () => {
    expect(detectPlatform({ userAgent: UA.android, userAgentData: { platform: "" } })).toBe(
      "android"
    );
  });

  it("says nothing when it can't tell", () => {
    expect(detectPlatform({ userAgent: "curl/8.7.1" })).toBeNull();
  });

  it("names each platform the way the button reads", () => {
    expect(PLATFORM_NAME.macos).toBe("macOS");
    expect(PLATFORM_NAME.ios).toBe("iPhone");
    expect(PLATFORM_NAME.chromeos).toBe("Chromebook");
  });
});
