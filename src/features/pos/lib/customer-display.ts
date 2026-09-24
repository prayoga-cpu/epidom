import type { CartItem } from "../types/pos.types";

/**
 * Shared contract between the cashier window (publisher) and the customer-
 * facing display window (subscriber) it opens on the second screen.
 *
 * Two transports carry the same snapshot, on purpose:
 *  - `BroadcastChannel` is the live path — same-origin, cross-window, instant.
 *  - a `localStorage` mirror is the cold-start path, since BroadcastChannel
 *    has no replay: a display opened halfway through an order would otherwise
 *    sit blank until the cashier's next tap. It doubles as the fallback for
 *    any browser without BroadcastChannel, via the `storage` event.
 */

/** How long the thank-you screen stays up after a settled order before the
 * display returns to idle. Shared by both sides so the display can expire a
 * stale "paid" snapshot on its own if the cashier window went away. */
export const CUSTOMER_DISPLAY_PAID_MS = 12_000;

export function customerDisplayChannelName(storeId: string): string {
  return `epidom-customer-display:${storeId}`;
}

export function customerDisplaySnapshotKey(storeId: string): string {
  return `epidom-customer-display-state:${storeId}`;
}

export function customerDisplayPath(storeId: string): string {
  return `/store/${storeId}/pos/display`;
}

export interface CustomerDisplayLine {
  /** The cart line's local id — stable across quantity changes, which is what
   * lets the hero card keep featuring the same line. */
  id: string;
  name: string;
  quantity: number;
  lineTotal: number;
  /** Option names only (no group/price noise) — the customer is checking that
   * their drink is right, not auditing the modifier pricing. */
  modifiers: string[];
  notes?: string;
}

export interface CustomerDisplayHighlight {
  id: string;
  /** True only when this line was genuinely just added or increased. False
   * when it's a fallback pick (a removal, or the display being switched back
   * on over a cart the customer never watched being built) — the hero card
   * drops its "Just added" eyebrow in that case rather than claiming
   * something arrived that didn't. */
  isNew: boolean;
}

export interface CustomerDisplaySnapshot {
  /** `idle` — nothing rung up yet; `building` — cashier is adding items;
   * `paid` — the order just settled, shown as a thank-you before idling;
   * `off` — the cashier turned the customer display off, so an already-open
   * display window goes to standby instead of freezing on the last order. */
  phase: "idle" | "building" | "paid" | "off";
  lines: CustomerDisplayLine[];
  /** The line the hero card blows up — the one just added or increased.
   * Null when the cart is empty. */
  highlightLineId: string | null;
  /** Whether `highlightLineId` was genuinely just added, as opposed to picked
   * as a fallback. Drives the hero card's "Just added" eyebrow. */
  highlightIsNew: boolean;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  /** The WHOLE discount off the bill — a manual/preset/coupon discount PLUS the
   * value of any redeemed points. Kept as one total so a display window that
   * predates the split (or never learns of it) still shows a correct line. */
  discountAmount: number;
  /** Composite label for `discountAmount`, e.g. "Member + 250 pts". */
  discountReason: string | null;
  /** Points redeemed on this bill (0 when none). Additive: `discountAmount`
   * already includes their value, so a display that ignores these two fields
   * loses nothing but the ability to break the line in two. */
  pointsRedeemed: number;
  /** The currency value of `pointsRedeemed` — the part of `discountAmount` that came from points. */
  pointsDiscountAmount: number;
  total: number;
  /** Set only while `phase === "paid"`. */
  paidOrderNumber: string | null;
  /** Epoch ms. Monotonic guard: a subscriber ignores any snapshot older than
   * the one it already has, so a late `storage` event can't resurrect stale
   * state over a fresher broadcast. */
  updatedAt: number;
}

export type CustomerDisplayMessage =
  | { type: "state"; snapshot: CustomerDisplaySnapshot }
  /** Sent by a display window on mount — the cashier window answers with its
   * current snapshot, since broadcasts aren't replayed to late joiners. */
  | { type: "request" }
  /**
   * Display -> cashier: a number the customer typed themselves so their
   * receipt can reach them on WhatsApp — and, from there, so the till can tell
   * whether they are already a member. It lands in the cashier's customer
   * intake rather than being saved anywhere directly: the cashier window looks
   * the number up (and saves a new customer only once they finish, see
   * `customer-submit`), and the cashier still sees everything and still
   * decides whether the order is created. `null` clears a number entered by
   * mistake.
   *
   * E.164 (e.g. "+6281234567890"), validated on the display before it is
   * sent, so the cashier's form never receives something it would reject.
   */
  | { type: "customer-phone"; phone: string | null }
  /**
   * Display -> cashier: the optional extras a NEW customer may add after
   * giving their number. Sent as the customer types, so the cashier's
   * new-customer form fills in live. Empty strings mean "not given"; the email
   * has been checked on the display, the name is only trimmed and length-capped.
   */
  | { type: "customer-details"; name: string; email: string }
  /**
   * Display -> cashier: the customer pressed Done (or Skip) on that optional
   * step, so what they typed is final. Carries the details one last time — the
   * debounced `customer-details` may not have gone out yet — and is what lets
   * the cashier window save a NEW customer and attach them to the sale without
   * the cashier pressing Save (see useCustomerIntakeResolver). Same trust as
   * `customer-details`: re-validated on arrival.
   */
  | { type: "customer-submit"; name: string; email: string }
  /**
   * Cashier -> display: the answer to the number above. Kept off the state
   * snapshot on purpose — the snapshot is mirrored into localStorage, and a
   * customer's number and first name have no business being written there.
   */
  | { type: "customer-status"; status: CustomerDisplayIntakeStatus }
  /**
   * Cashier -> display: "please enter your details" — opens the number pad (and,
   * for a new customer, the optional name / email step) on the customer's
   * screen, exactly as if they had tapped its WhatsApp button themselves.
   * Carries nothing: what the customer types comes back as the messages
   * above — a returning customer is attached by the lookup, a new one is saved
   * once they press Done.
   */
  | { type: "ask-details" };

/**
 * What the till found out about the number a customer entered.
 *  - `existing`: already a customer of this store — greet them, ask for nothing.
 *  - `new`: not on file — offer the optional name / email step.
 *  - `unknown`: the till could not tell (offline, or the lookup failed) — the
 *    display falls back to the optional step, since the cashier decides anyway.
 */
export type CustomerDisplayMatch = "existing" | "new" | "unknown";

export interface CustomerDisplayIntakeStatus {
  /** The number this answers. A display whose customer has since changed or
   * removed their number ignores a status for the old one. */
  phone: string;
  match: CustomerDisplayMatch;
  /**
   * First name ONLY, and only for `existing`. The display is a screen anyone
   * standing at the till can read, and anyone can type any number into it, so
   * it must never receive a surname, email, points or spend for a number it
   * merely typed — a first-name greeting is the most it is trusted with. Null
   * when the record has no real name (it was named after the number).
   */
  firstName: string | null;
}

/** The first word of a customer's name, or null when the "name" is just their number. */
export function firstNameOf(name: string | null | undefined, phone?: string | null): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  // A customer created from a number alone is named after it.
  if (phone && trimmed === phone) return null;
  if (/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  return trimmed.split(/\s+/)[0] ?? null;
}

/** Longest name / email the display will send — matches the server's own caps. */
export const CUSTOMER_DETAILS_NAME_MAX = 100;
export const CUSTOMER_DETAILS_EMAIL_MAX = 254;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** True for an address worth sending — used by the display to hold back a half-typed one. */
export function isPlausibleEmail(value: string): boolean {
  return value.length <= CUSTOMER_DETAILS_EMAIL_MAX && EMAIL_SHAPE.test(value);
}

export const EMPTY_CUSTOMER_DISPLAY_SNAPSHOT: CustomerDisplaySnapshot = {
  phase: "idle",
  lines: [],
  highlightLineId: null,
  highlightIsNew: false,
  subtotal: 0,
  tax: 0,
  serviceCharge: 0,
  discountAmount: 0,
  discountReason: null,
  pointsRedeemed: 0,
  pointsDiscountAmount: 0,
  total: 0,
  paidOrderNumber: null,
  updatedAt: 0,
};

/**
 * Cart lines as the customer sees them. Reads nothing but the line's own
 * fields — never `menuItemId` — because a Custom Item has none (null): the
 * customer is checking what they're being charged for, and an ad-hoc line is
 * exactly as legitimate a charge as a menu one.
 */
export function toCustomerDisplayLines(items: CartItem[]): CustomerDisplayLine[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
    modifiers: (item.modifiers ?? []).map((modifier) => modifier.optionName),
    notes: item.notes,
  }));
}

/** The cart's money, as the "building" snapshot reads it. */
export interface CustomerDisplayCartTotals {
  subtotal: number;
  tax: number;
  serviceCharge: number;
  discountAmount: number;
  discountReason: string | null;
  pointsRedeemed: number;
  pointsDiscountAmount: number;
  total: number;
}

/**
 * The snapshot for an order still being rung up. Extracted from the publisher
 * so the shape other windows consume is built in ONE testable place: every
 * field of CustomerDisplaySnapshot is always present, so an older display
 * window (which ignores the points fields) and a newer one read it alike.
 */
export function buildCustomerDisplayBuildingSnapshot(args: {
  lines: CustomerDisplayLine[];
  highlight: CustomerDisplayHighlight | null;
  totals: CustomerDisplayCartTotals;
  updatedAt: number;
}): CustomerDisplaySnapshot {
  const { lines, highlight, totals } = args;
  return {
    phase: lines.length > 0 ? "building" : "idle",
    lines,
    highlightLineId: highlight?.id ?? null,
    highlightIsNew: highlight?.isNew ?? false,
    subtotal: totals.subtotal,
    tax: totals.tax,
    serviceCharge: totals.serviceCharge,
    discountAmount: totals.discountAmount,
    discountReason: totals.discountReason,
    pointsRedeemed: totals.pointsRedeemed,
    pointsDiscountAmount: totals.pointsDiscountAmount,
    total: totals.total,
    paidOrderNumber: null,
    updatedAt: args.updatedAt,
  };
}

/**
 * Which line the hero card should feature after a cart change.
 *
 * The cart store doesn't record "what was just added" — addItem() either
 * appends a line or bumps an existing one's quantity — so it's recovered by
 * diffing consecutive snapshots rather than by widening the persisted store.
 *
 * A brand-new line beats a bumped one: tapping a different item is the more
 * recent action even when both changed in the same update (e.g. a resumed
 * held order landing on top of a non-empty cart).
 */
export function resolveHighlight(
  previous: CustomerDisplayLine[],
  next: CustomerDisplayLine[],
  previousHighlight: CustomerDisplayHighlight | null
): CustomerDisplayHighlight | null {
  if (next.length === 0) return null;

  const quantitiesBefore = new Map(previous.map((line) => [line.id, line.quantity]));

  const added = next.filter((line) => !quantitiesBefore.has(line.id));
  if (added.length > 0) return { id: added[added.length - 1].id, isNew: true };

  const bumped = next.find((line) => line.quantity > (quantitiesBefore.get(line.id) ?? 0));
  if (bumped) return { id: bumped.id, isNew: true };

  // Nothing grew — a removal, a quantity decrease, an edited note. Keep
  // featuring the same line while it's still in the cart so the display
  // doesn't jump around on an unrelated edit, carrying its `isNew` with it
  // so an edit doesn't re-announce a line as freshly added.
  if (previousHighlight && next.some((line) => line.id === previousHighlight.id)) {
    return previousHighlight;
  }

  // Nothing to anchor to: the highlighted line was removed, or the display
  // was switched on over a cart it never watched being built. Show the last
  // line, but never as "just added" — the customer didn't see it arrive.
  return { id: next[next.length - 1].id, isNew: false };
}

/** Parses a mirrored snapshot, tolerating anything that isn't one (a cleared
 * key, a half-written value, a shape from an older release). */
export function parseCustomerDisplaySnapshot(raw: string | null): CustomerDisplaySnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CustomerDisplaySnapshot>;
    if (!parsed || !Array.isArray(parsed.lines) || typeof parsed.updatedAt !== "number") {
      return null;
    }
    return { ...EMPTY_CUSTOMER_DISPLAY_SNAPSHOT, ...parsed } as CustomerDisplaySnapshot;
  } catch {
    return null;
  }
}
