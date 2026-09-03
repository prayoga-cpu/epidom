"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { usePosCart } from "./use-pos-cart";
import { useCustomerDisplaySettings } from "./use-customer-display-settings";
import {
  CUSTOMER_DISPLAY_PAID_MS,
  EMPTY_CUSTOMER_DISPLAY_SNAPSHOT,
  customerDisplayChannelName,
  customerDisplaySnapshotKey,
  parseCustomerDisplaySnapshot,
  resolveHighlight,
  toCustomerDisplayLines,
  type CustomerDisplayHighlight,
  type CustomerDisplayLine,
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

/**
 * A phone number the customer entered on the customer-facing screen, waiting
 * to be picked up by the checkout form.
 *
 * Deliberately only a suggestion: it prefills the cashier's phone field and
 * nothing else. The customer display can't create an order, can't change a
 * total, and can't write to the database — the cashier still reviews the
 * number and still confirms the order. Not persisted, and cleared once the
 * order is placed so the next customer never inherits it.
 */
interface CustomerPhoneState {
  /** E.164, or null when nothing is pending. */
  phone: string | null;
  /** Bumped on every submission so checkout can re-apply a number the cashier
   * cleared, without re-applying the same one forever. */
  receivedAt: number;
  setPhone: (phone: string | null) => void;
  clearPhone: () => void;
}

export const useCustomerPhone = create<CustomerPhoneState>()((set) => ({
  phone: null,
  receivedAt: 0,
  setPhone: (phone) => set({ phone, receivedAt: Date.now() }),
  clearPhone: () => set({ phone: null, receivedAt: 0 }),
}));

/** Clears the pending customer number — call once an order is created. */
export function clearCustomerPhone(): void {
  useCustomerPhone.getState().clearPhone();
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
  const enabled = useCustomerDisplaySettings((state) => state.enabled);
  const items = usePosCart((state) => state.items);
  const subtotal = usePosCart((state) => state.subtotal);
  const tax = usePosCart((state) => state.tax);
  const serviceCharge = usePosCart((state) => state.serviceCharge);
  const discountAmount = usePosCart((state) => state.discountAmount);
  const discountReason = usePosCart((state) => state.discountReason);
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
      if (event.data?.type === "customer-phone") {
        // Straight into a store the checkout form reads — never written to
        // the cart or the server from here.
        useCustomerPhone.getState().setPhone(event.data.phone);
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
      : {
          phase: lines.length > 0 ? "building" : "idle",
          lines,
          highlightLineId: highlight?.id ?? null,
          highlightIsNew: highlight?.isNew ?? false,
          subtotal,
          tax,
          serviceCharge,
          discountAmount,
          discountReason,
          total,
          paidOrderNumber: null,
          updatedAt: Date.now(),
        };

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
    total,
    paidAt,
    paidOrderNumber,
    paidTotal,
  ]);
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
      accept(parseCustomerDisplaySnapshot(window.localStorage.getItem(customerDisplaySnapshotKey(storeId))));
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
 * Display side. Returns a function that hands a number the customer typed
 * back to the cashier window.
 *
 * Its own channel rather than reusing the subscriber's: the two have
 * different lifetimes (this one outlives a re-render of the snapshot hook)
 * and BroadcastChannel does not deliver a window its own messages, so there
 * is no risk of the display hearing itself.
 */
export function useSendCustomerPhone(storeId: string): (phone: string | null) => void {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(customerDisplayChannelName(storeId));
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [storeId]);

  return useCallback((phone: string | null) => {
    channelRef.current?.postMessage({ type: "customer-phone", phone });
  }, []);
}
