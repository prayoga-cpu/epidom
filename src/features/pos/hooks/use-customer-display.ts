"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { create } from "zustand";
import { useOnlineStatus } from "@/hooks/use-network-status";
import { ApiClientError } from "@/lib/api/client";
import { usePosCart } from "./use-pos-cart";
import { useCustomerDisplaySettings } from "./use-customer-display-settings";
import { createCustomer, findCustomerByPhone, toCartCustomer } from "./use-customers";
import {
  CUSTOMER_DETAILS_NAME_MAX,
  CUSTOMER_DISPLAY_PAID_MS,
  EMPTY_CUSTOMER_DISPLAY_SNAPSHOT,
  buildCustomerDisplayBuildingSnapshot,
  customerDisplayChannelName,
  customerDisplaySnapshotKey,
  firstNameOf,
  isPlausibleEmail,
  parseCustomerDisplaySnapshot,
  resolveHighlight,
  toCustomerDisplayLines,
  type CustomerDisplayHighlight,
  type CustomerDisplayIntakeStatus,
  type CustomerDisplayLine,
  type CustomerDisplayMatch,
  type CustomerDisplayMessage,
  type CustomerDisplaySnapshot,
} from "../lib/customer-display";

/**
 * The just-settled order, held briefly so the customer display can show a
 * thank-you before idling.
 *
 * Deliberately a separate store from the cart: checkout clears the cart the
 * moment the order is created, so a "paid" flag living on the cart would be
 * wiped by the very action it's meant to announce. Not persisted — a
 * thank-you screen has no business surviving a reload.
 */
interface CustomerDisplayPaidState {
  orderNumber: string | null;
  total: number;
  /** Epoch ms the order settled; 0 when there's nothing to show. */
  at: number;
  markPaid: (orderNumber: string, total: number) => void;
  clearPaid: () => void;
}

export const useCustomerDisplayPaid = create<CustomerDisplayPaidState>()((set) => ({
  orderNumber: null,
  total: 0,
  at: 0,
  markPaid: (orderNumber, total) => set({ orderNumber, total, at: Date.now() }),
  clearPaid: () => set({ orderNumber: null, total: 0, at: 0 }),
}));

/** Call from checkout right before clearing the cart. */
export function markCustomerDisplayPaid(orderNumber: string, total: number): void {
  useCustomerDisplayPaid.getState().markPaid(orderNumber, total);
}

/** The cashier window saving a new customer the display submitted. */
export type CustomerAutoSave = "idle" | "saving" | "saved" | "failed";

/**
 * What the customer has told the till from the customer-facing screen — their
 * WhatsApp number, and, if the number turned out to be new, an optional name and
 * email — waiting to be picked up by the cashier's customer row and by checkout.
 *
 * The customer display itself can't create an order, can't change a total, and
 * can't write to the database. What it sends lands here; the cashier's window
 * acts on it — attaching a returning customer, and saving a new one once they
 * press Done (useCustomerIntakeResolver) — and the cashier still sees it all
 * and still confirms the sale. Not persisted, and cleared once the order is
 * placed so the next customer never inherits it.
 */
interface CustomerIntakeState {
  /** E.164, or null when nothing is pending. */
  phone: string | null;
  /** Optional, typed by a NEW customer after giving their number. */
  name: string;
  email: string;
  /** What the till found for `phone`; null until the lookup answers. */
  match: CustomerDisplayMatch | null;
  /** Bumped on every number submission so a consumer can tell "the customer
   * just entered a number" from "the same number is still sitting here" — the
   * cashier closing the new-customer form must not have it spring back open. */
  receivedAt: number;
  /** The `receivedAt` the cashier's new-customer form last opened for. Lives here
   * rather than in the component so leaving the POS page and coming back doesn't
   * re-open a form the cashier already dealt with. */
  formOpenedFor: number;
  /** The `receivedAt` the customer pressed Done (or Skip) for — their details are final. */
  submittedFor: number;
  /** The `receivedAt` whose new-customer form the cashier took over (typed in it, or
   * dismissed it): theirs to save by hand, so it is not saved for them. */
  takenOverFor: number;
  /** Saving the submitted new customer; `idle` until a submission is being saved. */
  autoSave: CustomerAutoSave;
  setPhone: (phone: string | null) => void;
  setDetails: (name: string, email: string) => void;
  /** The customer finished: set the details one last time and mark them final. */
  submitDetails: (name: string, email: string) => void;
  setMatch: (match: CustomerDisplayMatch | null) => void;
  markFormOpened: (receivedAt: number) => void;
  markTakenOver: (receivedAt: number) => void;
  setAutoSave: (autoSave: CustomerAutoSave) => void;
  clear: () => void;
}

function cleanDetails(name: unknown, email: unknown): { name: string; email: string } {
  const cleanEmail = String(email ?? "").trim();
  return {
    name: String(name ?? "")
      .trim()
      .slice(0, CUSTOMER_DETAILS_NAME_MAX),
    email: isPlausibleEmail(cleanEmail) ? cleanEmail : "",
  };
}

const EMPTY_INTAKE = {
  phone: null,
  name: "",
  email: "",
  match: null,
  receivedAt: 0,
  formOpenedFor: 0,
  submittedFor: 0,
  takenOverFor: 0,
  autoSave: "idle",
} as const;

export const useCustomerIntake = create<CustomerIntakeState>()((set, get) => ({
  ...EMPTY_INTAKE,
  setPhone: (phone) => {
    const current = get();
    // A different number is a different person: whatever name/email and lookup
    // result the last one had must not follow it. The same number re-submitted
    // keeps them, so a customer confirming twice doesn't lose what they typed.
    const sameNumber = phone !== null && phone === current.phone;
    set({
      phone,
      receivedAt: Math.max(Date.now(), current.receivedAt + 1),
      // A new submission: whatever the last one's save did is not about this one.
      autoSave: "idle",
      ...(sameNumber ? {} : { name: "", email: "", match: null }),
    });
  },
  // Re-validated here as well as on the display: this arrives over a channel
  // and lands in a customer record about to be saved, so it is not taken on trust.
  setDetails: (name, email) => set(cleanDetails(name, email)),
  submitDetails: (name, email) =>
    set({ ...cleanDetails(name, email), submittedFor: get().receivedAt }),
  setMatch: (match) => set({ match }),
  markFormOpened: (receivedAt) => set({ formOpenedFor: receivedAt }),
  markTakenOver: (receivedAt) => set({ takenOverFor: receivedAt }),
  setAutoSave: (autoSave) => set({ autoSave }),
  clear: () => set({ ...EMPTY_INTAKE }),
}));

/** Clears whatever the customer entered — call once an order is created. */
export function clearCustomerIntake(): void {
  useCustomerIntake.getState().clear();
}

function writeSnapshot(storeId: string, snapshot: CustomerDisplaySnapshot): void {
  try {
    window.localStorage.setItem(customerDisplaySnapshotKey(storeId), JSON.stringify(snapshot));
  } catch {
    // Private mode / quota. The BroadcastChannel path still works; only the
    // cold-start paint of a newly opened display window is lost.
  }
}

/**
 * Cashier side. Mirrors the cart onto the customer display on every change,
 * and answers a display window that asks for the current state on mount.
 * Mount once, from the POS shell.
 *
 * Does nothing while the customer display is switched off, beyond publishing
 * a single `off` snapshot on the way down so a display window left open from
 * before goes to standby rather than freezing on the last order it saw.
 */
export function useCustomerDisplayPublisher(storeId: string): void {
  // Answers the display's "who is this number?" — mounted here so it lives as
  // long as the publisher does, wherever on the POS the cashier happens to be.
  useCustomerIntakeResolver(storeId);

  const enabled = useCustomerDisplaySettings((state) => state.enabled);
  const items = usePosCart((state) => state.items);
  const subtotal = usePosCart((state) => state.subtotal);
  const tax = usePosCart((state) => state.tax);
  const serviceCharge = usePosCart((state) => state.serviceCharge);
  const discountAmount = usePosCart((state) => state.discountAmount);
  const discountReason = usePosCart((state) => state.discountReason);
  // discountAmount already includes the value of redeemed points; these two
  // ride along (additively) so the display can break the line in two.
  const pointsRedeemed = usePosCart((state) => state.pointsRedeemed);
  const pointsDiscountAmount = usePosCart((state) => state.pointsDiscountAmount);
  const total = usePosCart((state) => state.total);

  const paidAt = useCustomerDisplayPaid((state) => state.at);
  const paidOrderNumber = useCustomerDisplayPaid((state) => state.orderNumber);
  const paidTotal = useCustomerDisplayPaid((state) => state.total);
  const clearPaid = useCustomerDisplayPaid((state) => state.clearPaid);

  const previousLinesRef = useRef<CustomerDisplayLine[]>([]);
  const highlightRef = useRef<CustomerDisplayHighlight | null>(null);
  /** Latest published snapshot, so a "request" from a display window opened
   * later can be answered without recomputing it. */
  const snapshotRef = useRef<CustomerDisplaySnapshot>(EMPTY_CUSTOMER_DISPLAY_SNAPSHOT);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(customerDisplayChannelName(storeId));
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<CustomerDisplayMessage>) => {
      if (event.data?.type === "request") {
        channel.postMessage({ type: "state", snapshot: snapshotRef.current });
        return;
      }
      // Straight into a store the cashier's customer row and checkout read —
      // never written to the cart or the server from here (the resolver below
      // decides what to do with it).
      if (event.data?.type === "customer-phone") {
        useCustomerIntake.getState().setPhone(event.data.phone);
      } else if (event.data?.type === "customer-details") {
        useCustomerIntake.getState().setDetails(event.data.name, event.data.email);
      } else if (event.data?.type === "customer-submit") {
        useCustomerIntake.getState().submitDetails(event.data.name, event.data.email);
      }
    };

    // A cashier window that goes away without saying so would leave the last
    // order frozen on the customer's screen indefinitely — the display has no
    // way to tell "still being rung up" from "nobody is driving this any
    // more". pagehide fires on a real close/unload but NOT on a client-side
    // route change, which is exactly the distinction wanted: stepping over to
    // the order queue re-mounts this publisher a moment later, closing the
    // till does not.
    const sayGoodbye = () => {
      const farewell: CustomerDisplaySnapshot = {
        ...EMPTY_CUSTOMER_DISPLAY_SNAPSHOT,
        phase: "off",
        updatedAt: Date.now(),
      };
      writeSnapshot(storeId, farewell);
      channel.postMessage({ type: "state", snapshot: farewell });
    };
    window.addEventListener("pagehide", sayGoodbye);

    return () => {
      window.removeEventListener("pagehide", sayGoodbye);
      channel.close();
      channelRef.current = null;
    };
  }, [storeId]);

  // Expiring the paid hold is its own effect, deliberately independent of the
  // cart and of the on/off switch. Arming it inside the publish effect meant
  // an ordinary cart tap re-armed it, and the `!enabled` early return
  // cancelled it outright — stranding `paidAt` set, so re-enabling within the
  // window resurrected the previous customer's settled order.
  useEffect(() => {
    if (paidAt === 0) return;
    // The next order has started. Whatever the timer had left, the previous
    // customer's thank-you is over.
    if (items.length > 0) {
      clearPaid();
      return;
    }
    const remaining = CUSTOMER_DISPLAY_PAID_MS - (Date.now() - paidAt);
    if (remaining <= 0) {
      clearPaid();
      return;
    }
    const timer = setTimeout(clearPaid, remaining);
    return () => clearTimeout(timer);
  }, [paidAt, items, clearPaid]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const lines = toCustomerDisplayLines(items);

    if (!enabled) {
      // Publish `off` once on the way down, not on every subsequent cart tap:
      // this effect's deps include the whole cart, so an unguarded write here
      // re-serialized and re-broadcast an identical snapshot on every tap.
      if (snapshotRef.current.phase !== "off") {
        const offSnapshot: CustomerDisplaySnapshot = {
          ...EMPTY_CUSTOMER_DISPLAY_SNAPSHOT,
          phase: "off",
          updatedAt: Date.now(),
        };
        snapshotRef.current = offSnapshot;
        writeSnapshot(storeId, offSnapshot);
        channelRef.current?.postMessage({ type: "state", snapshot: offSnapshot });
      }
      // Keep the diff baseline in step with the cart while off (rather than
      // emptying it): switching back on must not announce lines the customer
      // never watched arrive as "just added".
      previousLinesRef.current = lines;
      highlightRef.current = null;
      return;
    }

    // Tracked even while the thank-you is up, so the diff stays honest for
    // whatever the cashier rings up next.
    const highlight = resolveHighlight(previousLinesRef.current, lines, highlightRef.current);
    previousLinesRef.current = lines;
    highlightRef.current = highlight;

    const paidRemaining = paidAt > 0 ? CUSTOMER_DISPLAY_PAID_MS - (Date.now() - paidAt) : 0;
    // The thank-you holds the screen only while the till is genuinely idle.
    // Without the emptiness check, items rung up for the NEXT customer were
    // swallowed for the rest of the window while the previous customer's
    // total and order number stayed up — the worst thing this screen can do.
    const showPaid = paidRemaining > 0 && lines.length === 0;

    const snapshot: CustomerDisplaySnapshot = showPaid
      ? {
          ...EMPTY_CUSTOMER_DISPLAY_SNAPSHOT,
          phase: "paid",
          total: paidTotal,
          paidOrderNumber,
          updatedAt: Date.now(),
        }
      : buildCustomerDisplayBuildingSnapshot({
          lines,
          highlight,
          totals: {
            subtotal,
            tax,
            serviceCharge,
            discountAmount,
            discountReason,
            pointsRedeemed,
            pointsDiscountAmount,
            total,
          },
          updatedAt: Date.now(),
        });

    snapshotRef.current = snapshot;
    writeSnapshot(storeId, snapshot);
    channelRef.current?.postMessage({ type: "state", snapshot });
  }, [
    enabled,
    storeId,
    items,
    subtotal,
    tax,
    serviceCharge,
    discountAmount,
    discountReason,
    pointsRedeemed,
    pointsDiscountAmount,
    total,
    paidAt,
    paidOrderNumber,
    paidTotal,
  ]);
}

/** Detaches a member this flow attached, unless the cashier has since changed the customer. */
function releaseAutoAttach(attachedId: MutableRefObject<string | null>): void {
  const id = attachedId.current;
  attachedId.current = null;
  if (!id) return;
  const cart = usePosCart.getState();
  if (cart.customer?.id === id) cart.setCustomer(null);
}

/**
 * Cashier side. Answers the customer display's "are you already a member?".
 *
 * When a number arrives from the customer screen it is looked up in this
 * store's customers (here, in the cashier window — the display never queries
 * the customer list itself, so nothing about anyone but a first name can reach
 * a screen a stranger may be typing into):
 *  - a member is attached to the sale, but only onto an EMPTY sale or onto a
 *    member this same flow attached. The cashier's own pick is never
 *    overwritten, and a customer correcting a mistyped number swaps the match
 *    rather than stacking one on the other;
 *  - a number nobody owns is reported as `new`, which is what makes the
 *    cashier's new-customer form open with it (see PosCartCustomer); once the
 *    customer presses Done on the display they are saved as a customer and
 *    attached here, so the cashier never has to press Save — under the same
 *    empty-sale rule, and not if the cashier took that form over themselves;
 *  - a lookup that cannot run (offline, or it failed) is `unknown` — reported,
 *    never guessed at.
 * The same channel carries the result back so the display can react to it.
 * Mount once, from the publisher.
 */
export function useCustomerIntakeResolver(storeId: string): void {
  const phone = useCustomerIntake((state) => state.phone);
  const receivedAt = useCustomerIntake((state) => state.receivedAt);
  const match = useCustomerIntake((state) => state.match);
  const submittedFor = useCustomerIntake((state) => state.submittedFor);
  const takenOverFor = useCustomerIntake((state) => state.takenOverFor);
  const cartCustomerPhone = usePosCart((state) => state.customer?.phone ?? null);
  const cartCustomerName = usePosCart((state) => state.customer?.name ?? null);
  const online = useOnlineStatus();

  const channelRef = useRef<BroadcastChannel | null>(null);
  /** The member this flow attached to the sale, so it can be detached again. */
  const autoAttachedRef = useRef<string | null>(null);
  const lastPhoneRef = useRef<string | null>(null);
  /** The submission already saved (or being saved), so each is saved once. */
  const savedForRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(customerDisplayChannelName(storeId));
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [storeId]);

  const report = useCallback((status: CustomerDisplayIntakeStatus) => {
    channelRef.current?.postMessage({ type: "customer-status", status });
  }, []);

  // `receivedAt` is a dependency on purpose: the same number confirmed twice is
  // looked up twice, so a reopened display gets a fresh answer.
  useEffect(() => {
    if (!phone) {
      releaseAutoAttach(autoAttachedRef);
      lastPhoneRef.current = null;
      return;
    }
    if (lastPhoneRef.current !== phone) {
      // A different number: whoever the last one matched no longer applies.
      releaseAutoAttach(autoAttachedRef);
      lastPhoneRef.current = phone;
    }

    const { setMatch } = useCustomerIntake.getState();
    const answer = (result: CustomerDisplayMatch, firstName: string | null) => {
      setMatch(result);
      report({ phone, match: result, firstName });
    };

    if (!online) {
      answer("unknown", null);
      return;
    }

    let cancelled = false;
    findCustomerByPhone(storeId, phone).then(
      (member) => {
        if (cancelled) return;
        if (!member) {
          answer("new", null);
          return;
        }
        const cart = usePosCart.getState();
        if (!cart.customer || cart.customer.id === autoAttachedRef.current) {
          cart.setCustomer(toCartCustomer(member));
          autoAttachedRef.current = member.id;
        }
        answer("existing", firstNameOf(member.name, member.phone));
      },
      () => {
        if (!cancelled) answer("unknown", null);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [phone, receivedAt, online, storeId, report]);

  // The customer pressed Done on the display and their number is new: save them
  // and attach them to the sale, instead of leaving the form for the cashier to
  // save. Waits for BOTH — a customer quick enough to finish before the lookup
  // answers is saved when it does. Never over the cashier's own pick (the sale
  // must be empty), once per submission, and not for a form the cashier took
  // over: that one is theirs to save.
  useEffect(() => {
    if (!phone || match !== "new" || !online) return;
    if (submittedFor !== receivedAt || takenOverFor === receivedAt) return;
    if (savedForRef.current === receivedAt) return;
    savedForRef.current = receivedAt;
    // Someone is already on the sale: the cashier chose them, leave it be.
    if (usePosCart.getState().customer) return;

    const intake = useCustomerIntake.getState();
    intake.setAutoSave("saving");
    // Deliberately not cancelled on re-run — attaching flips `match`, which
    // re-runs this. Instead the answer is dropped if it is no longer about this
    // submission: the customer changed their number, or the order was placed.
    const stillCurrent = () => useCustomerIntake.getState().receivedAt === receivedAt;

    createCustomer(storeId, {
      // Optional: a customer given only a number is named after it server-side.
      name: intake.name || undefined,
      phone,
      email: intake.email || undefined,
    })
      .catch(async (error: unknown) => {
        // Saved a moment ago from elsewhere (another till, the cashier's own
        // form): attach that record rather than fail.
        if (error instanceof ApiClientError && error.status === 409) {
          const member = await findCustomerByPhone(storeId, phone);
          if (member) return member;
        }
        throw error;
      })
      .then(
        (saved) => {
          if (!stillCurrent()) return;
          const cart = usePosCart.getState();
          if (!cart.customer) {
            cart.setCustomer(toCartCustomer(saved));
            autoAttachedRef.current = saved.id;
          }
          useCustomerIntake.getState().setAutoSave("saved");
        },
        () => {
          // The prepared form is still there for the cashier to save by hand.
          if (stillCurrent()) useCustomerIntake.getState().setAutoSave("failed");
        }
      );
  }, [phone, match, receivedAt, submittedFor, takenOverFor, online, storeId]);

  // The cashier saved the new customer (or picked them) while the display was
  // still waiting on the optional step: the number now belongs to a customer, so
  // tell the display to move on to the welcome rather than sit on a form the
  // till has already used.
  useEffect(() => {
    if (!phone || match === "existing" || match === null) return;
    if (cartCustomerPhone !== phone) return;
    useCustomerIntake.getState().setMatch("existing");
    report({ phone, match: "existing", firstName: firstNameOf(cartCustomerName, phone) });
  }, [phone, match, cartCustomerPhone, cartCustomerName, report]);
}

/**
 * Display side. Reads the mirrored snapshot for an immediate first paint,
 * then follows the cashier window live.
 */
export function useCustomerDisplaySnapshot(storeId: string): CustomerDisplaySnapshot {
  const [snapshot, setSnapshot] = useState<CustomerDisplaySnapshot>(
    EMPTY_CUSTOMER_DISPLAY_SNAPSHOT
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Never move backwards in time: the localStorage mirror, a `storage`
    // event and a broadcast can all land out of order (this window may have
    // been backgrounded), and the newest write is always the truth.
    const accept = (next: CustomerDisplaySnapshot | null) => {
      if (!next) return;
      setSnapshot((current) => (next.updatedAt >= current.updatedAt ? next : current));
    };

    try {
      accept(
        parseCustomerDisplaySnapshot(
          window.localStorage.getItem(customerDisplaySnapshotKey(storeId))
        )
      );
    } catch {
      // Private mode — the channel below still delivers the live state.
    }

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(customerDisplayChannelName(storeId));
      channel.onmessage = (event: MessageEvent<CustomerDisplayMessage>) => {
        if (event.data?.type === "state") accept(event.data.snapshot);
      };
      // Broadcasts aren't replayed, so ask the cashier window for the state
      // it published before this window existed.
      channel.postMessage({ type: "request" });
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== customerDisplaySnapshotKey(storeId)) return;
      accept(parseCustomerDisplaySnapshot(event.newValue));
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      channel?.close();
      window.removeEventListener("storage", handleStorage);
    };
  }, [storeId]);

  // If the cashier window closes (or reloads) mid-thank-you, nothing will
  // ever publish the follow-up idle snapshot — so expire it here too rather
  // than leaving "Thank you" frozen on the customer's screen.
  useEffect(() => {
    if (snapshot.phase !== "paid") return;
    const remaining = Math.max(0, CUSTOMER_DISPLAY_PAID_MS - (Date.now() - snapshot.updatedAt));
    const timer = setTimeout(() => {
      setSnapshot((current) =>
        current.phase === "paid"
          ? { ...EMPTY_CUSTOMER_DISPLAY_SNAPSHOT, updatedAt: current.updatedAt + 1 }
          : current
      );
    }, remaining);
    return () => clearTimeout(timer);
  }, [snapshot.phase, snapshot.updatedAt]);

  return snapshot;
}

/**
 * Display side. The customer's half of the intake conversation, on one channel:
 * hands the number (and later the optional name / email) they typed to the
 * cashier window, and hears back what the till found for that number.
 *
 * Its own channel rather than reusing the snapshot subscriber's: the two have
 * different lifetimes, and BroadcastChannel does not deliver a window its own
 * messages, so there is no risk of the display hearing itself.
 */
export function useCustomerIntakeChannel(storeId: string): {
  status: CustomerDisplayIntakeStatus | null;
  /** Bumped each time the cashier asks for the customer's details; 0 = never. */
  askedAt: number;
  sendPhone: (phone: string | null) => void;
  sendDetails: (name: string, email: string) => void;
  /** The customer pressed Done (or Skip): the details are final, and a new customer gets saved. */
  submitDetails: (name: string, email: string) => void;
} {
  const [status, setStatus] = useState<CustomerDisplayIntakeStatus | null>(null);
  const [askedAt, setAskedAt] = useState(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(customerDisplayChannelName(storeId));
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<CustomerDisplayMessage>) => {
      if (event.data?.type === "customer-status") setStatus(event.data.status);
      else if (event.data?.type === "ask-details") setAskedAt(Date.now());
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [storeId]);

  const sendPhone = useCallback((phone: string | null) => {
    // An answer already held is for a number that is no longer the current one.
    setStatus(null);
    channelRef.current?.postMessage({ type: "customer-phone", phone });
  }, []);

  const sendDetails = useCallback((name: string, email: string) => {
    channelRef.current?.postMessage({ type: "customer-details", name, email });
  }, []);

  const submitDetails = useCallback((name: string, email: string) => {
    channelRef.current?.postMessage({ type: "customer-submit", name, email });
  }, []);

  return { status, askedAt, sendPhone, sendDetails, submitDetails };
}

/**
 * Cashier side: open the details form on the customer display ("please enter
 * your WhatsApp number"). Fire-and-forget over the same channel the display
 * already listens on; a display that isn't open simply never hears it.
 */
export function askCustomerForDetails(storeId: string): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(customerDisplayChannelName(storeId));
  channel.postMessage({ type: "ask-details" } satisfies CustomerDisplayMessage);
  channel.close();
}
