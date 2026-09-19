"use client";

import { useEffect, useRef } from "react";
import { ScanDetector } from "../lib/barcode";

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "radio",
  "range",
  "reset",
  "submit",
  "image",
  "file",
  "color",
]);

/**
 * True when keystrokes aimed at this element are being typed INTO it. A scan
 * that lands in a text field belongs to that field — the POS search box handles
 * its own Enter (see PosShell), and a discount or note field must never have its
 * contents hijacked by the scanner path.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return !NON_TEXT_INPUT_TYPES.has((target as HTMLInputElement).type);
  const role = target.getAttribute("role");
  return role === "textbox" || role === "searchbox" || role === "combobox";
}

/**
 * True while any dialog / popover is open. A scan then must not silently add an
 * item to a cart the cashier can't see — worst case, mid-payment, where it would
 * change the total the customer is in the middle of paying. Radix mounts dialog
 * content only while open, so its presence in the DOM is the signal.
 */
export function isOverlayOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}

interface UseBarcodeScannerOptions {
  onScan: (code: string) => void;
  /** Off, the listener isn't even attached. Default true. */
  enabled?: boolean;
  /**
   * Longest pause between two keys that still counts as one scan (ms). Default is
   * ScanDetector's. Changing it re-attaches the listener, so it is only ever
   * moved by the cashier's own scanner-speed setting, never per keystroke.
   */
  maxGapMs?: number;
}

/**
 * Listens for a keyboard-wedge barcode scanner anywhere on the page.
 *
 * A scanner "types" the code faster than any person can and ends with Enter;
 * ScanDetector separates that from ordinary typing by timing. This hook only
 * feeds it keydowns from outside editable fields (see isEditableTarget) and, when
 * a burst ends in Enter, calls `onScan` with the code.
 *
 * preventDefault() on that terminating Enter matters: if a tile button still has
 * focus from the last tap, the scanner's Enter would otherwise "click" it and add
 * a second, unrelated item. Enter is only swallowed for a recognised scan — a
 * normal Enter on a focused button keeps working.
 *
 * Timing uses KeyboardEvent.timeStamp (when the input system produced the key),
 * not Date.now() at handler time: a busy main thread must not stretch the gaps
 * between a scanner's keys and make a real scan look like slow typing.
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  maxGapMs,
}: UseBarcodeScannerOptions): void {
  // A ref so a new inline callback each render never re-attaches the listener
  // (which would drop a half-received scan).
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    const detector = new ScanDetector({ maxGapMs });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      if (isEditableTarget(e.target) || isOverlayOpen()) {
        // Characters typed into a field must not leak into a later "scan".
        detector.reset();
        return;
      }
      const code = detector.feed(e.key, e.timeStamp);
      if (code) {
        e.preventDefault();
        onScanRef.current(code);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, maxGapMs]);
}
