import { describe, it, expect } from "vitest";
import { findItemByBarcode, normalizeBarcode, ScanDetector, SCAN_MAX_KEY_GAP_MS } from "../barcode";

/** Feed `text` one key at a time, `gap` ms apart, then Enter. Returns the Enter's result. */
function type(detector: ScanDetector, text: string, startAt: number, gap: number): string | null {
  let at = startAt;
  for (const ch of text) {
    detector.feed(ch, at);
    at += gap;
  }
  return detector.feed("Enter", at);
}

describe("ScanDetector", () => {
  it("recognises a fast burst ending in Enter as a scan", () => {
    expect(type(new ScanDetector(), "8991234567890", 1_000, 10)).toBe("8991234567890");
  });

  it("does not treat human typing as a scan", () => {
    expect(type(new ScanDetector(), "8991234567890", 1_000, 200)).toBeNull();
  });

  it("a burst is still a scan at exactly the gap limit, and not one just past it", () => {
    expect(type(new ScanDetector(), "123456", 0, SCAN_MAX_KEY_GAP_MS)).toBe("123456");
    expect(type(new ScanDetector(), "123456", 0, SCAN_MAX_KEY_GAP_MS + 1)).toBeNull();
  });

  it("ignores bursts shorter than the minimum length", () => {
    expect(type(new ScanDetector(), "123", 0, 5)).toBeNull();
  });

  it("is not thrown by modifier keys mid-scan", () => {
    const d = new ScanDetector();
    d.feed("A", 0);
    expect(d.feed("Shift", 5)).toBeNull();
    d.feed("B", 10);
    d.feed("1", 15);
    d.feed("2", 20);
    expect(d.feed("Enter", 25)).toBe("AB12");
  });

  it("resets after each scan, so a stray Enter afterwards is nothing", () => {
    const d = new ScanDetector();
    expect(type(d, "12345678", 0, 5)).toBe("12345678");
    expect(d.feed("Enter", 100)).toBeNull();
  });

  it("starts a fresh buffer after a pause, discarding earlier slow typing", () => {
    const d = new ScanDetector();
    d.feed("a", 0);
    d.feed("b", 1_000);
    // a long pause, then the scanner fires
    expect(type(d, "12345678", 2_000, 5)).toBe("12345678");
  });

  it("supports two scans back to back", () => {
    const d = new ScanDetector();
    expect(type(d, "11111111", 0, 5)).toBe("11111111");
    expect(type(d, "22222222", 500, 5)).toBe("22222222");
  });

  it("honours custom thresholds", () => {
    expect(type(new ScanDetector({ minLength: 2 }), "12", 0, 5)).toBe("12");
    expect(type(new ScanDetector({ maxGapMs: 500 }), "123456", 0, 200)).toBe("123456");
  });
});

describe("findItemByBarcode", () => {
  // Typed explicitly: the mixed shapes (barcode null, absent, present) can't
  // be inferred into the single item type findItemByBarcode is generic over.
  const categories: Array<{ items: Array<{ id?: string; barcode?: string | null }> }> = [
    {
      items: [
        { id: "1", barcode: "111" },
        { id: "2", barcode: null },
      ],
    },
    { items: [{ id: "3", barcode: "222" }, { id: "4" }] },
  ];

  it("finds an item across categories by exact match", () => {
    expect(findItemByBarcode(categories, "222")?.id).toBe("3");
    expect(findItemByBarcode(categories, "111")?.id).toBe("1");
  });

  it("trims the scanned code", () => {
    expect(findItemByBarcode(categories, "  222\n")?.id).toBe("3");
    expect(normalizeBarcode(" 5 ")).toBe("5");
  });

  it("does not match partially or by prefix", () => {
    expect(findItemByBarcode(categories, "22")).toBeNull();
    expect(findItemByBarcode(categories, "2222")).toBeNull();
  });

  it("returns null for an empty code or items with no barcode", () => {
    expect(findItemByBarcode(categories, "")).toBeNull();
    expect(findItemByBarcode(categories, "   ")).toBeNull();
    expect(findItemByBarcode([{ items: [{ barcode: null }] }], "null")).toBeNull();
  });
});
