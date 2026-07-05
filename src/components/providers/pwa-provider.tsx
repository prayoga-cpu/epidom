"use client";

import { useEffect } from "react";

export function PwaProvider() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Register in all environments so the app is installable on localhost too
    // (Chrome only fires `beforeinstallprompt` when a SW with a fetch handler is
    // registered). On localhost the SW passes requests through without caching
    // (see public/sw.js) so it never interferes with dev HMR.
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.error("[SW] Registration failed:", err));
  }, []);

  // Capture the install prompt globally (once, at the root) so any usePwaInstall
  // consumer can read it regardless of when it mounts — the event may fire before
  // a given install button is on screen.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__pwaPromptEvent = e as (typeof window)["__pwaPromptEvent"];
      window.dispatchEvent(new Event("pwa-prompt-available"));
    };
    const onInstalled = () => {
      window.__pwaPromptEvent = null;
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return null;
}
