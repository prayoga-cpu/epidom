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
  discountAmount: number;
  discountReason: string | null;
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
   * The one thing that travels the other way, display -> cashier: a number
   * the customer typed themselves so their receipt can reach them on
   * WhatsApp. It lands in the checkout form's phone field rather than being
   * saved anywhere directly — the cashier still sees it, and still decides
   * whether the order is created. `null` clears a number entered by mistake.
   *
   * E.164 (e.g. "+6281234567890"), validated on the display before it is
   * sent, so the cashier's form never receives something it would reject.
   */
  | { type: "customer-phone"; phone: string | null };

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
  total: 0,
  paidOrderNumber: null,
  updatedAt: 0,
};

export function toCustomerDisplayLines(items: CartItem[]): CustomerDisplayLine[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
    modifiers: item.modifiers.map((modifier) => modifier.optionName),
    notes: item.notes,
  }));
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
