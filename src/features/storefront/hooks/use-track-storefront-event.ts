"use client";

import { useEffect, useRef } from "react";

export type StorefrontEventType = "VIEW" | "MENU_VIEW" | "ITEM_VIEW" | "WHATSAPP_CLICK";

interface TrackEventExtra {
  menuItemId?: string;
  menuItemName?: string;
}

/**
 * Fire-and-forget analytics beacon for the public storefront. Never throws,
 * never awaited by the caller — an analytics hiccup must never affect the
 * public page a customer is trying to use.
 */
export function trackEvent(slug: string, type: StorefrontEventType, extra?: TrackEventExtra) {
  try {
    fetch(`/api/public/storefront/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...extra }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore — analytics must never block the public page
  }
}

/** Fires one page-view-shaped event on mount, guarded against React 19 dev double-invoke. */
export function useTrackPageView(
  slug: string,
  type: Extract<StorefrontEventType, "VIEW" | "MENU_VIEW" | "ITEM_VIEW">,
  extra?: TrackEventExtra
) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    trackEvent(slug, type, extra);
    // Intentionally fires once per mount only — `extra` (menuItemId/Name) is
    // stable for the lifetime of a given page render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, type]);
}
