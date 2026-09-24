import type { ItemLabelData } from "@/lib/pwa/item-label";
import type { OrderTicketData, OrderTicketSection, PrepDepartment } from "@/lib/pwa/order-ticket";
import { RECEIPT_INTL_LOCALE, type ReceiptLocale } from "@/lib/receipts/receipt-labels";
import { itemDepartment } from "../components/kds/kds-department";
import type { CartItem, PosMenuItem, PosOrderItemDisplay } from "../types/pos.types";
import { isCustomLine } from "./cart-wire";

/**
 * Decides WHAT prints WHERE when an order is placed: which lines go to the
 * kitchen printer, which to the bar printer, which get a sticker. Pure — no
 * Bluetooth, no React, no clock unless `now` is omitted — so the routing rules
 * (the part that decides whether the bar ever hears about a drink) are testable.
 *
 * "Which area is this line" is NOT decided here: it is the KDS's own rule
 * (itemDepartment), reused so the printed ticket and the kitchen screen can
 * never disagree about where a line belongs.
 */

/** One line of an order, reduced to what a prep area needs to know — no prices. */
export interface PrepLine {
  name: string;
  quantity: number;
  optionNames: string[];
  notes?: string;
  /** null = nothing to make (a Custom Item with no prep area): never ticketed, never labelled. */
  department: PrepDepartment | null;
}

/** Which sticker set a label printer prints. */
export type LabelScope = "ALL" | PrepDepartment;

export interface OrderPrintContext {
  locale: ReceiptLocale;
  orderNumber: string;
  queueNumber?: number | null;
  orderType?: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  /** The delivery platform (Order.source) for an online order — see OrderTicketData.platform. */
  platform?: string | null;
  tableLabel?: string;
  guestCount?: number | null;
  cashierName?: string;
  customerName?: string;
  notes?: string;
  reprint?: boolean;
}

/** Everything needed to print an order's tickets and labels — kept on the complete screen so it can be reprinted. */
export interface OrderPrintSource {
  context: OrderPrintContext;
  lines: PrepLine[];
}

/**
 * The slice of the printer settings the planner reads. Each printer carries TWO
 * facts that must never be collapsed into one:
 *  - `enabled` — a printer is set up for this area. It decides ROUTING: where a
 *    line goes, and whether the other captain printer has to cover for a missing
 *    one.
 *  - `print`   — it prints in THIS run. An automatic run skips a printer that is
 *    set to print on demand only; a cashier's tap does not.
 * Conflating them re-routes a line the moment its printer is "on demand": with a
 * kitchen printer that prints by itself and a bar printer that doesn't, the bar's
 * drinks would land on the kitchen ticket, then print again at the bar on tap.
 */
export interface OrderPrintRoles {
  KITCHEN: { enabled: boolean; print: boolean; paperWidth: 32 | 48 };
  BAR: { enabled: boolean; print: boolean; paperWidth: 32 | 48 };
  LABEL: { enabled: boolean; print: boolean; scope: LabelScope };
}

export interface PlannedTicket {
  role: PrepDepartment;
  ticket: OrderTicketData;
}

export interface OrderPrintPlan {
  tickets: PlannedTicket[];
  labels: ItemLabelData[];
}

/** id → the POS menu's own department value ("KITCHEN" | "BAR" | "CUSTOM"), for resolving a cart line. */
export type MenuDepartments = ReadonlyMap<string, PosMenuItem["department"]>;

export function indexMenuDepartments(
  categories:
    | ReadonlyArray<{ items: ReadonlyArray<Pick<PosMenuItem, "id" | "department">> }>
    | null
    | undefined
): MenuDepartments {
  const index = new Map<string, PosMenuItem["department"]>();
  for (const category of categories ?? []) {
    for (const item of category.items) index.set(item.id, item.department);
  }
  return index;
}

/**
 * A cart line → its prep area, through the KDS rule. The cart doesn't carry a
 * line's department (only a Custom Item's own), so a menu line is looked up in
 * the cached POS menu: BAR → bar, the "CUSTOM" sentinel (the optional second
 * product line, which has no prep step) → none, anything else → kitchen. A line
 * whose menu item isn't in the cache falls back to the kitchen — the same
 * historical default the KDS applies, so an order never loses a line just
 * because the menu cache was cold.
 */
export function cartLineToPrepLine(item: CartItem, menu: MenuDepartments): PrepLine {
  const known = !!item.menuItemId && menu.has(item.menuItemId);
  const menuDepartment = item.menuItemId ? menu.get(item.menuItemId) : undefined;

  const shaped: PosOrderItemDisplay = {
    id: item.id,
    menuItemId: item.menuItemId,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.lineTotal,
    status: "PENDING",
    isCustom: isCustomLine(item),
    department: item.department ?? null,
    menuItem: known
      ? {
          name: item.name,
          department: menuDepartment === "BAR" ? "BAR" : "KITCHEN",
          product: menuDepartment === "CUSTOM" ? { productLine: "CUSTOM" } : null,
        }
      : null,
  };

  return {
    name: item.name,
    quantity: item.quantity,
    optionNames: item.modifiers.map((m) => m.optionName),
    notes: item.notes,
    department: itemDepartment(shaped),
  };
}

/** A sanity ceiling, so a fat-fingered quantity can't spool hundreds of stickers. */
const MAX_LABELS_PER_LINE = 50;

/** One sticker per unit ordered; a fractional quantity (0.5 kg) is one sticker, not "ceil". */
function labelUnits(quantity: number): number {
  return Number.isInteger(quantity) ? Math.min(MAX_LABELS_PER_LINE, Math.max(1, quantity)) : 1;
}

/** The big line on a sticker: the call-out number, or the order number's tail when there is none. */
function labelHeadline(context: OrderPrintContext): string {
  if (context.queueNumber != null) return `#${context.queueNumber}`;
  return context.orderNumber.split("-").pop() || context.orderNumber;
}

/**
 * The tickets and labels an order produces under the given printer setup.
 *
 * Tickets: each line goes to its own area's printer. If that area has no printer
 * set up but the OTHER one does, it goes there instead (a single captain printer
 * serves both); only when neither is set up does the line print nowhere. When both
 * areas land on one printer the ticket carries a section per area. Routing looks
 * only at `enabled`; a ticket whose printer isn't printing in this run (`print`)
 * is then dropped, never re-routed.
 *
 * Labels: one per unit, for lines that have a prep area, filtered by the label
 * printer's scope.
 */
export function planOrderPrint(
  source: OrderPrintSource,
  roles: OrderPrintRoles,
  now: Date = new Date()
): OrderPrintPlan {
  const { context, lines } = source;
  const intl = RECEIPT_INTL_LOCALE[context.locale];
  const date = new Intl.DateTimeFormat(intl, { dateStyle: "short", timeStyle: "short" }).format(
    now
  );
  const time = new Intl.DateTimeFormat(intl, { timeStyle: "short" }).format(now);

  const departments: PrepDepartment[] = ["KITCHEN", "BAR"];
  const setUpCaptain = departments.filter((d) => roles[d].enabled);
  const sectionsByRole = new Map<PrepDepartment, OrderTicketSection[]>();

  for (const department of departments) {
    const items = lines
      .filter((line) => line.department === department)
      .map(({ name, quantity, optionNames, notes }) => ({ name, quantity, optionNames, notes }));
    if (items.length === 0) continue;

    const target = roles[department].enabled ? department : setUpCaptain[0];
    if (!target) continue;
    sectionsByRole.set(target, [...(sectionsByRole.get(target) ?? []), { department, items }]);
  }

  const tickets: PlannedTicket[] = [...sectionsByRole]
    .filter(([role]) => roles[role].print)
    .map(([role, sections]) => ({
      role,
      ticket: {
        locale: context.locale,
        orderNumber: context.orderNumber,
        queueNumber: context.queueNumber,
        date,
        orderType: context.orderType,
        platform: context.platform,
        tableLabel: context.tableLabel,
        guestCount: context.guestCount,
        cashierName: context.cashierName,
        customerName: context.customerName,
        notes: context.notes,
        sections,
        reprint: context.reprint,
        width: roles[role].paperWidth,
      },
    }));

  const labels: ItemLabelData[] = [];
  if (roles.LABEL.enabled && roles.LABEL.print) {
    const { scope } = roles.LABEL;
    const headline = labelHeadline(context);
    const footer = [context.tableLabel || context.customerName, time].filter(Boolean).join(" ");
    for (const line of lines) {
      if (line.department === null) continue;
      if (scope !== "ALL" && line.department !== scope) continue;
      const count = labelUnits(line.quantity);
      for (let index = 1; index <= count; index++) {
        labels.push({
          headline,
          itemName: line.name,
          optionNames: line.optionNames,
          notes: line.notes,
          index,
          count,
          footer,
        });
      }
    }
  }

  return { tickets, labels };
}

export const isEmptyPlan = (plan: OrderPrintPlan): boolean =>
  plan.tickets.length === 0 && plan.labels.length === 0;
