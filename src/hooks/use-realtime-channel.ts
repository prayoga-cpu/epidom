"use client";

import { useEffect, useRef } from "react";
import { getPusherClient, isRealtimeConfiguredClient } from "@/lib/realtime/pusher-client";
import { storeDataChannel } from "@/lib/realtime/channels";

type EventHandlers = Record<string, (data: unknown) => void>;

// Multiple hooks (materials, products, recipes, stock, POS orders/menu) all
// subscribe to the same per-store data channel by design (one channel per
// store, distinguished by event name — see channels.ts). pusher-js's
// unsubscribe() tears the channel down for every listener, not just the
// caller, so this refcounts instead of unsubscribing on every unmount.
const refCounts = new Map<string, number>();

/**
 * Subscribes to a store's realtime data channel for as long as the
 * component is mounted. No-ops entirely when Pusher isn't configured
 * (`NEXT_PUBLIC_PUSHER_KEY` unset) — callers keep their existing polling as
 * the only source of freshness in that case.
 */
export function useRealtimeChannel(storeId: string | undefined | null, handlers: EventHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!storeId || !isRealtimeConfiguredClient()) return;
    const client = getPusherClient();
    if (!client) return;

    const channelName = storeDataChannel(storeId);
    const channel = client.subscribe(channelName);
    refCounts.set(channelName, (refCounts.get(channelName) ?? 0) + 1);

    const bindings = Object.keys(handlersRef.current).map((event) => {
      const fn = (data: unknown) => handlersRef.current[event]?.(data);
      channel.bind(event, fn);
      return { event, fn };
    });

    return () => {
      bindings.forEach(({ event, fn }) => channel.unbind(event, fn));
      const next = (refCounts.get(channelName) ?? 1) - 1;
      if (next <= 0) {
        refCounts.delete(channelName);
        client.unsubscribe(channelName);
      } else {
        refCounts.set(channelName, next);
      }
    };
    // Handlers are read via handlersRef so an inline object literal doesn't
    // force a resubscribe every render — only a real storeId change should.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);
}
