"use client";

import { useSyncExternalStore } from "react";
import { detectPlatform, type DevicePlatform } from "@/lib/device-platform";

// The platform never changes while the page is open: nothing to subscribe to.
const subscribe = () => () => {};

/**
 * The visitor's device family, or null on the server and during hydration
 * (so the server's HTML and the first client render agree), and when it
 * can't be told.
 */
export function useDevicePlatform(): DevicePlatform | null {
  return useSyncExternalStore(
    subscribe,
    () => detectPlatform(navigator as Navigator & { userAgentData?: { platform?: string } }),
    () => null
  );
}
