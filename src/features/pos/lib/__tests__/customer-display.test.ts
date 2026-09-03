import { describe, it, expect } from "vitest";
import {
  EMPTY_CUSTOMER_DISPLAY_SNAPSHOT,
  parseCustomerDisplaySnapshot,
  resolveHighlight,
  toCustomerDisplayLines,
  type CustomerDisplayLine,
  type CustomerDisplayMessage,
} from "../customer-display";
import type { CartItem } from "../../types/pos.types";
import { getContrastingInk, getLuminance } from "@/lib/utils/color";

function line(id: string, quantity = 1): CustomerDisplayLine {
  return { id, name: `Item ${id}`, quantity, lineTotal: quantity * 1000, modifiers: [] };
}

describe("toCustomerDisplayLines", () => {
  it("flattens modifiers down to their option names", () => {
    const items: CartItem[] = [
      {
        id: "line-1",
        menuItemId: "menu-1",
        name: "Kopi Susu",
        unitPrice: 18000,
        quantity: 2,
        modifiers: [
          { groupName: "Sugar", optionName: "Less sugar", priceAdjustment: 0 },
          { groupName: "Size", optionName: "Large", priceAdjustment: 5000 },
        ],
        notes: "no ice",
        lineTotal: 46000,
      },
    ];

    expect(toCustomerDisplayLines(items)).toEqual([
      {
        id: "line-1",
        name: "Kopi Susu",
        quantity: 2,
        lineTotal: 46000,
        modifiers: ["Less sugar", "Large"],
        notes: "no ice",
      },
    ]);
  });
});

const NEW = (id: string) => ({ id, isNew: true });
const FALLBACK = (id: string) => ({ id, isNew: false });

describe("resolveHighlight", () => {
  it("features a brand-new line, as genuinely new", () => {
    expect(resolveHighlight([line("a")], [line("a"), line("b")], NEW("a"))).toEqual(NEW("b"));
  });

  it("features the last of several lines added at once", () => {
    // A resumed held order hydrates the whole cart in one update.
    expect(resolveHighlight([], [line("a"), line("b"), line("c")], null)).toEqual(NEW("c"));
  });

  it("features a line whose quantity was just increased", () => {
    expect(resolveHighlight([line("a"), line("b")], [line("a"), line("b", 2)], NEW("a"))).toEqual(
      NEW("b")
    );
  });

  it("prefers a brand-new line over a bumped one in the same update", () => {
    expect(resolveHighlight([line("a")], [line("a", 3), line("b")], NEW("a"))).toEqual(NEW("b"));
  });

  it("keeps the current highlight, and its isNew, when nothing grew", () => {
    // Removing an unrelated line must not make the display jump, nor
    // re-announce a line as freshly added.
    expect(
      resolveHighlight([line("a"), line("b"), line("c")], [line("a"), line("b")], FALLBACK("b"))
    ).toEqual(FALLBACK("b"));
  });

  it("falls back to the last line, NOT as new, when the highlighted one was removed", () => {
    expect(resolveHighlight([line("a"), line("b")], [line("a")], NEW("b"))).toEqual(FALLBACK("a"));
  });

  it("never claims 'just added' for a cart it did not watch being built", () => {
    // Switching the display on over an existing cart: the baseline matches, so
    // nothing reads as added and the eyebrow must stay off.
    const cart = [line("a"), line("b")];
    expect(resolveHighlight(cart, cart, null)).toEqual(FALLBACK("b"));
  });

  it("returns null for an empty cart", () => {
    expect(resolveHighlight([line("a")], [], NEW("a"))).toBeNull();
  });

  it("does not treat a quantity decrease as a new highlight", () => {
    expect(
      resolveHighlight([line("a"), line("b", 5)], [line("a"), line("b", 2)], NEW("a"))
    ).toEqual(NEW("a"));
  });
});

describe("parseCustomerDisplaySnapshot", () => {
  it("fills in missing fields from a snapshot written by an older release", () => {
    const parsed = parseCustomerDisplaySnapshot(
      JSON.stringify({ phase: "building", lines: [line("a")], updatedAt: 123 })
    );
    expect(parsed).toMatchObject({ phase: "building", updatedAt: 123, tax: 0, total: 0 });
  });

  it("rejects anything that isn't a snapshot", () => {
    expect(parseCustomerDisplaySnapshot(null)).toBeNull();
    expect(parseCustomerDisplaySnapshot("")).toBeNull();
    expect(parseCustomerDisplaySnapshot("{not json")).toBeNull();
    expect(parseCustomerDisplaySnapshot(JSON.stringify({ lines: [] }))).toBeNull();
    expect(parseCustomerDisplaySnapshot(JSON.stringify({ updatedAt: 1 }))).toBeNull();
  });

  it("starts idle with a zero timestamp, so any real snapshot wins the monotonic guard", () => {
    expect(EMPTY_CUSTOMER_DISPLAY_SNAPSHOT.updatedAt).toBe(0);
    expect(EMPTY_CUSTOMER_DISPLAY_SNAPSHOT.phase).toBe("idle");
    expect(EMPTY_CUSTOMER_DISPLAY_SNAPSHOT.highlightIsNew).toBe(false);
  });
});

describe("getContrastingInk", () => {
  it("puts white ink on a dark brand color", () => {
    expect(getContrastingInk("#122C4F")).toBe("#FFFFFF");
    expect(getContrastingInk("#FF6B35")).toBe("#FFFFFF");
  });

  it("puts dark ink on a pale brand color", () => {
    // getPremiumTheme allows lightness up to 85%, so this is reachable.
    expect(getContrastingInk("#FFE9A8")).toBe("#141210");
    expect(getContrastingInk("#FFFFFF")).toBe("#141210");
  });

  it("expands 3-digit hex and treats an unparseable color as dark", () => {
    expect(getContrastingInk("#fff")).toBe("#141210");
    expect(getLuminance("not-a-color")).toBe(0);
    expect(getContrastingInk("not-a-color")).toBe("#FFFFFF");
  });
});

describe("customer-phone message", () => {
  it("is a valid CustomerDisplayMessage the cashier can narrow on", () => {
    // The one message that travels display -> cashier. Typed as a union member
    // so a handler that forgets it fails to compile rather than silently
    // dropping the customer's number.
    const withNumber: CustomerDisplayMessage = { type: "customer-phone", phone: "+6281234567890" };
    const cleared: CustomerDisplayMessage = { type: "customer-phone", phone: null };

    expect(withNumber.type).toBe("customer-phone");
    expect(cleared.phone).toBeNull();
  });

  it("is distinguishable from the two cashier -> display messages", () => {
    const messages: CustomerDisplayMessage[] = [
      { type: "request" },
      { type: "state", snapshot: EMPTY_CUSTOMER_DISPLAY_SNAPSHOT },
      { type: "customer-phone", phone: "+33612345678" },
    ];
    // Mirrors the publisher's own dispatch: anything not request/customer-phone
    // must not be mistaken for one.
    expect(messages.filter((m) => m.type === "customer-phone")).toHaveLength(1);
    expect(messages.filter((m) => m.type === "state")).toHaveLength(1);
    expect(messages.filter((m) => m.type === "request")).toHaveLength(1);
  });
});
