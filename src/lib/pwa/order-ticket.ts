// Captain order ("kitchen ticket") as ESC/POS bytes.
//
// The customer's receipt (thermal-printer.ts) answers "what do I owe"; this
// answers "what do I make". So it carries items, options, notes and quantities —
// and deliberately NO price, subtotal, tax, discount or payment line, ever: the
// pass has no business seeing them, and a ticket that reads like a bill gets
// handed to the customer by mistake.
//
// One ticket goes to one printer. A shop with a separate kitchen and bar prints
// one ticket per area (each holding only that area's items); a shop with a single
// captain printer gets one ticket with a section per area. Which items go where
// is decided upstream (features/pos/lib/print-plan.ts) — this module only draws.

import { printBytes } from "@/lib/pwa/printer-connection";
import { createEscPosWriter, labelRow, wrapText } from "@/lib/pwa/thermal-printer";
import {
  RECEIPT_INTL_LOCALE,
  RECEIPT_LABELS,
  SHIFT_REPORT_LABELS,
  TICKET_LABELS,
  resolveReceiptLocale,
  type ReceiptLocale,
} from "@/lib/receipts/receipt-labels";

/** A prep area with its own printer. Mirrors the KDS stations (kds-department.ts). */
export type PrepDepartment = "KITCHEN" | "BAR";

export interface OrderTicketItem {
  name: string;
  quantity: number;
  /** Chosen modifiers, e.g. ["Oat milk", "Less ice"]. */
  optionNames?: string[];
  /** The line's free-text instruction ("no ice") — printed bold, it is the part that gets missed. */
  notes?: string;
}

export interface OrderTicketSection {
  department: PrepDepartment;
  items: OrderTicketItem[];
}

export interface OrderTicketData {
  locale?: ReceiptLocale;
  orderNumber: string;
  /** The call-out number — printed large under the heading when the order has one. */
  queueNumber?: number | null;
  date: string;
  orderType?: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  tableLabel?: string;
  /** Pax, dine-in only. */
  guestCount?: number | null;
  cashierName?: string;
  customerName?: string;
  /** Order-level note (separate from each line's own). */
  notes?: string;
  sections: OrderTicketSection[];
  /** A second copy of a ticket already printed — says so at the top. */
  reprint?: boolean;
  /** 32 cols = 58mm, 48 cols = 80mm. */
  width?: 32 | 48;
}

/** `2` → "2", `1.5` → "1.5", `1.50` → "1.5" — quantities are Decimal(10,2) in the schema. */
export function formatTicketQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : String(Number(quantity.toFixed(2)));
}

/**
 * `prefix` + wrapped text, continuation lines indented to sit under the text,
 * not under the prefix. wrapText() splits on whitespace and so would drop any
 * leading indent — which on a ticket IS the hierarchy (options and notes hang
 * under their item) — so it is re-applied here to every line.
 */
function hanging(prefix: string, text: string, cols: number): string[] {
  const pad = " ".repeat(prefix.length);
  const wrapped = wrapText(text, Math.max(1, cols - prefix.length));
  if (wrapped.length === 0) return [prefix.trimEnd()];
  return wrapped.map((part, i) => `${i === 0 ? prefix : pad}${part}`);
}

export function buildOrderTicketEscPos(ticket: OrderTicketData): Uint8Array {
  const cols = ticket.width ?? 32;
  const divider = "-".repeat(cols);
  const locale = resolveReceiptLocale(ticket.locale);
  const labels = TICKET_LABELS[locale];
  const receiptLabels = RECEIPT_LABELS[locale];
  const typeLabels = SHIFT_REPORT_LABELS[locale];
  const departmentTitle = (department: PrepDepartment) =>
    department === "BAR" ? labels.bar : labels.kitchen;
  // Several sections = one printer serving more than one area, so each section
  // needs its own banner; a single section is already named by the heading.
  const multi = ticket.sections.length > 1;

  const w = createEscPosWriter();
  const { line, lines, blank, bold, center, left, doubleSize, doubleHeight } = w;

  w.init();

  // ---- Heading: which area this is for, and the call-out number ------------
  // Double-width glyphs take two cells each, so half the columns — the same
  // arithmetic (and the same reason) as the receipt's store name.
  const bigCols = Math.max(1, Math.floor(cols / 2));
  center();
  doubleSize(true);
  const heading =
    multi || !ticket.sections[0]
      ? labels.orderTicket
      : departmentTitle(ticket.sections[0].department);
  lines(wrapText(heading, bigCols));
  if (ticket.queueNumber != null) lines(wrapText(`#${ticket.queueNumber}`, bigCols));
  doubleSize(false);
  if (ticket.reprint) {
    bold(true);
    lines(wrapText(labels.reprint, cols));
    bold(false);
  }
  left();
  line(divider);

  // ---- Who / where / when --------------------------------------------------
  lines(labelRow(labels.orderNo, ticket.orderNumber, cols));
  lines(labelRow(receiptLabels.date, ticket.date, cols));
  if (ticket.tableLabel) lines(labelRow(receiptLabels.table, ticket.tableLabel, cols));
  const typeName =
    ticket.orderType === "DINE_IN"
      ? typeLabels.dineIn
      : ticket.orderType === "TAKEAWAY"
        ? typeLabels.takeaway
        : ticket.orderType === "DELIVERY"
          ? typeLabels.deliveryType
          : null;
  if (typeName) {
    const pax =
      ticket.orderType === "DINE_IN" && ticket.guestCount ? ` (${ticket.guestCount} pax)` : "";
    lines(labelRow(labels.type, `${typeName}${pax}`, cols));
  }
  if (ticket.customerName) lines(labelRow(labels.customer, ticket.customerName, cols));
  if (ticket.cashierName) lines(labelRow(receiptLabels.cashier, ticket.cashierName, cols));

  // ---- Items ---------------------------------------------------------------
  for (const section of ticket.sections) {
    line(divider);
    if (multi) {
      center();
      bold(true);
      lines(wrapText(departmentTitle(section.department), cols));
      bold(false);
      left();
      line(divider);
    }
    for (const item of section.items) {
      // Tall + bold, quantity first: this is read across a pass, not held in the hand.
      doubleHeight(true);
      bold(true);
      lines(hanging(`${formatTicketQuantity(item.quantity)}x `, item.name, cols));
      bold(false);
      doubleHeight(false);
      const options = (item.optionNames ?? []).filter(Boolean);
      if (options.length > 0) lines(hanging("   ", options.join(", "), cols));
      if (item.notes) {
        bold(true);
        lines(hanging("   * ", item.notes, cols));
        bold(false);
      }
    }
  }

  if (ticket.notes) {
    line(divider);
    bold(true);
    lines(hanging(`${receiptLabels.notes}: `, ticket.notes, cols));
    bold(false);
  }

  // Same tear guide + feed as the receipt: cutter-less printers rely on a hand
  // tear, and a thin gap is what made consecutive tickets run together. The cut
  // command itself is sent separately by printBytes().
  blank(2);
  line(divider);
  blank(6);

  return w.bytes();
}

/** Prints one ticket on the given area's printer. Rejects with PrinterNotConnectedError if it isn't paired. */
export async function printOrderTicket(
  role: "KITCHEN" | "BAR",
  ticket: OrderTicketData
): Promise<void> {
  await printBytes(role, buildOrderTicketEscPos(ticket));
}

/** A tiny fake order, for the settings screen's "Test print" — the real layout on real paper. */
export function buildSampleOrderTicket(input: {
  department: PrepDepartment;
  locale: ReceiptLocale;
  width: 32 | 48;
  now?: Date;
}): OrderTicketData {
  const labels = TICKET_LABELS[input.locale];
  return {
    locale: input.locale,
    orderNumber: "TEST-0001",
    queueNumber: 12,
    date: new Intl.DateTimeFormat(RECEIPT_INTL_LOCALE[input.locale], {
      dateStyle: "short",
      timeStyle: "short",
    }).format(input.now ?? new Date()),
    orderType: "DINE_IN",
    tableLabel: "A3",
    guestCount: 2,
    sections: [
      {
        department: input.department,
        items: [
          { name: labels.testTitle, quantity: 2, optionNames: ["Option A", "Option B"] },
          { name: labels.testBody, quantity: 1, notes: "* * *" },
        ],
      },
    ],
    width: input.width,
  };
}
