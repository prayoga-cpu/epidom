import { getPusherServer, isRealtimeConfigured } from "@/lib/realtime/pusher-server";
import { storeDataChannel, type RealtimeEvent } from "@/lib/realtime/channels";

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
