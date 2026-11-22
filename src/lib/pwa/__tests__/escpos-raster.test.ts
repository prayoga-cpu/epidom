/**
 * "Print non-Latin text as an image" — the pure half.
 *
 * Nothing here can prove an image comes out right on a physical printer. What
 * IS decidable in software is pinned exactly: the GS v 0 bytes, the banding,
 * the 1-bit packing, and that wrapping never splits a Thai consonant from the
 * vowel and tone marks that sit on it.
 */
import { describe, expect, it } from "vitest";
import {
  RASTER_BAND_ROWS,
  encodeRasterImage,
  layoutRasterLine,
  needsRaster,
  packMonoBitmap,
  printerDotWidth,
  segmentForWrap,
  splitGraphemes,
  trimBlankRows,
  wrapMeasured,
  type RasterBitmap,
} from "../escpos-raster";

const HEADER = [0x1d, 0x76, 0x30, 0x00];

/** Every GS v 0 command in a buffer, as { rowBytes, rows, data }. */
function bands(bytes: Uint8Array) {
  const out: Array<{ rowBytes: number; rows: number; data: number[] }> = [];
  let i = 0;
  while (i < bytes.length) {
    expect(Array.from(bytes.slice(i, i + 4))).toEqual(HEADER);
    const rowBytes = bytes[i + 4] | (bytes[i + 5] << 8);
    const rows = bytes[i + 6] | (bytes[i + 7] << 8);
    const size = rowBytes * rows;
    out.push({ rowBytes, rows, data: Array.from(bytes.slice(i + 8, i + 8 + size)) });
    i += 8 + size;
  }
  return out;
}

const solid = (width: number, height: number, fill = 0xff): RasterBitmap => ({
  width,
  height,
  data: new Uint8Array(Math.ceil(width / 8) * height).fill(fill),
});

describe("printerDotWidth / needsRaster", () => {
  it("models 58mm as 384 dots and 80mm as 576 dots", () => {
    expect(printerDotWidth(32)).toBe(384);
    expect(printerDotWidth(48)).toBe(576);
  });

  it("leaves printable ASCII to the text path and flags everything else", () => {
    expect(needsRaster("Total  Rp 25.000 ~ #12")).toBe(false);
    expect(needsRaster("")).toBe(false);
    expect(needsRaster("ชาไทย")).toBe(true);
    expect(needsRaster("café")).toBe(true);
    expect(needsRaster("10 €")).toBe(true);
  });
});

describe("encodeRasterImage", () => {
  it("emits GS v 0 m xL xH yL yH followed by the rows, exactly", () => {
    const bitmap: RasterBitmap = {
      width: 16,
      height: 2,
      data: new Uint8Array([0x80, 0x01, 0xff, 0x00]),
    };
    expect(Array.from(encodeRasterImage(bitmap))).toEqual([
      0x1d, 0x76, 0x30, 0x00, 0x02, 0x00, 0x02, 0x00, 0x80, 0x01, 0xff, 0x00,
    ]);
  });

  it("rounds a width that is not a multiple of 8 up to whole bytes", () => {
    const bitmap: RasterBitmap = { width: 12, height: 1, data: new Uint8Array([0xff, 0xf0]) };
    expect(Array.from(encodeRasterImage(bitmap))).toEqual([
      0x1d, 0x76, 0x30, 0x00, 0x02, 0x00, 0x01, 0x00, 0xff, 0xf0,
    ]);
  });

  it("sends 48 bytes per row on 58mm paper and 72 on 80mm", () => {
    expect(bands(encodeRasterImage(solid(384, 3)))[0]).toMatchObject({ rowBytes: 48, rows: 3 });
    expect(bands(encodeRasterImage(solid(576, 3)))[0]).toMatchObject({ rowBytes: 72, rows: 3 });
  });

  it("splits a tall image into bands, in order, losing and adding nothing", () => {
    const bitmap: RasterBitmap = {
      width: 16,
      height: 3,
      data: new Uint8Array([1, 2, 3, 4, 5, 6]),
    };
    expect(Array.from(encodeRasterImage(bitmap, 2))).toEqual([
      ...[0x1d, 0x76, 0x30, 0x00, 0x02, 0x00, 0x02, 0x00, 1, 2, 3, 4],
      ...[0x1d, 0x76, 0x30, 0x00, 0x02, 0x00, 0x01, 0x00, 5, 6],
    ]);
  });

  it("uses the default band height for a long image", () => {
    const height = RASTER_BAND_ROWS * 12 + 12;
    const parts = bands(encodeRasterImage(solid(384, height)));
    expect(parts).toHaveLength(13);
    expect(parts.slice(0, 12).every((part) => part.rows === RASTER_BAND_ROWS)).toBe(true);
    expect(parts[12].rows).toBe(12);
    expect(parts.reduce((sum, part) => sum + part.rows, 0)).toBe(height);
  });

  it("writes a row width above 255 bytes little-endian", () => {
    const [band] = bands(encodeRasterImage(solid(2056, 1)));
    expect(band.rowBytes).toBe(257);
    expect(Array.from(encodeRasterImage(solid(2056, 1)).slice(4, 6))).toEqual([0x01, 0x01]);
  });

  it("encodes nothing for an empty or inconsistent bitmap rather than a bad command", () => {
    expect(encodeRasterImage({ width: 0, height: 4, data: new Uint8Array(0) })).toHaveLength(0);
    expect(encodeRasterImage({ width: 8, height: 0, data: new Uint8Array(0) })).toHaveLength(0);
    // Claims 4 rows, carries 2.
    expect(encodeRasterImage({ width: 8, height: 4, data: new Uint8Array(2) })).toHaveLength(0);
  });
});

describe("packMonoBitmap", () => {
  const px = (r: number, g: number, b: number, a = 255) => [r, g, b, a];

  it("packs the leftmost dot into the most significant bit", () => {
    const black = px(0, 0, 0);
    const white = px(255, 255, 255);
    const row = [black, ...Array(7).fill(white), black].flat();
    const bitmap = packMonoBitmap(row, 9, 1);
    expect(bitmap.width).toBe(9);
    expect(Array.from(bitmap.data)).toEqual([0x80, 0x80]);
  });

  it("thresholds grey, and never prints a transparent pixel", () => {
    const row = [px(100, 100, 100), px(200, 200, 200), px(0, 0, 0, 0), px(0, 0, 0)].flat();
    expect(Array.from(packMonoBitmap(row, 4, 1).data)).toEqual([0b1001_0000]);
  });

  it("keeps rows apart", () => {
    const black = px(0, 0, 0);
    const white = px(255, 255, 255);
    const pixels = [white, black, black, white].flat();
    expect(Array.from(packMonoBitmap(pixels, 2, 2).data)).toEqual([0x40, 0x80]);
  });
});

describe("trimBlankRows", () => {
  const rows = (...values: number[]): RasterBitmap => ({
    width: 8,
    height: values.length,
    data: new Uint8Array(values),
  });

  it("drops blank rows above and below the ink, keeping the margin asked for", () => {
    const trimmed = trimBlankRows(rows(0, 0, 0, 0xff, 0x01, 0, 0, 0), 1);
    expect(trimmed).toEqual(rows(0, 0xff, 0x01, 0));
  });

  it("never invents margin that was not there", () => {
    expect(trimBlankRows(rows(0xff, 0, 0), 2)).toEqual(rows(0xff, 0, 0));
  });

  it("keeps blank rows BETWEEN inked rows — they are the gap between wrapped lines", () => {
    expect(trimBlankRows(rows(0, 0x10, 0, 0, 0x10, 0), 0)).toEqual(rows(0x10, 0, 0, 0x10));
  });

  it("reports a bitmap with no ink at all as nothing drawn", () => {
    expect(trimBlankRows(rows(0, 0, 0))).toBeNull();
  });
});

describe("splitGraphemes", () => {
  // น + mai tho (tone mark) + sara am: one user-perceived character.
  const NAM = "น้ำ";

  it.each([
    ["with Intl.Segmenter", true],
    ["with the fallback", false],
  ])("keeps a Thai consonant with its tone mark and SARA AM (%s)", (_name, useIntl) => {
    expect(splitGraphemes(NAM + NAM, useIntl)).toEqual([NAM, NAM]);
  });

  it("keeps a combining accent with its letter in the fallback", () => {
    expect(splitGraphemes("e\u0301a", false)).toEqual(["e\u0301", "a"]);
  });

  it("does not split a surrogate pair in the fallback", () => {
    expect(splitGraphemes("a😀b", false)).toEqual(["a", "😀", "b"]);
  });
});

describe("segmentForWrap", () => {
  it("loses nothing", () => {
    for (const useIntl of [true, false]) {
      const text = "ข้าวผัดกะเพรา ไก่ไข่ดาว, no MSG (2)";
      expect(segmentForWrap(text, useIntl).join("")).toBe(text);
    }
  });

  it("falls back to words and the spaces between them", () => {
    expect(segmentForWrap("ab  cd e", false)).toEqual(["ab", "  ", "cd", " ", "e"]);
  });

  it("finds word boundaries inside unspaced Thai when Intl.Segmenter is there", () => {
    const segmenter = (Intl as unknown as { Segmenter?: unknown }).Segmenter;
    if (typeof segmenter !== "function") return;
    const parts = segmentForWrap("ขอบคุณที่ใช้บริการ");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("")).toBe("ขอบคุณที่ใช้บริการ");
  });

  it("keeps closing punctuation with the word before it", () => {
    const parts = segmentForWrap("latte, mocha.");
    expect(parts).toContain("latte,");
    expect(parts.some((part) => part.startsWith(","))).toBe(false);
  });
});

/** A line must never begin with a combining mark — that is a tone mark torn off its consonant. */
const STARTS_WITH_MARK = new RegExp("^\\p{M}", "u");

describe("wrapMeasured", () => {
  /** 10 dots per user-perceived character — tone marks are free, as on paper. */
  const measure = (text: string) => splitGraphemes(text, false).length * 10;

  it("returns a line that fits untouched", () => {
    expect(wrapMeasured("iced latte", 200, measure, false)).toEqual(["iced latte"]);
  });

  it("breaks between words, never leaving a space at either end of a line", () => {
    const lines = wrapMeasured("aaaa bbbb cccc", 100, measure, false);
    expect(lines).toEqual(["aaaa bbbb", "cccc"]);
  });

  it("breaks a word wider than the paper between graphemes, not inside one", () => {
    const NAM = "น้ำ";
    const lines = wrapMeasured(NAM.repeat(5), 20, measure, false);
    expect(lines).toEqual([NAM + NAM, NAM + NAM, NAM]);
    for (const line of lines) expect(STARTS_WITH_MARK.test(line)).toBe(false);
  });

  it("wraps unspaced Thai to the width, whatever boundaries the device offers", () => {
    const text = "ขอบคุณที่ใช้บริการแล้วพบกันใหม่";
    for (const useIntl of [true, false]) {
      const lines = wrapMeasured(text, 60, measure, useIntl);
      expect(lines.join("")).toBe(text);
      expect(lines.length).toBeGreaterThan(1);
      for (const line of lines) {
        expect(measure(line)).toBeLessThanOrEqual(60);
        expect(STARTS_WITH_MARK.test(line)).toBe(false);
      }
    }
  });

  it("still makes progress when even one character is wider than the paper", () => {
    expect(wrapMeasured("abc", 5, measure, false)).toEqual(["a", "b", "c"]);
  });

  it("returns nothing for blank text", () => {
    expect(wrapMeasured("", 100, measure)).toEqual([]);
    expect(wrapMeasured("   ", 100, measure)).toEqual([]);
  });
});

describe("layoutRasterLine", () => {
  const measure = (text: string) => text.length * 10;
  const layout = (
    request: Partial<Parameters<typeof layoutRasterLine>[0]> & { text: string },
    width = 384
  ) => layoutRasterLine({ align: "left", widthScale: 1, ...request }, width, measure, false);

  it("starts a left-aligned line at the paper's edge", () => {
    expect(layout({ text: "abc" })).toEqual([[{ text: "abc", x: 0 }]]);
  });

  it("turns leading spaces into an indent in printer cells, on every wrapped line", () => {
    // Two spaces = two 12-dot cells; 100 - 24 leaves room for 7 characters.
    expect(layout({ text: "  aaaa bbbb" }, 100)).toEqual([
      [{ text: "aaaa", x: 24 }],
      [{ text: "bbbb", x: 24 }],
    ]);
  });

  it("doubles the indent cell in double-width mode", () => {
    expect(layout({ text: " ab", widthScale: 2 })).toEqual([[{ text: "ab", x: 24 }]]);
  });

  it("centres each wrapped line on the paper", () => {
    expect(layout({ text: "abcd", align: "center" })).toEqual([[{ text: "abcd", x: 172 }]]);
    expect(layout({ text: "aaaa bb", align: "center" }, 60)).toEqual([
      [{ text: "aaaa", x: 10 }],
      [{ text: "bb", x: 20 }],
    ]);
  });

  it("puts a two-column row on one line with the value flush right", () => {
    expect(layout({ text: "Total", right: "é12" })).toEqual([
      [
        { text: "Total", x: 0 },
        { text: "é12", x: 354 },
      ],
    ]);
  });

  it("keeps a two-column row's indent", () => {
    expect(layout({ text: "  2x", right: "é1" })[0][0]).toEqual({ text: "2x", x: 24 });
  });

  it("wraps the label and drops the value underneath when they cannot share a line", () => {
    // 140 + a 12-dot gap + 50 does not fit 100 dots.
    expect(layout({ text: "aaaa bbbb cccc", right: "99999" }, 100)).toEqual([
      [{ text: "aaaa bbbb", x: 0 }],
      [{ text: "cccc", x: 0 }],
      [{ text: "99999", x: 50 }],
    ]);
  });

  it("needs a full cell between the columns to keep them on one line", () => {
    // 50 + 12 + 40 = 102 > 100.
    expect(layout({ text: "aaaaa", right: "9999" }, 100)).toHaveLength(2);
    // 40 + 12 + 40 = 92.
    expect(layout({ text: "aaaa", right: "9999" }, 100)).toHaveLength(1);
  });

  it("right-aligns a value that has no label", () => {
    expect(layout({ text: "", right: "é1" }, 100)).toEqual([[{ text: "é1", x: 80 }]]);
  });

  it("lays out nothing for blank text", () => {
    expect(layout({ text: "   " })).toEqual([]);
  });
});
