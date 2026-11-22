// "Print non-Latin text as an image" — the pure half.
//
// ESC/POS text is CP437 here: only ASCII survives (`toPrinterAscii` turns the
// rest into "?"), so a Thai item name prints as "????". The way round a missing
// code page is to draw the line ourselves and send it as a picture, with the
// standard raster command every ESC/POS printer since the TM-T88 understands:
//
//   GS v 0  m  xL xH  yL yH  d1…dk      (0x1D 0x76 0x30 …)
//
// This file holds everything that needs no canvas — the command encoder, the
// bitmap helpers, the wrapping and the line layout — so all of it is unit-tested
// byte for byte. Drawing the glyphs is text-raster.ts.
//
// OPT-IN and unverified on hardware: nothing here runs unless a printer's
// "print as image" switch is on (see use-printer-settings.ts).

/** A 1-bit image: rows of packed bytes, most significant bit = leftmost dot, 1 = black. */
export interface RasterBitmap {
  /** Width in dots. */
  width: number;
  /** Height in dot rows. */
  height: number;
  /** `ceil(width / 8) * height` bytes. */
  data: Uint8Array;
}

/** One printed line, with the text-mode state it would have been printed in. */
export interface RasterLineRequest {
  /** The left (or only) text. Leading spaces are an indent, kept on wrapped lines. */
  text: string;
  /** Set for a two-column row: drawn right-aligned on the same bitmap. */
  right?: string;
  /** Characters per line of the paper (32 = 58mm, 48 = 80mm). */
  cols: number;
  align: "left" | "center";
  bold: boolean;
  /** 2 while the printer is in double-width mode. */
  widthScale: 1 | 2;
  /** 2 while the printer is in double-height mode. */
  heightScale: 1 | 2;
}

/**
 * Draws a line. `render` returns null whenever it cannot (no canvas, nothing
 * drawn) and must never throw — the caller then prints the line as text, exactly
 * as it always has.
 */
export interface LineRasterizer {
  isAvailable(): boolean;
  render(request: RasterLineRequest): RasterBitmap | null;
}

/** Font A is 12 dots wide: 32 columns = 384 dots (58mm), 48 columns = 576 dots (80mm). */
export const DOTS_PER_COLUMN = 12;

export function printerDotWidth(cols: number): number {
  return Math.max(1, Math.round(cols)) * DOTS_PER_COLUMN;
}

/** True when the string holds anything the text path cannot print as itself. */
export function needsRaster(text: string): boolean {
  return /[^\x20-\x7e]/.test(text);
}

export function rasterBytesPerRow(width: number): number {
  return Math.ceil(width / 8);
}

/**
 * Rows per `GS v 0` command. A tall image is sent as several short ones, each
 * printed and fed as it arrives, so no single command has to fit in a cheap
 * printer's input buffer: 24 rows is 1,152 bytes on 58mm and 1,728 on 80mm.
 */
export const RASTER_BAND_ROWS = 24;

const GS = 0x1d;

/**
 * The bitmap as `GS v 0` commands (normal scale, m = 0), split into bands of at
 * most `bandRows` rows. An empty or inconsistent bitmap encodes to nothing.
 */
export function encodeRasterImage(
  bitmap: RasterBitmap,
  bandRows: number = RASTER_BAND_ROWS
): Uint8Array {
  const rowBytes = rasterBytesPerRow(bitmap.width);
  const rows = Math.floor(bitmap.height);
  if (rowBytes <= 0 || rowBytes > 0xffff || rows <= 0 || bitmap.data.length < rowBytes * rows) {
    return new Uint8Array(0);
  }
  const band = Math.min(0xffff, Math.max(1, Math.floor(bandRows)));
  const bandCount = Math.ceil(rows / band);
  const out = new Uint8Array(bandCount * 8 + rowBytes * rows);
  let offset = 0;
  for (let start = 0; start < rows; start += band) {
    const count = Math.min(band, rows - start);
    out[offset++] = GS;
    out[offset++] = 0x76;
    out[offset++] = 0x30;
    out[offset++] = 0x00;
    out[offset++] = rowBytes & 0xff;
    out[offset++] = (rowBytes >> 8) & 0xff;
    out[offset++] = count & 0xff;
    out[offset++] = (count >> 8) & 0xff;
    out.set(bitmap.data.subarray(start * rowBytes, (start + count) * rowBytes), offset);
    offset += count * rowBytes;
  }
  return out;
}

/** Anything darker than this (0 = black, 255 = white) prints as a dot. */
export const RASTER_THRESHOLD = 160;

/**
 * RGBA pixels (as `getImageData` returns them) → a packed 1-bit bitmap. A pixel
 * is black when it is opaque enough and darker than `threshold`; the threshold
 * sits above mid-grey on purpose, so anti-aliased edges thicken thin strokes
 * rather than erase them — a thermal head drops hairlines.
 */
export function packMonoBitmap(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  threshold: number = RASTER_THRESHOLD
): RasterBitmap {
  const rowBytes = rasterBytesPerRow(width);
  const data = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (rgba[i + 3] < 128) continue;
      const luminance = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
      if (luminance < threshold) data[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { width, height, data };
}

/**
 * Drops the blank rows above and below the ink, keeping `pad` rows of margin
 * (never more than were there), so a line of short glyphs does not feed as much
 * paper as one with stacked Thai tone marks. Null when the bitmap has no ink at
 * all — the caller treats that as "could not draw".
 */
export function trimBlankRows(bitmap: RasterBitmap, pad = 2): RasterBitmap | null {
  const rowBytes = rasterBytesPerRow(bitmap.width);
  const hasInk = (row: number) => {
    const end = (row + 1) * rowBytes;
    for (let i = row * rowBytes; i < end; i++) if (bitmap.data[i] !== 0) return true;
    return false;
  };
  let top = 0;
  while (top < bitmap.height && !hasInk(top)) top++;
  if (top >= bitmap.height) return null;
  let bottom = bitmap.height - 1;
  while (bottom > top && !hasInk(bottom)) bottom--;
  const from = Math.max(0, top - pad);
  const to = Math.min(bitmap.height - 1, bottom + pad);
  return {
    width: bitmap.width,
    height: to - from + 1,
    data: bitmap.data.slice(from * rowBytes, (to + 1) * rowBytes),
  };
}

// ---- Wrapping ----------------------------------------------------------------

type SegmenterLike = { segment(input: string): Iterable<{ segment: string }> };
type SegmenterCtor = new (
  locale?: string,
  options?: { granularity?: "grapheme" | "word" }
) => SegmenterLike;

function makeSegmenter(granularity: "grapheme" | "word", useIntl: boolean): SegmenterLike | null {
  if (!useIntl) return null;
  try {
    const ctor = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
    return ctor ? new ctor("th", { granularity }) : null;
  } catch {
    return null;
  }
}

// Built from a string: the project targets ES2017, where a `\\p{…}` regex LITERAL
// is a compile error, while every browser this runs in supports it at runtime.
// One code point, then any combining marks plus Thai/Lao SARA AM.
const GRAPHEME_FALLBACK = new RegExp("[\\s\\S][\\p{M}\\u0e33\\u0eb3]*", "gu");

/**
 * User-perceived characters. A Thai consonant carries its vowel and tone marks
 * (and SARA AM) with it: breaking between them prints a mark floating over
 * nothing. Without Intl.Segmenter the fallback keeps every combining mark with
 * the character before it, which covers Thai, Lao and accented Latin.
 */
export function splitGraphemes(text: string, useIntl = true): string[] {
  const segmenter = makeSegmenter("grapheme", useIntl);
  if (segmenter) return Array.from(segmenter.segment(text), (part) => part.segment);
  return text.match(GRAPHEME_FALLBACK) ?? [];
}

/** Closing punctuation never starts a line — it stays with the word before it. */
const CLOSING = /^[,.;:!?)\]}%»”’…ๆฯ]+$/;

/**
 * The places a line may break: words, the whitespace between them (kept as its
 * own segment), and nothing inside a word. Thai is written without spaces, so
 * the word boundaries come from Intl.Segmenter's dictionary; where that is
 * missing the only safe boundaries left are the spaces, and an over-long run is
 * later broken between graphemes instead.
 */
export function segmentForWrap(text: string, useIntl = true): string[] {
  const segmenter = makeSegmenter("word", useIntl);
  const raw = segmenter
    ? Array.from(segmenter.segment(text), (part) => part.segment)
    : (text.match(/\s+|\S+/g) ?? []);
  const out: string[] = [];
  for (const part of raw) {
    const previous = out[out.length - 1];
    if (previous !== undefined && !/^\s+$/.test(previous) && CLOSING.test(part)) {
      out[out.length - 1] = previous + part;
    } else {
      out.push(part);
    }
  }
  return out;
}

/**
 * Wraps `text` to `maxWidth` (in whatever unit `measure` returns — dots here).
 * Breaks between words first and between graphemes only for a word wider than
 * the line; a line never starts or ends with whitespace, and every line holds at
 * least one grapheme, so this always terminates.
 */
export function wrapMeasured(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
  useIntl = true
): string[] {
  const lines: string[] = [];
  let current = "";
  const flush = () => {
    const done = current.trimEnd();
    if (done) lines.push(done);
    current = "";
  };

  for (const segment of segmentForWrap(text, useIntl)) {
    const isSpace = /^\s+$/.test(segment);
    if (isSpace) {
      if (current) current += segment;
      continue;
    }
    if (measure((current + segment).trimEnd()) <= maxWidth) {
      current += segment;
      continue;
    }
    flush();
    if (measure(segment) <= maxWidth) {
      current = segment;
      continue;
    }
    // One word wider than the paper: break it between graphemes.
    for (const grapheme of splitGraphemes(segment, useIntl)) {
      if (current && measure(current + grapheme) > maxWidth) flush();
      current += grapheme;
    }
  }
  flush();
  return lines;
}

// ---- Layout ------------------------------------------------------------------

/** A piece of text and the dot column its left edge sits on. */
export interface RasterRun {
  text: string;
  x: number;
}

/**
 * Where everything in one request goes: an array of printed lines, each a list
 * of runs. Pure — `measure` is the only thing that knows about fonts.
 *
 *  - A single text is wrapped to the paper and aligned left or centred. Leading
 *    spaces become an indent in printer cells, applied to every wrapped line:
 *    on a receipt the indent IS the hierarchy ("  2x …" under its item).
 *  - A two-column row keeps both on one line when they fit with a cell between
 *    them. Otherwise it does what the text path does (createColumnRow): the
 *    label wrapped on its own line(s), the value right-aligned underneath.
 */
export function layoutRasterLine(
  request: Pick<RasterLineRequest, "text" | "right" | "align" | "widthScale">,
  widthDots: number,
  measure: (text: string) => number,
  useIntl = true
): RasterRun[][] {
  const cell = DOTS_PER_COLUMN * request.widthScale;
  const leading = request.text.length - request.text.trimStart().length;
  const body = request.text.trim();
  const centred = request.align === "center" && request.right === undefined;
  const indent = centred ? 0 : Math.min(leading * cell, Math.floor(widthDots / 2));
  const room = Math.max(cell, widthDots - indent);

  const place = (line: string): RasterRun => ({
    text: line,
    x: centred ? Math.max(0, Math.round((widthDots - measure(line)) / 2)) : indent,
  });
  const flushRight = (line: string): RasterRun => ({
    text: line,
    x: Math.max(0, Math.round(widthDots - measure(line))),
  });

  if (request.right === undefined) {
    return wrapMeasured(body, room, measure, useIntl).map((line) => [place(line)]);
  }

  const right = request.right.trim();
  if (!right) return wrapMeasured(body, room, measure, useIntl).map((line) => [place(line)]);
  const rightLines = wrapMeasured(right, widthDots, measure, useIntl);
  if (!body) return rightLines.map((line) => [flushRight(line)]);

  if (rightLines.length === 1 && indent + measure(body) + cell + measure(right) <= widthDots) {
    return [[place(body), flushRight(right)]];
  }
  return [
    ...wrapMeasured(body, room, measure, useIntl).map((line) => [place(line)]),
    ...rightLines.map((line) => [flushRight(line)]),
  ];
}
