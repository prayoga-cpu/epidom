// "Print non-Latin text as an image" — the browser half: draws one printed line
// on a canvas and hands back a 1-bit bitmap. Layout, wrapping, thresholding and
// the ESC/POS encoding are pure and live in escpos-raster.ts.
//
// System fonts only — nothing is fetched, so this works offline and adds no
// latency, but it also means the result depends on what the device has: Android
// ships Noto Sans Thai, Windows Leelawadee UI, macOS/iOS Thonburi. A device with
// no Thai font at all draws empty boxes, which cannot be detected from here;
// that is what the settings screen's test print is for.
//
// Never throws. Where there is no canvas (jsdom, an old WebView) the rasterizer
// reports itself unavailable and every builder prints text exactly as before.

import {
  layoutRasterLine,
  packMonoBitmap,
  printerDotWidth,
  trimBlankRows,
  type LineRasterizer,
  type RasterBitmap,
  type RasterLineRequest,
} from "@/lib/pwa/escpos-raster";

export const RASTER_FONT_STACK =
  '"Noto Sans Thai", "Sarabun", "Leelawadee UI", "Thonburi", sans-serif';

/**
 * Normal-size text. The printer's own Font A cell is 12 x 24 dots; Thai stacks a
 * vowel and a tone mark above the consonant and a vowel below it, so the line box
 * is taller than the glyph size (Noto Sans Thai needs about 1.5 em).
 */
const FONT_PX = 22;
const LINE_PX = 34;
const BASELINE_RATIO = 0.7;
/** A single request never legitimately needs more: it is one logical line. */
const MAX_LINES = 40;

type Context2D = Pick<
  CanvasRenderingContext2D,
  "fillRect" | "fillText" | "measureText" | "getImageData" | "setTransform"
> & { font: string; fillStyle: string | CanvasGradient | CanvasPattern; textBaseline: string };

function createContext(width: number, height: number): Context2D | null {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const context = new OffscreenCanvas(width, height).getContext("2d", {
        willReadFrequently: true,
      });
      if (context) return context as unknown as Context2D;
    }
    if (typeof document === "undefined") return null;
    // jsdom has a <canvas> element with no drawing behind it, and logs a
    // "not implemented" error on every getContext call — don't ask.
    if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent ?? "")) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    return context ? (context as unknown as Context2D) : null;
  } catch {
    return null;
  }
}

function fontFor(request: Pick<RasterLineRequest, "bold" | "widthScale">): string {
  return `${request.bold ? 700 : 400} ${FONT_PX * request.widthScale}px ${RASTER_FONT_STACK}`;
}

export function createCanvasLineRasterizer(): LineRasterizer {
  let available: boolean | null = null;
  let measuring: Context2D | null = null;

  const isAvailable = (): boolean => {
    if (available !== null) return available;
    try {
      const probe = createContext(8, 8);
      available =
        !!probe &&
        typeof probe.measureText === "function" &&
        typeof probe.getImageData === "function" &&
        typeof probe.fillText === "function";
      if (available) measuring = probe;
    } catch {
      available = false;
    }
    return available;
  };

  const render = (request: RasterLineRequest): RasterBitmap | null => {
    try {
      if (!isAvailable() || !measuring) return null;
      const widthDots = printerDotWidth(request.cols);
      const font = fontFor(request);
      const measurer = measuring;
      measurer.font = font;
      const measure = (text: string) => measurer.measureText(text).width;

      const lines = layoutRasterLine(request, widthDots, measure);
      if (lines.length === 0 || lines.length > MAX_LINES) return null;

      // Double height without double width ("tall" kitchen-ticket text) is the
      // normal-width glyph stretched vertically, as the printer itself does it.
      const stretch = request.heightScale / request.widthScale;
      const lineHeight = LINE_PX * request.widthScale;
      const height = Math.ceil(lines.length * lineHeight * stretch);
      const context = createContext(widthDots, height);
      if (!context) return null;

      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, widthDots, height);
      context.setTransform(1, 0, 0, stretch, 0, 0);
      context.fillStyle = "#000000";
      context.font = font;
      context.textBaseline = "alphabetic";
      lines.forEach((runs, index) => {
        const baseline = index * lineHeight + Math.round(lineHeight * BASELINE_RATIO);
        for (const run of runs) context.fillText(run.text, run.x, baseline);
      });

      const pixels = context.getImageData(0, 0, widthDots, height).data;
      return trimBlankRows(packMonoBitmap(pixels, widthDots, height));
    } catch {
      return null;
    }
  };

  return { isAvailable, render };
}

let shared: LineRasterizer | null = null;

/** The one canvas rasterizer for this page — its availability probe runs once. */
export function getCanvasLineRasterizer(): LineRasterizer {
  shared ??= createCanvasLineRasterizer();
  return shared;
}

/** Whether this device can draw text for the printer at all. */
export function isRasterPrintingAvailable(): boolean {
  try {
    return getCanvasLineRasterizer().isAvailable();
  } catch {
    return false;
  }
}
