import Pusher from "pusher";

/**
 * Server-side Pusher singleton. Graceful degradation (AGENTS.md §6): the
 * operator hasn't necessarily created a Pusher app yet, so every consumer of
 * this module must treat `getPusherServer()` returning `null` as the normal
 * "not configured" state, not an error — see `publish.ts` and
 * `/api/pusher/auth`.
 */

let cached: Pusher | null | undefined;

export function isRealtimeConfigured(): boolean {
  return Boolean(
    process.env.PUSHER_APP_ID &&
      process.env.PUSHER_KEY &&
      process.env.PUSHER_SECRET &&
      process.env.PUSHER_CLUSTER
  );
}

export function getPusherServer(): Pusher | null {
  if (cached !== undefined) return cached;

  if (!isRealtimeConfigured()) {
    cached = null;
    return cached;
  }

  cached = new Pusher({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.PUSHER_CLUSTER!,
    useTLS: true,
  });
  return cached;
}
