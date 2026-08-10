"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import "@khmyznikov/pwa-install";
import type { PWAInstallElement } from "@khmyznikov/pwa-install";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/components/lang/i18n-provider";
import { useOfflineSyncContext } from "./offline-sync-provider";
import { formatFileSize } from "@/lib/utils/formatting";

type PwaInstallTriggerVariant = "icon" | "full";

/**
 * Shared PWA install + offline-data experience. The install guide itself
 * (screenshots, one-tap install where the browser supports it, manual
 * per-platform steps otherwise) is delegated entirely to `@khmyznikov/
 * pwa-install` — its own dialog, opened via `showDialog()` — instead of the
 * hand-rolled iOS/desktop detection this used to do; the library also owns
 * `isUnderStandaloneMode`, the single source of truth for "already
 * installed" here.
 *
 * Once installed, this renders nothing at all (per operator request) — the
 * trigger button, our own Offline & Sync dialog, everything. Offline Mode
 * is mandatory and un-toggleable once standalone anyway (see
 * useOfflineMode), so there's nothing left to configure post-install.
 */
export function PwaInstallTrigger({ variant }: { variant: PwaInstallTriggerVariant }) {
  const pwaRef = useRef<PWAInstallElement>(null);
  // Defaults to true (hidden) until the element confirms otherwise, so there's
  // no flash of an "Install" button on an already-installed, already-standalone load.
  const [isStandalone, setIsStandalone] = useState(true);
  const { t, formatDateTime } = useI18n();
  const {
    lastSyncedAt,
    isSyncing,
    syncNow,
    offlineModeEnabled,
    isPriming,
    enableOfflineMode,
    disableOfflineMode,
  } = useOfflineSyncContext();
  const [open, setOpen] = useState(false);
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(
    null
  );
  // Which screenshot to show — narrow (phone) vs wide (desktop) — so mobile
  // visitors see a preview that actually looks like what they're about to
  // get, not a desktop screenshot that reads as a different app.
  const [isNarrowViewport, setIsNarrowViewport] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 640px)");
    const onChange = () => setIsNarrowViewport(!mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    // isUnderStandaloneMode is set in the element's connectedCallback — check
    // shortly after mount (not synchronously; the custom element needs a tick
    // to upgrade), and again on visibility change in case install happened
    // via the browser's own UI while this tab was backgrounded.
    const check = () => setIsStandalone(!!pwaRef.current?.isUnderStandaloneMode);
    const id = setTimeout(check, 0);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  useEffect(() => {
    // PwaProvider (mounted at the app root) captures beforeinstallprompt as
    // early as possible and stashes it on window — this component (nested
    // deep in Topbar/Sidebar) can easily mount after that event already
    // fired, since it's dispatched once per page load. Feed the stash into
    // the library's externalPromptEvent property (per its docs, a property
    // set imperatively — not a JSX attribute) so a late mount doesn't miss it.
    if (window.__pwaPromptEvent && pwaRef.current) {
      pwaRef.current.externalPromptEvent = window.__pwaPromptEvent;
    }
  }, []);

  useEffect(() => {
    if (!open || typeof navigator === "undefined" || !navigator.storage?.estimate) return;
    navigator.storage
      .estimate()
      .then((estimate) =>
        setStorageEstimate({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 })
      )
      .catch(() => setStorageEstimate(null));
  }, [open, offlineModeEnabled]);

  // The element stays mounted (hidden) even once installed — it's how
  // isStandalone detection above keeps working across the whole app
  // lifetime — but nothing else renders past this point once standalone.
  // manual-chrome/manual-apple stop the library from auto-popping its own
  // dialog on beforeinstallprompt/Apple detection — this app only ever
  // opens it explicitly, via showDialog() from the button below.
  // use-local-storage persists a user's "not now" dismissal inside the
  // library's own dialog so it doesn't re-nag every visit.
  const pwaInstallElement = (
    <pwa-install
      ref={pwaRef}
      manifest-url="/manifest.webmanifest"
      manual-chrome="true"
      manual-apple="true"
      use-local-storage="true"
      className="hidden"
    />
  );

  if (isStandalone) {
    return pwaInstallElement;
  }

  const trigger =
    variant === "icon" ? (
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 shrink-0 hover:bg-white/10"
        style={{ color: "var(--epi-cream-50)" }}
        title={t("common.pwa.installApp")}
        aria-label={t("common.pwa.installApp")}
      >
        <Download className="size-4" />
      </Button>
    ) : (
      <Button variant="outline" className="w-full">
        <Download className="size-4" />
        {t("common.pwa.installApp")}
      </Button>
    );

  return (
    <>
      {pwaInstallElement}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        {/* z-[80] so it renders above the mobile nav drawer (Sheet is z-[70]) when
            the install button is tapped from inside the drawer */}
        <DialogContent className="z-[80] flex max-h-[85dvh] flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{t("common.pwa.installTitle")}</DialogTitle>
            <DialogDescription>{t("common.pwa.installIntro")}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto">
            <div className="overflow-hidden rounded-lg border">
              {isNarrowViewport ? (
                <Image
                  src="/images/screenshot-narrow-1.png"
                  alt=""
                  width={410}
                  height={856}
                  className="h-auto w-full"
                />
              ) : (
                <Image
                  src="/images/screenshot-wide-1.png"
                  alt=""
                  width={1602}
                  height={1067}
                  className="h-auto w-full"
                />
              )}
            </div>

            <Button
              className="w-full"
              onClick={() => {
                setOpen(false);
                pwaRef.current?.showDialog(true);
              }}
            >
              <Download className="size-4" />
              {t("common.pwa.installNow")}
            </Button>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{t("common.pwa.offlineModeLabel")}</Label>
                  <p className="text-muted-foreground text-xs">
                    {t("common.pwa.offlineModeDescription")}
                  </p>
                </div>
                <Switch
                  checked={offlineModeEnabled}
                  disabled={isPriming}
                  onCheckedChange={(checked) =>
                    checked ? enableOfflineMode() : disableOfflineMode()
                  }
                  aria-label={t("common.pwa.offlineModeLabel")}
                />
              </div>

              {offlineModeEnabled && (
                <div className="space-y-2 border-t pt-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {isPriming
                        ? t("common.pwa.offlineModeDownloading")
                        : lastSyncedAt
                          ? t("common.pwa.lastSynced").replace("{date}", formatDateTime(lastSyncedAt))
                          : t("common.pwa.neverSynced")}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 px-2 text-xs"
                      onClick={syncNow}
                      disabled={isSyncing || isPriming}
                    >
                      <RefreshCw className={`size-3 ${isSyncing ? "animate-spin" : ""}`} />
                      {t("common.pwa.syncNow")}
                    </Button>
                  </div>

                  {storageEstimate && storageEstimate.quota > 0 && (
                    <p className="text-muted-foreground text-xs">
                      {t("common.pwa.storageUsage")
                        .replace("{used}", formatFileSize(storageEstimate.usage))
                        .replace("{quota}", formatFileSize(storageEstimate.quota))}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
