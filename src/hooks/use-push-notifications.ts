"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { usePwaInstall } from "./use-pwa-install";

export type PushState =
  | "unsupported"
  | "ios-not-installed"
  | "default"
  | "subscribing"
  | "subscribed"
  | "denied";

// Uint8Array<ArrayBuffer> (not the ArrayBufferLike-generic default) so this
// satisfies PushManager.subscribe's applicationServerKey: BufferSource typing.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

/**
 * iOS Safari gates the entire Push API behind Home Screen install — outside
 * of standalone mode, `window.PushManager` is simply undefined there. Chrome
 * and Firefox on iOS are WebKit-based too and share that same restriction,
 * so this only needs to distinguish "iOS" from "not iOS," not per-browser.
 */
function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

/**
 * Web Push (OS-level browser notifications) subscribe/unsubscribe for a
 * store. Mirrors the rest of the realtime layer's "no-op gracefully when
 * unsupported/unconfigured" spirit — see src/lib/realtime/publish.ts.
 *
 * `state` covers every branch a merchant's device can land in, notably the
 * two that must NOT be conflated: `ios-not-installed` (fixable — add to
 * Home Screen) vs `unsupported` (not fixable on this browser/OS at all) vs
 * `denied` (permission already refused — browsers never re-prompt, so the
 * UI must not offer a retry button that will silently no-op).
 */
export function usePushNotifications(storeId: string | undefined) {
  const { isStandalone } = usePwaInstall();
  const [state, setState] = useState<PushState>("default");

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;

    // Check iOS-not-installed BEFORE the generic support check below — on
    // iOS Safari outside Home Screen install, "PushManager" in window is
    // false too, which would otherwise show a dead-end "unsupported"
    // instead of the actionable "install to Home Screen" hint.
    if (isIos() && !isStandalone) {
      setState("ios-not-installed");
      return;
    }

    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      !!vapidPublicKey;
    if (!supported) {
      setState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setState(existing ? "subscribed" : "default");
    } catch {
      setState("default");
    }
  }, [isStandalone, vapidPublicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!storeId || !vapidPublicKey) return;
    setState("subscribing");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = subscription.toJSON();
      await apiClient.post(`/stores/${storeId}/push/subscribe`, {
        endpoint: json.endpoint,
        keys: json.keys,
      });
      setState("subscribed");
    } catch (err) {
      console.error("[push] subscribe failed:", err);
      setState(Notification.permission === "denied" ? "denied" : "default");
    }
  }, [storeId, vapidPublicKey]);

  const unsubscribe = useCallback(async () => {
    if (!storeId) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await apiClient.delete(`/stores/${storeId}/push/unsubscribe`, { endpoint });
      }
    } catch (err) {
      console.error("[push] unsubscribe failed:", err);
    } finally {
      setState("default");
    }
  }, [storeId]);

  return { state, subscribe, unsubscribe };
}
