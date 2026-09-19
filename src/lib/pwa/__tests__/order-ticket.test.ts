/**
 * Kitchen / bar order ticket.
 *
 * The contract that matters: it tells the pass WHAT to make and never what it
 * costs, it never overflows the paper, and it can't misroute a section under the
 * wrong heading.
 */
import { describe, it, expect } from "vitest";
import {
  buildOrderTicketEscPos,
  buildSampleOrderTicket,
  formatTicketQuantity,
  type OrderTicketData,
} from "../order-ticket";
import { RECEIPT_LABELS, type ReceiptLocale } from "@/lib/receipts/receipt-labels";

const decode = (bytes: Uint8Array): string => String.fromCharCode(...bytes);

/** Printable text per line — ESC/POS control sequences stripped before measuring. */
function printedLines(bytes: Uint8Array): string[] {
  return (
    decode(bytes)
      .split("\n")
      // eslint-disable-next-line no-control-regex
      .map((l) => l.replace(/\x1b@|\x1b[aE!][\x00-\xff]/g, "").replace(/[\x00-\x1f]/g, ""))
  );
}

const TICKET: OrderTicketData = {
  locale: "en",
  orderNumber: "POS-20260919-0007",
  queueNumber: 12,
  date: "09/19/2026, 6:35 PM",
  orderType: "DINE_IN",
  tableLabel: "A3",
  guestCount: 4,
  cashierName: "Budi",
  sections: [
    {
      department: "KITCHEN",
      items: [
        { name: "Salt Bread", quantity: 2 },
        {
          name: "Croque Monsieur",
          quantity: 1,
          optionNames: ["No ham", "Extra cheese"],
          notes: "well done",
        },
      ],
    },
  ],
  width: 32,
};

const MULTI: OrderTicketData = {
  ...TICKET,
  sections: [
    { department: "KITCHEN", items: [{ name: "Salt Bread", quantity: 2 }] },
    { department: "BAR", items: [{ name: "Iced Latte", quantity: 1 }] },
  ],
};

describe("buildOrderTicketEscPos", () => {
  it("leads each item with its quantity, then the name", () => {
    const out = decode(buildOrderTicketEscPos(TICKET));
    expect(out).toContain("2x Salt Bread");
    expect(out).toContain("1x Croque Monsieur");
  });

  it("prints options under their item and the line note as a bold '* note'", () => {
    const out = decode(buildOrderTicketEscPos(TICKET));
    expect(out).toContain("No ham, Extra cheese");
    expect(out).toContain("* well done");
  });

  it("never prints a price, a total or a payment word — in any language", () => {
    for (const locale of ["en", "id", "fr"] as ReceiptLocale[]) {
      const out = decode(buildOrderTicketEscPos({ ...TICKET, locale }));
      const words = RECEIPT_LABELS[locale];
      for (const forbidden of [
        words.total,
        words.subtotal,
        words.tax,
        words.paid,
        words.cash,
        words.change,
      ]) {
        expect(out).not.toContain(forbidden);
      }
      expect(out).not.toMatch(/Rp|€|\$/);
    }
  });

  it("titles a single-area ticket by its area, in the ticket's language", () => {
    expect(decode(buildOrderTicketEscPos(TICKET))).toContain("KITCHEN");
    expect(decode(buildOrderTicketEscPos({ ...TICKET, locale: "id" }))).toContain("DAPUR");
    expect(decode(buildOrderTicketEscPos({ ...TICKET, locale: "fr" }))).toContain("CUISINE");
    const bar = decode(
      buildOrderTicketEscPos({
        ...TICKET,
        sections: [{ department: "BAR", items: [{ name: "Iced Latte", quantity: 1 }] }],
      })
    );
    expect(bar).toContain("BAR");
    expect(bar).not.toContain("KITCHEN");
  });

  it("titles a two-area ticket ORDER and banners each area, kitchen first", () => {
    const out = decode(buildOrderTicketEscPos(MULTI));
    expect(out).toContain("ORDER");
    expect(out.indexOf("KITCHEN")).toBeGreaterThan(-1);
    expect(out.indexOf("BAR")).toBeGreaterThan(out.indexOf("KITCHEN"));
    // Each item sits under ITS banner, not the other's.
    expect(out.indexOf("Salt Bread")).toBeLessThan(out.indexOf("BAR"));
    expect(out.indexOf("Iced Latte")).toBeGreaterThan(out.indexOf("BAR"));
  });

  it("prints the call-out number large, and only when there is one", () => {
    expect(decode(buildOrderTicketEscPos(TICKET))).toContain("#12");
    expect(decode(buildOrderTicketEscPos({ ...TICKET, queueNumber: null }))).not.toContain("#");
  });

  it("marks a reprint, and only a reprint", () => {
    expect(decode(buildOrderTicketEscPos({ ...TICKET, reprint: true }))).toContain("REPRINT");
    expect(decode(buildOrderTicketEscPos(TICKET))).not.toContain("REPRINT");
  });

  it("says where and for whom: order type with pax, table, server", () => {
    const out = decode(buildOrderTicketEscPos(TICKET));
    expect(out).toContain("Dine In (4 pax)");
    expect(out).toContain("A3");
    expect(out).toContain("Budi");
    // Pax means nothing for a takeaway.
    const takeaway = decode(buildOrderTicketEscPos({ ...TICKET, orderType: "TAKEAWAY" }));
    expect(takeaway).toContain("Takeaway");
    expect(takeaway).not.toContain("pax");
  });

  it("prints an order-level note", () => {
    expect(
      decode(buildOrderTicketEscPos({ ...TICKET, notes: "Birthday - candle please" }))
    ).toContain("Birthday - candle please");
  });

  it("keeps a wrapped item name under the NAME, not under its quantity", () => {
    const lines = printedLines(
      buildOrderTicketEscPos({
        ...TICKET,
        sections: [
          {
            department: "KITCHEN",
            items: [{ name: "Cream Cheese Honey Chilli Sourdough Toastie", quantity: 2 }],
          },
        ],
      })
    );
    const first = lines.findIndex((l) => l.startsWith("2x "));
    expect(first).toBeGreaterThan(-1);
    // "2x " is 3 characters; the continuation is indented to match.
    expect(lines[first + 1].startsWith("   ")).toBe(true);
    expect(lines[first + 1].trim().length).toBeGreaterThan(0);
  });

  it("keeps every line within the paper at 32 and 48 columns, with hostile content", () => {
    for (const width of [32, 48] as const) {
      const lines = printedLines(
        buildOrderTicketEscPos({
          ...MULTI,
          width,
          orderNumber: "POS-20260919-000712345",
          tableLabel: "Terrace long table number seventeen",
          cashierName: "Muhammad Rizky Ramadhan Kurniawan",
          customerName: "Bapak Suryanegara Wiratmadja Kusumah",
          notes: "Tolong pisahkan sambalnya, alergi kacang, dan bungkus terpisah ya",
          sections: [
            {
              department: "KITCHEN",
              items: [
                {
                  name: "Cream Cheese Honey Chilli Sourdough Toastie with Extra Everything",
                  quantity: 12,
                  optionNames: ["Extra chilli oil", "No coriander", "Gluten free bread swap"],
                  notes: "cut in four, separate plates, allergy to peanuts and sesame",
                },
              ],
            },
          ],
        })
      );
      for (const line of lines) expect(line.length).toBeLessThanOrEqual(width);
    }
  });

  it("emits only ASCII — CP437 round-trips nothing else", () => {
    const bytes = buildOrderTicketEscPos({
      ...TICKET,
      locale: "fr",
      customerName: "Zoé Lefèvre",
      sections: [{ department: "KITCHEN", items: [{ name: "Crème brûlée ♥", quantity: 1 }] }],
    });
    for (const byte of bytes) expect(byte).toBeLessThan(128);
    expect(decode(bytes)).toContain("Creme brulee ?");
  });
});

describe("formatTicketQuantity", () => {
  it("prints whole numbers plainly and trims fractional noise", () => {
    expect(formatTicketQuantity(2)).toBe("2");
    expect(formatTicketQuantity(1.5)).toBe("1.5");
    expect(formatTicketQuantity(0.25)).toBe("0.25");
    expect(formatTicketQuantity(1.4999999)).toBe("1.5");
  });
});

describe("buildSampleOrderTicket", () => {
  it("is a real ticket for the area asked for, at the paper width asked for", () => {
    const sample = buildSampleOrderTicket({ department: "BAR", locale: "en", width: 48 });
    expect(sample.sections).toHaveLength(1);
    expect(sample.sections[0].department).toBe("BAR");
    expect(sample.width).toBe(48);
    expect(decode(buildOrderTicketEscPos(sample))).toContain("PRINTER TEST");
  });
});
