"use client";

import PusherClient from "pusher-js";

/**
 * Browser-side Pusher singleton. Mirrors `pusher-server.ts`'s graceful
 * degradation: `getPusherClient()` returns `null` when the operator hasn't
 * set `NEXT_PUBLIC_PUSHER_KEY`/`NEXT_PUBLIC_PUSHER_CLUSTER` yet, and every
 * hook built on top of this must treat that as "stay on polling," not throw.
 */

let cached: PusherClient | null | undefined;

export function isRealtimeConfiguredClient(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_CLUSTER);
}

export function getPusherClient(): PusherClient | null {
  if (typeof window === "undefined") return null;
  if (cached !== undefined) return cached;

  if (!isRealtimeConfiguredClient()) {
    cached = null;
    return cached;
  }

  cached = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    authEndpoint: "/api/pusher/auth",
    // Staff PIN sessions and owner sessions both ride on httpOnly cookies —
    // same-origin fetch sends them by default, no extra auth wiring needed.
  });
  return cached;
}
