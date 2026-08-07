import webpush from "web-push";
import { prisma } from "@/lib/prisma";

/**
 * Fire-and-forget OS-level Web Push for a store's subscribed devices.
 *
 * Mirrors `src/lib/realtime/publish.ts`'s graceful-degradation pattern:
 * never throws and never blocks the caller on delivery, silently no-ops
 * until the operator sets the `VAPID_*` env vars (AGENTS.md "Graceful
 * Degradation"). Delivery is fanned out by storeId, not userId — a shared
 * shop device can be operated by a staff PIN persona with no User.id of
 * its own (see src/lib/api-handler.ts), so every subscribed device for the
 * store receives the push regardless of who's currently punched in.
 */

let vapidConfigured: boolean | undefined;
let warnedOnce = false;

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT
  );
}

function ensureVapidConfigured(): boolean {
  if (vapidConfigured !== undefined) return vapidConfigured;

  if (!isPushConfigured()) {
    vapidConfigured = false;
    return vapidConfigured;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  vapidConfigured = true;
  return vapidConfigured;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export function sendPushToStore(storeId: string, payload: PushPayload): void {
  if (!ensureVapidConfigured()) {
    if (!warnedOnce && process.env.NODE_ENV === "development") {
      warnedOnce = true;
      console.warn(
        "[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT not set — web push disabled, falling back to polling. See docs/ENVIRONMENT.md."
      );
    }
    return;
  }

  void deliver(storeId, payload).catch((err) => {
    console.error(`[push] delivery failed for store=${storeId}:`, err);
  });
}

async function deliver(storeId: string, payload: PushPayload): Promise<void> {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { storeId } });
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);
  const deadIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 404/410 = the push service says this subscription is dead (expired,
        // unsubscribed on the device, or the browser rotated it) — iOS Safari
        // rotates/expires these more aggressively than Chrome, so cleaning up
        // here is what keeps this table from accumulating stale endpoints.
        if (statusCode === 404 || statusCode === 410) {
          deadIds.push(sub.id);
        } else {
          console.error(`[push] send failed (store=${storeId}, subscription=${sub.id}):`, err);
        }
      }
    })
  );

  if (deadIds.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: deadIds } } })
      .catch((err) => console.error("[push] cleanup of dead subscriptions failed:", err));
  }
}
