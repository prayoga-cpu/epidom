/**
 * Item labels — one sticker per unit, in ESC/POS or TSPL.
 *
 * NOTE: nothing here can prove a label lines up on a physical printer; these pin
 * the parts that are decidable in software (one label per unit, the command
 * grammar, never sending an out-of-range size, never silently dropping a note).
 */
import { describe, it, expect } from "vitest";
import {
  LABEL_SIZE_LIMITS,
  buildItemLabelEscPos,
  buildItemLabelTspl,
  clampMm,
  type ItemLabelData,
} from "../item-label";

const decode = (bytes: Uint8Array): string => String.fromCharCode(...bytes);

const LABEL: ItemLabelData = {
  headline: "#12",
  itemName: "Iced Latte",
  optionNames: ["Oat milk", "Less ice"],
  notes: "No straw",
  index: 1,
  count: 2,
  footer: "A3 18:35",
};

const SIZE = { widthMm: 40, heightMm: 30, gapMm: 2 };

describe("clampMm", () => {
  it("keeps a value inside the range a label printer can plausibly take", () => {
    expect(clampMm(40, LABEL_SIZE_LIMITS.widthMm)).toBe(40);
    expect(clampMm(5, LABEL_SIZE_LIMITS.widthMm)).toBe(LABEL_SIZE_LIMITS.widthMm.min);
    expect(clampMm(999, LABEL_SIZE_LIMITS.widthMm)).toBe(LABEL_SIZE_LIMITS.widthMm.max);
    expect(clampMm(39.6, LABEL_SIZE_LIMITS.widthMm)).toBe(40);
  });

  it("falls to the minimum for anything that is not a number", () => {
    expect(clampMm(NaN, LABEL_SIZE_LIMITS.gapMm)).toBe(LABEL_SIZE_LIMITS.gapMm.min);
    expect(clampMm(Infinity, LABEL_SIZE_LIMITS.gapMm)).toBe(LABEL_SIZE_LIMITS.gapMm.min);
  });
});

describe("buildItemLabelEscPos", () => {
  it("prints the headline, name, options, note and counter of a label", () => {
    const out = decode(buildItemLabelEscPos([LABEL], 32));
    expect(out).toContain("#12");
    expect(out).toContain("Iced Latte");
    expect(out).toContain("Oat milk, Less ice");
    expect(out).toContain("* No straw");
    expect(out).toContain("1/2 A3 18:35");
  });

  it("ends every label with a form feed so a label-mode printer advances to the next sticker", () => {
    const bytes = buildItemLabelEscPos([LABEL, { ...LABEL, index: 2 }], 32);
    expect([...bytes].filter((b) => b === 0x0c)).toHaveLength(2);
  });

  it("never sends a cut command — a sticker roll must not be guillotined", () => {
    const out = decode(buildItemLabelEscPos([LABEL], 32));
    expect(out).not.toContain("\x1dV");
  });

  it("emits only ASCII", () => {
    const bytes = buildItemLabelEscPos([{ ...LABEL, itemName: "Crème brûlée ♥" }], 32);
    for (const byte of bytes) expect(byte).toBeLessThan(128);
  });
});

describe("buildItemLabelTspl", () => {
  const tspl = (labels: ItemLabelData[], size = SIZE) =>
    new TextDecoder().decode(buildItemLabelTspl(labels, size));

  it("sets the sticker size, gap and direction once, then draws each label", () => {
    const out = tspl([LABEL, { ...LABEL, index: 2 }]);
    const lines = out.split("\r\n");
    expect(lines[0]).toBe("SIZE 40 mm,30 mm");
    expect(lines[1]).toBe("GAP 2 mm,0 mm");
    expect(lines[2]).toBe("DIRECTION 1");
    expect(out.match(/^SIZE /gm)).toHaveLength(1);
    expect(out.match(/^CLS$/gm)).toHaveLength(2);
    expect(out.match(/^PRINT 1,1$/gm)).toHaveLength(2);
  });

  it("terminates every command with CRLF", () => {
    const out = tspl([LABEL]);
    expect(out.endsWith("\r\n")).toBe(true);
    expect(out.replace(/\r\n/g, "").includes("\n")).toBe(false);
  });

  it("draws the headline, name, options, note and counter as TEXT commands", () => {
    const out = tspl([LABEL]);
    expect(out).toContain('"#12"');
    expect(out).toContain('"Iced Latte"');
    expect(out).toContain('"Oat milk, Less ice"');
    expect(out).toContain('"* No straw"');
    expect(out).toContain('"1/2 A3 18:35"');
  });

  it("clamps an out-of-range size instead of sending it to the printer", () => {
    const out = tspl([LABEL], { widthMm: 999, heightMm: 1, gapMm: 99 });
    expect(out).toContain(
      `SIZE ${LABEL_SIZE_LIMITS.widthMm.max} mm,${LABEL_SIZE_LIMITS.heightMm.min} mm`
    );
    expect(out).toContain(`GAP ${LABEL_SIZE_LIMITS.gapMm.max} mm,0 mm`);
  });

  it("cannot break out of a TSPL string with a quote or a backslash", () => {
    const out = tspl([{ ...LABEL, itemName: 'The "Big" \\ One' }]);
    expect(out).toContain(`"The 'Big' / One"`);
    // Every TEXT command still has exactly its four delimiting quotes' worth: 2.
    for (const line of out.split("\r\n").filter((l) => l.startsWith("TEXT"))) {
      expect(line.match(/"/g)?.length).toBe(4);
    }
  });

  it("emits only ASCII", () => {
    const bytes = buildItemLabelTspl([{ ...LABEL, itemName: "Crème brûlée ♥" }], SIZE);
    for (const byte of bytes) expect(byte).toBeLessThan(128);
  });

  it("says so when the sticker runs out of room, instead of silently dropping the tail", () => {
    const out = tspl(
      [
        {
          ...LABEL,
          itemName: "Cream Cheese Honey Chilli Sourdough Toastie",
          notes: "allergy to peanuts sesame and shellfish please separate everything",
        },
      ],
      { widthMm: 40, heightMm: 20, gapMm: 2 }
    );
    expect(out).toContain('..."');
  });

  it("keeps the counter on the label even when the body overflows", () => {
    const out = tspl(
      [
        {
          ...LABEL,
          notes: "a very long note that needs many lines on such a small sticker indeed",
        },
      ],
      { widthMm: 40, heightMm: 20, gapMm: 2 }
    );
    expect(out).toContain('"1/2 A3 18:35"');
  });
});
