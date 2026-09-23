/**
 * Which line prints where. This is the logic that decides whether the bar ever
 * hears about a drink, so every routing branch is pinned.
 */
import { describe, expect, it } from "vitest";
import {
  cartLineToPrepLine,
  indexMenuDepartments,
  isEmptyPlan,
  planOrderPrint,
  type OrderPrintContext,
  type OrderPrintRoles,
  type PrepLine,
} from "../print-plan";
import type { CartItem } from "../../types/pos.types";

const MENU = indexMenuDepartments([
  {
    items: [
      { id: "m-bread", department: "KITCHEN" },
      { id: "m-latte", department: "BAR" },
      { id: "m-haircut", department: "CUSTOM" },
    ],
  },
]);

const cartItem = (over: Partial<CartItem> = {}): CartItem => ({
  id: "line-1",
  menuItemId: "m-bread",
  name: "Salt Bread",
  unitPrice: 25000,
  quantity: 1,
  modifiers: [],
  lineTotal: 25000,
  ...over,
});

describe("cartLineToPrepLine", () => {
  it("sends a BAR menu item to the bar and a KITCHEN one to the kitchen", () => {
    expect(cartLineToPrepLine(cartItem({ menuItemId: "m-latte" }), MENU).department).toBe("BAR");
    expect(cartLineToPrepLine(cartItem({ menuItemId: "m-bread" }), MENU).department).toBe(
      "KITCHEN"
    );
  });

  it("gives the optional second product line (the CUSTOM sentinel) no prep area at all", () => {
    expect(cartLineToPrepLine(cartItem({ menuItemId: "m-haircut" }), MENU).department).toBeNull();
  });

  it("falls back to the kitchen — the KDS's own default — for a menu item missing from the cache", () => {
    expect(cartLineToPrepLine(cartItem({ menuItemId: "m-unknown" }), MENU).department).toBe(
      "KITCHEN"
    );
  });

  it("reads a Custom Item's own prep area, and treats none as 'nothing to make'", () => {
    const custom = (department: "KITCHEN" | "BAR" | null) =>
      cartLineToPrepLine(
        cartItem({ menuItemId: null, isCustom: true, department, name: "Corkage" }),
        MENU
      ).department;
    expect(custom("BAR")).toBe("BAR");
    expect(custom("KITCHEN")).toBe("KITCHEN");
    expect(custom(null)).toBeNull();
  });

  it("carries the modifiers and the note, and no price", () => {
    const line = cartLineToPrepLine(
      cartItem({
        modifiers: [
          { groupName: "Milk", optionName: "Oat milk", priceAdjustment: 5000 },
          { groupName: "Ice", optionName: "Less ice", priceAdjustment: 0 },
        ],
        notes: "no straw",
        quantity: 3,
      }),
      MENU
    );
    expect(line).toEqual({
      name: "Salt Bread",
      quantity: 3,
      optionNames: ["Oat milk", "Less ice"],
      notes: "no straw",
      department: "KITCHEN",
    });
    expect(JSON.stringify(line)).not.toMatch(/25000|5000|price/i);
  });
});

const CONTEXT: OrderPrintContext = {
  locale: "en",
  orderNumber: "POS-20260919-0007",
  queueNumber: 12,
  orderType: "DINE_IN",
  tableLabel: "A3",
  guestCount: 2,
  cashierName: "Budi",
};

const line = (over: Partial<PrepLine> = {}): PrepLine => ({
  name: "Salt Bread",
  quantity: 1,
  optionNames: [],
  department: "KITCHEN",
  ...over,
});

const NOW = new Date("2026-09-19T11:35:00Z");

const roles = (over: Partial<OrderPrintRoles> = {}): OrderPrintRoles => ({
  KITCHEN: { enabled: false, print: false, paperWidth: 32 },
  BAR: { enabled: false, print: false, paperWidth: 32 },
  LABEL: { enabled: false, print: false, scope: "ALL" },
  ...over,
});

const ORDER = [
  line({ name: "Salt Bread", quantity: 2, department: "KITCHEN" }),
  line({ name: "Iced Latte", quantity: 1, department: "BAR" }),
];

describe("planOrderPrint — tickets", () => {
  it("splits a mixed order: kitchen items to the kitchen printer, bar items to the bar printer", () => {
    const plan = planOrderPrint(
      { context: CONTEXT, lines: ORDER },
      roles({
        KITCHEN: { enabled: true, print: true, paperWidth: 48 },
        BAR: { enabled: true, print: true, paperWidth: 32 },
      }),
      NOW
    );

    expect(plan.tickets.map((t) => t.role)).toEqual(["KITCHEN", "BAR"]);
    const [kitchen, bar] = plan.tickets;
    expect(kitchen.ticket.sections).toEqual([
      {
        department: "KITCHEN",
        items: [{ name: "Salt Bread", quantity: 2, optionNames: [], notes: undefined }],
      },
    ]);
    expect(bar.ticket.sections).toEqual([
      {
        department: "BAR",
        items: [{ name: "Iced Latte", quantity: 1, optionNames: [], notes: undefined }],
      },
    ]);
    // Each ticket is sized to ITS printer's paper.
    expect(kitchen.ticket.width).toBe(48);
    expect(bar.ticket.width).toBe(32);
  });

  it("sends nothing to a printer whose area has no items", () => {
    const plan = planOrderPrint(
      { context: CONTEXT, lines: [ORDER[0]] },
      roles({
        KITCHEN: { enabled: true, print: true, paperWidth: 32 },
        BAR: { enabled: true, print: true, paperWidth: 32 },
      }),
      NOW
    );
    expect(plan.tickets.map((t) => t.role)).toEqual(["KITCHEN"]);
  });

  it("serves both areas from the kitchen printer, as two sections, when there is no bar printer", () => {
    const plan = planOrderPrint(
      { context: CONTEXT, lines: ORDER },
      roles({ KITCHEN: { enabled: true, print: true, paperWidth: 32 } }),
      NOW
    );
    expect(plan.tickets).toHaveLength(1);
    expect(plan.tickets[0].role).toBe("KITCHEN");
    expect(plan.tickets[0].ticket.sections.map((s) => s.department)).toEqual(["KITCHEN", "BAR"]);
  });

  it("serves both areas from the bar printer when it is the only one set up", () => {
    const plan = planOrderPrint(
      { context: CONTEXT, lines: ORDER },
      roles({ BAR: { enabled: true, print: true, paperWidth: 32 } }),
      NOW
    );
    expect(plan.tickets).toHaveLength(1);
    expect(plan.tickets[0].role).toBe("BAR");
    expect(plan.tickets[0].ticket.sections.map((s) => s.department)).toEqual(["KITCHEN", "BAR"]);
  });

  it("prints no ticket at all when neither captain printer is set up", () => {
    const plan = planOrderPrint({ context: CONTEXT, lines: ORDER }, roles(), NOW);
    expect(plan.tickets).toEqual([]);
    expect(isEmptyPlan(plan)).toBe(true);
  });

  describe("a printer set up but not printing in this run (print on demand)", () => {
    const on = { enabled: true, print: true, paperWidth: 32 as const };
    const onDemand = { enabled: true, print: false, paperWidth: 32 as const };
    const namesOf = (plan: ReturnType<typeof planOrderPrint>) =>
      Object.fromEntries(
        plan.tickets.map((t) => [
          t.role,
          t.ticket.sections.map((s) => `${s.department}:${s.items.map((i) => i.name).join("+")}`),
        ])
      );

    it("does not re-route the bar's drinks onto the kitchen ticket", () => {
      // Kitchen prints by itself, the bar only on demand. An automatic run must give
      // the kitchen ITS food — not a BAR section for a printer that isn't printing.
      const plan = planOrderPrint(
        { context: CONTEXT, lines: ORDER },
        roles({ KITCHEN: on, BAR: onDemand }),
        NOW
      );
      expect(namesOf(plan)).toEqual({ KITCHEN: ["KITCHEN:Salt Bread"] });
    });

    it("does not send the kitchen's food to the bar either (the symmetric case)", () => {
      const plan = planOrderPrint(
        { context: CONTEXT, lines: ORDER },
        roles({ KITCHEN: onDemand, BAR: on }),
        NOW
      );
      expect(namesOf(plan)).toEqual({ BAR: ["BAR:Iced Latte"] });
    });

    it("prints nothing at all when every printer set up is on demand", () => {
      const plan = planOrderPrint(
        { context: CONTEXT, lines: ORDER },
        roles({ KITCHEN: onDemand, BAR: onDemand }),
        NOW
      );
      expect(plan.tickets).toEqual([]);
    });

    it("still lets a lone on-demand captain printer cover both areas when it is asked to print", () => {
      // Routing is unchanged by `print`: with only the kitchen set up, the bar's
      // drinks belong on ITS ticket — and it appears once that printer is asked.
      const requested = planOrderPrint(
        { context: CONTEXT, lines: ORDER },
        roles({ KITCHEN: on }),
        NOW
      );
      expect(namesOf(requested)).toEqual({ KITCHEN: ["KITCHEN:Salt Bread", "BAR:Iced Latte"] });

      const skipped = planOrderPrint(
        { context: CONTEXT, lines: ORDER },
        roles({ KITCHEN: onDemand }),
        NOW
      );
      expect(skipped.tickets).toEqual([]);
    });

    it("tickets each drink exactly once across an automatic run and the reprint that follows", () => {
      const auto = planOrderPrint(
        { context: CONTEXT, lines: ORDER },
        roles({ KITCHEN: on, BAR: onDemand }),
        NOW
      );
      const manual = planOrderPrint(
        { context: CONTEXT, lines: ORDER },
        roles({ KITCHEN: on, BAR: on }),
        NOW
      );
      const latteTickets = (p: typeof auto) =>
        p.tickets.filter((t) =>
          t.ticket.sections.some((s) => s.items.some((i) => i.name === "Iced Latte"))
        );
      // Auto: nowhere. Manual: only the bar printer.
      expect(latteTickets(auto)).toEqual([]);
      expect(latteTickets(manual).map((t) => t.role)).toEqual(["BAR"]);
    });

    it("skips labels when the label printer isn't printing in this run, but keeps its routing intact", () => {
      const plan = planOrderPrint(
        { context: CONTEXT, lines: ORDER },
        roles({ LABEL: { enabled: true, print: false, scope: "ALL" } }),
        NOW
      );
      expect(plan.labels).toEqual([]);
    });
  });

  it("never prints a line that has no prep area", () => {
    const plan = planOrderPrint(
      { context: CONTEXT, lines: [line({ name: "Corkage", department: null }), ORDER[0]] },
      roles({ KITCHEN: { enabled: true, print: true, paperWidth: 32 } }),
      NOW
    );
    const names = plan.tickets.flatMap((t) =>
      t.ticket.sections.flatMap((s) => s.items.map((i) => i.name))
    );
    expect(names).toEqual(["Salt Bread"]);
  });

  it("carries the order's identity onto every ticket", () => {
    const plan = planOrderPrint(
      {
        context: { ...CONTEXT, notes: "birthday", customerName: "Budi", reprint: true },
        lines: ORDER,
      },
      roles({
        KITCHEN: { enabled: true, print: true, paperWidth: 32 },
        BAR: { enabled: true, print: true, paperWidth: 32 },
      }),
      NOW
    );
    for (const { ticket } of plan.tickets) {
      expect(ticket).toMatchObject({
        orderNumber: "POS-20260919-0007",
        queueNumber: 12,
        orderType: "DINE_IN",
        tableLabel: "A3",
        guestCount: 2,
        cashierName: "Budi",
        customerName: "Budi",
        notes: "birthday",
        reprint: true,
        locale: "en",
      });
    }
  });
});

describe("planOrderPrint — labels", () => {
  const withLabels = (scope: "ALL" | "KITCHEN" | "BAR" = "ALL") =>
    roles({ LABEL: { enabled: true, print: true, scope } });

  it("prints one label per unit ordered, numbered within its line", () => {
    const plan = planOrderPrint(
      { context: CONTEXT, lines: [line({ name: "Iced Latte", quantity: 3, department: "BAR" })] },
      withLabels(),
      NOW
    );
    expect(plan.labels.map((l) => `${l.index}/${l.count}`)).toEqual(["1/3", "2/3", "3/3"]);
    expect(plan.labels.every((l) => l.itemName === "Iced Latte")).toBe(true);
  });

  it("puts the call-out number on the sticker, or the order's tail when there is none", () => {
    const one = [line({ department: "BAR" })];
    expect(
      planOrderPrint({ context: CONTEXT, lines: one }, withLabels(), NOW).labels[0].headline
    ).toBe("#12");
    expect(
      planOrderPrint({ context: { ...CONTEXT, queueNumber: null }, lines: one }, withLabels(), NOW)
        .labels[0].headline
    ).toBe("0007");
    expect(
      planOrderPrint(
        { context: { ...CONTEXT, queueNumber: null, orderNumber: "OFFLINE-1A2B3C4D" }, lines: one },
        withLabels(),
        NOW
      ).labels[0].headline
    ).toBe("1A2B3C4D");
  });

  it("filters by the label printer's scope", () => {
    const names = (scope: "ALL" | "KITCHEN" | "BAR") =>
      planOrderPrint({ context: CONTEXT, lines: ORDER }, withLabels(scope), NOW).labels.map(
        (l) => l.itemName
      );
    expect(names("ALL")).toEqual(["Salt Bread", "Salt Bread", "Iced Latte"]);
    expect(names("BAR")).toEqual(["Iced Latte"]);
    expect(names("KITCHEN")).toEqual(["Salt Bread", "Salt Bread"]);
  });

  it("gives a line with no prep area no sticker", () => {
    const plan = planOrderPrint(
      { context: CONTEXT, lines: [line({ department: null })] },
      withLabels(),
      NOW
    );
    expect(plan.labels).toEqual([]);
  });

  it("prints a fractional quantity as one sticker, not a rounded-up handful", () => {
    const plan = planOrderPrint(
      { context: CONTEXT, lines: [line({ quantity: 1.5 })] },
      withLabels(),
      NOW
    );
    expect(plan.labels).toHaveLength(1);
  });

  it("caps a runaway quantity so a fat-fingered 9999 can't spool the roll", () => {
    const plan = planOrderPrint(
      { context: CONTEXT, lines: [line({ quantity: 9999 })] },
      withLabels(),
      NOW
    );
    expect(plan.labels).toHaveLength(50);
  });

  it("prints nothing when the label printer is off, whatever else is on", () => {
    const plan = planOrderPrint(
      { context: CONTEXT, lines: ORDER },
      roles({ KITCHEN: { enabled: true, print: true, paperWidth: 32 } }),
      NOW
    );
    expect(plan.labels).toEqual([]);
  });

  it("is independent of the tickets — a label-only shop gets labels and no tickets", () => {
    const plan = planOrderPrint({ context: CONTEXT, lines: ORDER }, withLabels(), NOW);
    expect(plan.tickets).toEqual([]);
    expect(plan.labels.length).toBeGreaterThan(0);
    expect(isEmptyPlan(plan)).toBe(false);
  });
});
