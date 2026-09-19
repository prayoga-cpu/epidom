// Item labels — one sticker per unit ordered, for cups and packaging.
//
// A label printer is a different animal from a receipt printer: it prints onto
// pre-cut stickers and finds the start of the next one from a gap (or black
// mark) sensor, and the popular models speak one of two command languages:
//
//   ESC/POS  what the receipt/ticket printers speak; a 58mm sticker printer, or
//            any label printer in its ESC/POS emulation mode, takes it as-is.
//   TSPL     the native language of dedicated label printers (Xprinter
//            XP-365B/420B, TSC-style). Needs the physical label size and gap.
//
// Which one is a per-printer setting. NEITHER has been driven against real label
// hardware from this codebase — the ESC/POS form-feed and the TSPL gap/size
// handling are the parts to check on a physical printer first.

import { printBytes } from "@/lib/pwa/printer-connection";
import { createEscPosWriter, toPrinterAscii, wrapText } from "@/lib/pwa/thermal-printer";

export type LabelLanguage = "ESCPOS" | "TSPL";

export interface ItemLabelData {
  /** The big line: the call-out number ("#12"), or the order's tail when it has none. */
  headline: string;
  itemName: string;
  optionNames?: string[];
  notes?: string;
  /** This unit's position within the line's quantity — 2 of 3 prints "2/3". */
  index: number;
  count: number;
  /** Small trailing text beside the counter (time, table, customer). */
  footer?: string;
}

export interface LabelPrinterConfig {
  language: LabelLanguage;
  /** ESC/POS only — characters per line (32 = 58mm, 48 = 80mm). */
  paperWidth: 32 | 48;
  /** TSPL only — physical sticker size and the gap between stickers, in mm. */
  widthMm: number;
  heightMm: number;
  gapMm: number;
}

/** What a TSPL printer can plausibly be told. Out-of-range input is clamped, never sent. */
export const LABEL_SIZE_LIMITS = {
  widthMm: { min: 20, max: 110 },
  heightMm: { min: 15, max: 200 },
  gapMm: { min: 0, max: 10 },
} as const;

export function clampMm(value: number, limits: { min: number; max: number }): number {
  if (!Number.isFinite(value)) return limits.min;
  return Math.min(limits.max, Math.max(limits.min, Math.round(value)));
}

const FORM_FEED = 0x0c;

/**
 * ESC/POS labels: headline, name, options, notes, counter — then a form feed so
 * a printer in label mode advances to the start of the next sticker (a plain
 * receipt printer ignores it). No cut: printItemLabels() sends none.
 */
export function buildItemLabelEscPos(labels: ItemLabelData[], cols: 32 | 48): Uint8Array {
  const w = createEscPosWriter();
  const { line, lines, blank, bold, center, left, doubleSize } = w;
  const bigCols = Math.max(1, Math.floor(cols / 2));

  w.init();
  for (const label of labels) {
    center();
    doubleSize(true);
    lines(wrapText(label.headline, bigCols));
    doubleSize(false);
    left();
    bold(true);
    lines(wrapText(label.itemName, cols));
    bold(false);
    const options = (label.optionNames ?? []).filter(Boolean);
    if (options.length > 0) lines(wrapText(options.join(", "), cols));
    if (label.notes) lines(wrapText(`* ${label.notes}`, cols));
    lines(wrapText(counterLine(label), cols));
    blank(1);
    w.push(FORM_FEED);
  }
  return w.bytes();
}

function counterLine(label: ItemLabelData): string {
  return label.footer
    ? `${label.index}/${label.count} ${label.footer}`
    : `${label.index}/${label.count}`;
}

// ---- TSPL ------------------------------------------------------------------

/** 203 dpi — the near-universal resolution of small label printers. A 300 dpi one just prints it smaller. */
const DOTS_PER_MM = 8;
const MARGIN_DOTS = 8;
/** TSPL's built-in font "3": 16 x 24 dots per character. */
const FONT = "3";
const CHAR_W = 16;
const CHAR_H = 24;
const LINE_H = CHAR_H + 4;
const HEADLINE_SCALE = 2;
const HEADLINE_H = CHAR_H * HEADLINE_SCALE + 6;

/** TSPL string literals end at a double quote, and backslash escapes — neither can be printed raw. */
function tsplText(value: string): string {
  return toPrinterAscii(value).replace(/"/g, "'").replace(/\\/g, "/");
}

/**
 * Keeps the first `max` lines; when there were more, the last kept one ends in
 * "..." so a sticker that ran out of room says so instead of silently dropping
 * the tail (which is where an allergy note would be).
 */
function fitLines(all: string[], max: number, cols: number): string[] {
  if (max <= 0) return [];
  if (all.length <= max) return all;
  const kept = all.slice(0, max);
  kept[max - 1] = `${kept[max - 1].slice(0, Math.max(0, cols - 3)).trimEnd()}...`;
  return kept;
}

export function buildItemLabelTspl(
  labels: ItemLabelData[],
  size: Pick<LabelPrinterConfig, "widthMm" | "heightMm" | "gapMm">
): Uint8Array {
  const widthMm = clampMm(size.widthMm, LABEL_SIZE_LIMITS.widthMm);
  const heightMm = clampMm(size.heightMm, LABEL_SIZE_LIMITS.heightMm);
  const gapMm = clampMm(size.gapMm, LABEL_SIZE_LIMITS.gapMm);
  const heightDots = heightMm * DOTS_PER_MM;
  const usable = widthMm * DOTS_PER_MM - MARGIN_DOTS * 2;
  const bodyCols = Math.max(1, Math.floor(usable / CHAR_W));
  const headCols = Math.max(1, Math.floor(usable / (CHAR_W * HEADLINE_SCALE)));
  const footerY = heightDots - MARGIN_DOTS - CHAR_H;

  const out: string[] = [
    `SIZE ${widthMm} mm,${heightMm} mm`,
    `GAP ${gapMm} mm,0 mm`,
    "DIRECTION 1",
  ];
  const text = (y: number, scale: number, value: string) =>
    out.push(`TEXT ${MARGIN_DOTS},${y},"${FONT}",0,${scale},${scale},"${tsplText(value)}"`);

  for (const label of labels) {
    out.push("CLS");
    let y = MARGIN_DOTS;
    text(y, HEADLINE_SCALE, wrapText(label.headline, headCols)[0] ?? "");
    y += HEADLINE_H;

    const options = (label.optionNames ?? []).filter(Boolean);
    const body = [
      ...wrapText(label.itemName, bodyCols),
      ...(options.length > 0 ? wrapText(options.join(", "), bodyCols) : []),
      ...(label.notes ? wrapText(`* ${label.notes}`, bodyCols) : []),
    ];
    const room = Math.floor((footerY - y) / LINE_H);
    for (const row of fitLines(body, room, bodyCols)) {
      text(y, 1, row);
      y += LINE_H;
    }

    text(footerY, 1, wrapText(counterLine(label), bodyCols)[0] ?? "");
    out.push("PRINT 1,1");
  }

  const source = `${out.join("\r\n")}\r\n`;
  const bytes = new Uint8Array(source.length);
  for (let i = 0; i < source.length; i++) bytes[i] = source.charCodeAt(i) & 0xff;
  return bytes;
}

/**
 * Prints the labels on the LABEL printer in its configured language. No cut
 * command: a sticker roll must not be guillotined, and TSPL has its own.
 */
export async function printItemLabels(
  labels: ItemLabelData[],
  config: LabelPrinterConfig
): Promise<void> {
  if (labels.length === 0) return;
  const bytes =
    config.language === "TSPL"
      ? buildItemLabelTspl(labels, config)
      : buildItemLabelEscPos(labels, config.paperWidth);
  await printBytes("LABEL", bytes, { cut: false });
}

/** A fake sticker, for the settings screen's "Test print". */
export function buildSampleItemLabel(now: Date = new Date()): ItemLabelData {
  return {
    headline: "#12",
    itemName: "Iced Latte",
    optionNames: ["Oat milk", "Less ice"],
    notes: "No straw",
    index: 1,
    count: 2,
    footer: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
  };
}
