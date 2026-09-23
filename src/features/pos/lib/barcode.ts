/**
 * Barcode scanner support for the cashier.
 *
 * A hardware scanner is a keyboard wedge: it "types" the code's characters far
 * faster than any person can (tens of ms apart) and finishes with Enter. That
 * timing is the only thing that separates a scan from someone typing, so it is
 * kept here as a small pure state machine the hook feeds keydown events into.
 */

/** Wedge scanners emit keys well under ~30ms apart; a human is rarely under ~80ms. */
export const SCAN_MAX_KEY_GAP_MS = 50;

/** Shorter than this is treated as noise, not a code. */
export const SCAN_MIN_LENGTH = 4;

export class ScanDetector {
  private buffer = "";
  private lastAt = 0;
  private readonly maxGapMs: number;
  private readonly minLength: number;

  constructor(opts: { maxGapMs?: number; minLength?: number } = {}) {
    this.maxGapMs = opts.maxGapMs ?? SCAN_MAX_KEY_GAP_MS;
    this.minLength = opts.minLength ?? SCAN_MIN_LENGTH;
  }

  /**
   * Feed one keydown. Returns the finished code when `Enter` ends a burst of
   * fast keys, otherwise null. A pause longer than the gap starts a fresh
   * buffer, so slow typing never accumulates into a "code".
   */
  feed(key: string, at: number): string | null {
    if (key === "Enter") {
      const code = this.buffer;
      this.reset();
      return code.length >= this.minLength ? code : null;
    }
    // Modifiers and navigation keys (Shift, Tab, arrows…) are not part of the
    // code and must not break a burst either.
    if (key.length !== 1) return null;

    if (this.buffer && at - this.lastAt > this.maxGapMs) this.buffer = "";
    this.buffer += key;
    this.lastAt = at;
    return null;
  }

  reset(): void {
    this.buffer = "";
    this.lastAt = 0;
  }
}

export function normalizeBarcode(raw: string): string {
  return raw.trim();
}

/**
 * Exact match against `Product.barcode`, which the POS menu carries on each
 * item. Deliberately exact and case-sensitive: a barcode is an identifier, and
 * a prefix/fuzzy match would add the wrong product on a partial scan.
 */
export function findItemByBarcode<T extends { barcode?: string | null }>(
  categories: Array<{ items: T[] }>,
  code: string
): T | null {
  const wanted = normalizeBarcode(code);
  if (!wanted) return null;
  for (const category of categories) {
    for (const item of category.items) {
      if (item.barcode && item.barcode === wanted) return item;
    }
  }
  return null;
}
