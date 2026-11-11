"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny vibration feedback for the till (tap an item, change a quantity, clear, charge).
 * On by default; the cashier can switch it off in Hardware settings and the choice stays on
 * this device. Devices without the Vibration API (iPhone/iPad Safari, desktops) do nothing.
 */
const KEY = "epidom:posHaptics";
const EVENT = "epidom:posHapticsChanged";

export type HapticKind = "tap" | "remove" | "charge" | "success" | "error";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  remove: 15,
  charge: 25,
  success: [30, 40, 30],
  error: [20, 30, 20, 30, 20],
};

export function hapticsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* private mode: the choice just won't persist */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function haptic(kind: HapticKind = "tap") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (!hapticsEnabled()) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* some browsers throw outside a user gesture */
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

/** The setting as React state (server render: on). */
export function useHapticsEnabled() {
  return useSyncExternalStore(subscribe, hapticsEnabled, () => true);
}
