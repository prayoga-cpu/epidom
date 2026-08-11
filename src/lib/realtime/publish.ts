import { getPusherServer, isRealtimeConfigured } from "@/lib/realtime/pusher-server";
import { storeDataChannel, REALTIME_EVENTS, type RealtimeEvent } from "@/lib/realtime/channels";

let warnedOnce = false;

/**
 * Fire-and-forget push notification for a store-scoped data change.
 *
 * Never throws and never blocks the caller on delivery — matches the
 * existing house pattern for non-critical side effects (see
 * `inngest.send()` call sites), so a Pusher outage or missing config can
 * never fail an order/stock/material write. Silently no-ops until the
 * operator sets the `PUSHER_*` env vars (AGENTS.md "Graceful Degradation").
 */
export function publishStoreEvent(
  storeId: string,
  event: RealtimeEvent,
  payload: Record<string, unknown>
): void {
  if (!isRealtimeConfigured()) {
    if (!warnedOnce && process.env.NODE_ENV === "development") {
      warnedOnce = true;
      console.warn(
        "[realtime] PUSHER_APP_ID/KEY/SECRET/CLUSTER not set — live push disabled, falling back to polling. See docs/ENVIRONMENT.md."
      );
    }
    return;
  }

  const pusher = getPusherServer();
  if (!pusher) return;

  pusher.trigger(storeDataChannel(storeId), event, payload).catch((err) => {
    console.error(`[realtime] publish failed (${event}, store=${storeId}):`, err);
  });
}

/**
 * Fan out one STOCK_CHANGED event per entity whose stock just moved.
 *
 * Exists so the next person writing a stock mutation can't forget the push.
 * Forgetting is invisible in review and in manual testing of the page you're
 * on: the DB write is correct, only *other* mounted views go stale until the
 * 30s `refetchInterval` safety-net poll catches up. Production batches and
 * waste entries both shipped without it for exactly that reason.
 *
 * Call it immediately AFTER the transaction resolves, never inside the
 * `$transaction` callback — a rolled-back write must not have told every
 * connected client to go refetch a change that never happened.
 *
 * Same fire-and-forget, never-throwing contract as `publishStoreEvent`, and
 * emits the identical `{ action: "updated", entityId }` payload the stock
 * listeners already expect.
 */
export function publishStockChanged(
  storeId: string,
  entities: { materialIds?: readonly string[]; productIds?: readonly string[] }
): void {
  // Deduped so a material appearing twice in one recipe (or a product on two
  // order lines) doesn't push the same "go refetch" twice.
  const entityIds = new Set([...(entities.materialIds ?? []), ...(entities.productIds ?? [])]);

  for (const entityId of entityIds) {
    publishStoreEvent(storeId, REALTIME_EVENTS.STOCK_CHANGED, { action: "updated", entityId });
  }
}
