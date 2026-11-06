/**
 * Which device family the visitor is browsing on, for the marketing header's
 * "Start on macOS / Windows / iPhone ..." button. Read in the browser only:
 * there is no answer on the server (the marketing pages are static).
 */
export type DevicePlatform =
  | "macos"
  | "windows"
  | "ios"
  | "ipados"
  | "android"
  | "chromeos"
  | "linux";

/** How each platform is named in the button. Product names: the same in every language. */
export const PLATFORM_NAME: Record<DevicePlatform, string> = {
  macos: "macOS",
  windows: "Windows",
  ios: "iPhone",
  ipados: "iPad",
  android: "Android",
  chromeos: "Chromebook",
  linux: "Linux",
};

/** The parts of `navigator` the detection reads (so tests can pass plain objects). */
export interface NavigatorLike {
  userAgent: string;
  maxTouchPoints?: number;
  userAgentData?: { platform?: string; mobile?: boolean } | null;
}

/**
 * The visitor's platform, or null when it can't be told. Chromium's
 * `userAgentData.platform` is used when present; otherwise the user-agent
 * string. iPadOS asks for desktop sites and so reports itself as a Mac:
 * a "Mac" with a touch screen is an iPad.
 */
export function detectPlatform(nav: NavigatorLike): DevicePlatform | null {
  const hinted = nav.userAgentData?.platform?.toLowerCase();
  if (hinted) {
    if (hinted === "android") return "android";
    if (hinted === "chrome os" || hinted === "chromeos") return "chromeos";
    if (hinted === "windows") return "windows";
    if (hinted === "macos") return (nav.maxTouchPoints ?? 0) > 1 ? "ipados" : "macos";
    if (hinted === "ios") return "ios";
    if (hinted === "linux") return "linux";
  }

  const ua = nav.userAgent;
  if (/iPhone|iPod/.test(ua)) return "ios";
  if (/iPad/.test(ua)) return "ipados";
  // Before Linux: Android's user agent says "Linux; Android".
  if (/Android/.test(ua)) return "android";
  if (/CrOS/.test(ua)) return "chromeos";
  if (/Macintosh|Mac OS X/.test(ua)) return (nav.maxTouchPoints ?? 0) > 1 ? "ipados" : "macos";
  if (/Windows/.test(ua)) return "windows";
  if (/Linux|X11/.test(ua)) return "linux";
  return null;
}
