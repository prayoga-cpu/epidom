import { describe, it, expect } from "vitest";
import {
  EMPTY_CUSTOMER_DISPLAY_SNAPSHOT,
  buildCustomerDisplayBuildingSnapshot,
  firstNameOf,
  isPlausibleEmail,
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

describe("toCustomerDisplayLines — custom lines", () => {
  const customLine: CartItem = {
    id: "custom-1",
    menuItemId: null,
    isCustom: true,
    name: "Delivery fee",
    unitPrice: 4,
    quantity: 2,
    modifiers: [],
    lineTotal: 8,
    department: null,
    notes: "leave at door",
  };

  it("shows a Custom Item (no menu item behind it) like any other charge", () => {
    expect(toCustomerDisplayLines([customLine])).toEqual([
      {
        id: "custom-1",
        name: "Delivery fee",
        quantity: 2,
        lineTotal: 8,
        modifiers: [],
        notes: "leave at door",
      },
    ]);
  });

  it("does not depend on menuItemId — null, empty or set all map the same", () => {
    const [a, b, c] = [null, "", "m1"].map(
      (menuItemId) => toCustomerDisplayLines([{ ...customLine, menuItemId }])[0]
    );
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("tolerates a line whose modifiers are missing (a stale persisted cart)", () => {
    const lines = toCustomerDisplayLines([{ ...customLine, modifiers: undefined as any }]);
    expect(lines[0].modifiers).toEqual([]);
  });

  it("keeps a custom line as a genuinely new highlight when it is added", () => {
    const before = toCustomerDisplayLines([]);
    const after = toCustomerDisplayLines([customLine]);
    expect(resolveHighlight(before, after, null)).toEqual({ id: "custom-1", isNew: true });
  });
});

describe("buildCustomerDisplayBuildingSnapshot", () => {
  const totals = {
    subtotal: 80,
    tax: 8,
    serviceCharge: 0,
    discountAmount: 30,
    discountReason: "Member + 100 pts",
    pointsRedeemed: 100,
    pointsDiscountAmount: 10,
    total: 88,
  };

  it("is 'building' with lines, 'idle' without", () => {
    const withLines = buildCustomerDisplayBuildingSnapshot({
      lines: [line("a")],
      highlight: { id: "a", isNew: true },
      totals,
      updatedAt: 5,
    });
    expect(withLines).toMatchObject({
      phase: "building",
      highlightLineId: "a",
      highlightIsNew: true,
    });

    const empty = buildCustomerDisplayBuildingSnapshot({
      lines: [],
      highlight: null,
      totals: { ...totals, discountAmount: 0, pointsRedeemed: 0, pointsDiscountAmount: 0 },
      updatedAt: 5,
    });
    expect(empty).toMatchObject({ phase: "idle", highlightLineId: null, highlightIsNew: false });
  });

  it("carries the discount and the points as separate lines' worth of data", () => {
    const snapshot = buildCustomerDisplayBuildingSnapshot({
      lines: [line("a")],
      highlight: null,
      totals,
      updatedAt: 5,
    });
    // discountAmount stays the TOTAL (primary + points value), so a display that
    // only knows the old fields still shows a correct line.
    expect(snapshot.discountAmount).toBe(30);
    expect(snapshot.discountReason).toBe("Member + 100 pts");
    expect(snapshot.pointsRedeemed).toBe(100);
    expect(snapshot.pointsDiscountAmount).toBe(10);
    expect(snapshot.total).toBe(88);
  });

  it("keeps EVERY field of the snapshot shape other windows consume", () => {
    const snapshot = buildCustomerDisplayBuildingSnapshot({
      lines: [line("a")],
      highlight: null,
      totals,
      updatedAt: 5,
    });
    expect(Object.keys(snapshot).sort()).toEqual(
      Object.keys(EMPTY_CUSTOMER_DISPLAY_SNAPSHOT).sort()
    );
  });

  it("survives the localStorage round trip", () => {
    const snapshot = buildCustomerDisplayBuildingSnapshot({
      lines: [line("a")],
      highlight: { id: "a", isNew: false },
      totals,
      updatedAt: 42,
    });
    expect(parseCustomerDisplaySnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

describe("the snapshot shape across releases", () => {
  it("an older snapshot (no points fields) parses with zeros for them", () => {
    const parsed = parseCustomerDisplaySnapshot(
      JSON.stringify({
        phase: "building",
        lines: [line("a")],
        discountAmount: 10,
        discountReason: "Member",
        updatedAt: 9,
      })
    );
    expect(parsed).toMatchObject({
      discountAmount: 10,
      discountReason: "Member",
      pointsRedeemed: 0,
      pointsDiscountAmount: 0,
    });
  });

  it("an older display window reading a NEW snapshot still finds every field it knows", () => {
    const fresh = buildCustomerDisplayBuildingSnapshot({
      lines: [line("a")],
      highlight: null,
      totals: {
        subtotal: 1,
        tax: 0,
        serviceCharge: 0,
        discountAmount: 0,
        discountReason: null,
        pointsRedeemed: 0,
        pointsDiscountAmount: 0,
        total: 1,
      },
      updatedAt: 1,
    });
    for (const key of [
      "phase",
      "lines",
      "highlightLineId",
      "highlightIsNew",
      "subtotal",
      "tax",
      "serviceCharge",
      "discountAmount",
      "discountReason",
      "total",
      "paidOrderNumber",
      "updatedAt",
    ]) {
      expect(fresh).toHaveProperty(key);
    }
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

describe("firstNameOf — the only part of a customer the display is trusted with", () => {
  it("takes the first word of a name", () => {
    expect(firstNameOf("Alice Martin")).toBe("Alice");
    expect(firstNameOf("  Anne-Marie   Dupont ")).toBe("Anne-Marie");
    expect(firstNameOf("Cher")).toBe("Cher");
  });

  it("is null when there is no real name to greet", () => {
    expect(firstNameOf(null)).toBeNull();
    expect(firstNameOf("")).toBeNull();
    expect(firstNameOf("   ")).toBeNull();
  });

  it("is null for a record named after the customer's own number", () => {
    // A customer created from a phone alone is named after it: greeting them as
    // "+33612345678" would read the number back at whoever is standing there.
    expect(firstNameOf("+33612345678", "+33612345678")).toBeNull();
    expect(firstNameOf("+33 6 12 34 56 78")).toBeNull();
    expect(firstNameOf("06.12.34.56.78")).toBeNull();
  });
});

describe("isPlausibleEmail — what the display will send to the till", () => {
  it("accepts an ordinary address", () => {
    expect(isPlausibleEmail("claire@example.com")).toBe(true);
    expect(isPlausibleEmail("c.m+shop@mail.example.co.uk")).toBe(true);
  });

  it("holds back anything unfinished or malformed", () => {
    for (const bad of [
      "",
      "claire",
      "claire@",
      "claire@mail",
      "claire@mail.",
      "@mail.com",
      "a b@c.com",
    ]) {
      expect(isPlausibleEmail(bad), bad).toBe(false);
    }
  });

  it("holds back an address longer than the server accepts", () => {
    expect(isPlausibleEmail(`${"a".repeat(250)}@b.com`)).toBe(false);
  });
});

describe("the intake messages", () => {
  it("the details and status messages are part of the channel contract", () => {
    const messages: CustomerDisplayMessage[] = [
      { type: "customer-details", name: "Claire", email: "claire@example.com" },
      {
        type: "customer-status",
        status: { phone: "+33612345678", match: "existing", firstName: "Claire" },
      },
    ];
    expect(messages.map((m) => m.type)).toEqual(["customer-details", "customer-status"]);
  });
});
