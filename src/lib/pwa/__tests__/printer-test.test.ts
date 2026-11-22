/**
 * The settings screen's "Test print", with and without a printer's
 * "print non-Latin text as an image" switch.
 *
 * The test page is how an owner finds out — on paper, the only place it can be
 * found out — whether their device has a Thai font and their printer takes the
 * image. So with the switch on it must carry a Thai line and an accented line;
 * with it off (or on a device that cannot draw) it must be the page it always was.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LineRasterizer, RasterLineRequest } from "../escpos-raster";

const link = vi.hoisted(() => ({
  printBytes: vi.fn(),
  isPrinterConnected: vi.fn(),
}));
vi.mock("@/lib/pwa/printer-connection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pwa/printer-connection")>()),
  ...link,
}));

const canvas = vi.hoisted(() => ({
  available: false,
  requests: [] as unknown[],
}));
vi.mock("@/lib/pwa/text-raster", () => {
  const rasterizer = {
    isAvailable: () => canvas.available,
    render: (request: { cols: number }) => {
      canvas.requests.push(request);
      const width = request.cols * 12;
      return { width, height: 2, data: new Uint8Array((width / 8) * 2).fill(0xff) };
    },
  };
  return {
    getCanvasLineRasterizer: () => rasterizer satisfies LineRasterizer,
    isRasterPrintingAvailable: () => canvas.available,
  };
});

import { RASTER_TEST_LINES, printTestPage, type TestPrintOptions } from "../printer-test";

const OPTIONS: TestPrintOptions = {
  locale: "th",
  currency: "THB",
  width: 32,
  label: { language: "ESCPOS", paperWidth: 32, widthMm: 40, heightMm: 30, gapMm: 2 },
};

const requests = () => canvas.requests as RasterLineRequest[];
const texts = () => requests().map((request) => request.text);
const sent = (call = 0): Uint8Array => link.printBytes.mock.calls[call][1];
const hasImage = (bytes: Uint8Array) =>
  bytes.some((byte, i) => byte === 0x1d && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x30);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-22T03:00:00Z"));
  canvas.available = true;
  canvas.requests.length = 0;
  link.printBytes.mockResolvedValue(undefined);
  link.isPrinterConnected.mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the sample lines", () => {
  it("are one Thai line and one accented Latin line", () => {
    expect(RASTER_TEST_LINES).toHaveLength(2);
    expect(RASTER_TEST_LINES[0]).toMatch(/[\u0e00-\u0e7f]/);
    expect(RASTER_TEST_LINES[1]).toMatch(/[éèàñ]/);
    expect(RASTER_TEST_LINES[1]).not.toMatch(/[\u0e00-\u0e7f]/);
  });
});

describe("printTestPage — switch off", () => {
  it.each(["MAIN", "KITCHEN", "BAR", "LABEL"] as const)("%s prints text only", async (role) => {
    await printTestPage(role, OPTIONS);
    expect(link.printBytes).toHaveBeenCalledTimes(1);
    expect(hasImage(sent())).toBe(false);
    expect(sent().every((byte) => byte <= 0x7f)).toBe(true);
    expect(requests()).toHaveLength(0);
  });

  it.each(["MAIN", "KITCHEN", "LABEL"] as const)(
    "%s prints that same page when the switch is on but the device cannot draw",
    async (role) => {
      await printTestPage(role, OPTIONS);
      canvas.available = false;
      await printTestPage(role, { ...OPTIONS, rasterNonAscii: true });
      expect(sent(1)).toEqual(sent(0));
      expect(requests()).toHaveLength(0);
    }
  );
});

describe("printTestPage — switch on", () => {
  const ON: TestPrintOptions = { ...OPTIONS, rasterNonAscii: true };

  it("adds the Thai and the accented line to the sample receipt, as images", async () => {
    await printTestPage("MAIN", ON);
    expect(hasImage(sent())).toBe(true);
    expect(texts().some((text) => text.endsWith(RASTER_TEST_LINES[0]))).toBe(true);
    expect(texts()).toContain(RASTER_TEST_LINES[1]);
  });

  it("prints a Thai store's test page with its Thai title", async () => {
    await printTestPage("MAIN", ON);
    expect(requests().find((request) => request.widthScale === 2)?.text).toMatch(/[\u0e00-\u0e7f]/);
  });

  it("adds them to a kitchen or bar test ticket, on that printer", async () => {
    await printTestPage("BAR", { ...ON, width: 48 });
    expect(link.printBytes.mock.calls[0][0]).toBe("BAR");
    expect(hasImage(sent())).toBe(true);
    expect(requests().every((request) => request.cols === 48)).toBe(true);
    expect(texts().some((text) => text.endsWith(RASTER_TEST_LINES[0]))).toBe(true);
    expect(texts().some((text) => text.endsWith(RASTER_TEST_LINES[1]))).toBe(true);
  });

  it("puts them on an ESC/POS test sticker", async () => {
    await printTestPage("LABEL", ON);
    expect(link.printBytes.mock.calls[0][0]).toBe("LABEL");
    expect(texts()).toContain(RASTER_TEST_LINES[0]);
    expect(texts()).toContain(`* ${RASTER_TEST_LINES[1]}`);
  });

  it("leaves a TSPL test sticker as text — TSPL is not covered", async () => {
    const tspl = { ...OPTIONS.label, language: "TSPL" as const };
    await printTestPage("LABEL", { ...OPTIONS, label: tspl });
    await printTestPage("LABEL", { ...ON, label: tspl });
    expect(sent(1)).toEqual(sent(0));
    expect(requests()).toHaveLength(0);
  });
});
