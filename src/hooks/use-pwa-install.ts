"use client";

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    // Stashed by the early capture script in the root layout (src/app/layout.tsx)
    // so the prompt survives even if it fires before React hydrates.
    __pwaPromptEvent?: BeforeInstallPromptEvent | null;
  }
}

export function usePwaInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detect if already running as an installed PWA
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari iOS
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Seed from the early-capture stash in case beforeinstallprompt already fired
    if (window.__pwaPromptEvent) setPromptEvent(window.__pwaPromptEvent);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__pwaPromptEvent = e as BeforeInstallPromptEvent;
      setPromptEvent(e as BeforeInstallPromptEvent);
    };

    const onAvailable = () => {
      if (window.__pwaPromptEvent) setPromptEvent(window.__pwaPromptEvent);
    };

    const onAppInstalled = () => {
      window.__pwaPromptEvent = null;
      setIsInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("pwa-prompt-available", onAvailable);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("pwa-prompt-available", onAvailable);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      window.__pwaPromptEvent = null;
      setIsInstalled(true);
      setPromptEvent(null);
    }
  };

  // Native prompt is available (browser surfaced beforeinstallprompt) and not installed.
  const canInstall = !!promptEvent && !isStandalone && !isInstalled;

  return { canInstall, isStandalone, install };
}
