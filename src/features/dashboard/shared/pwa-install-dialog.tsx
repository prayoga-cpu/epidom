"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, Share, Plus, RefreshCw, WifiOff } from "lucide-react";
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
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { useI18n } from "@/components/lang/i18n-provider";
import { useOfflineSyncContext } from "./offline-sync-provider";
import { formatFileSize } from "@/lib/utils/formatting";

type PwaInstallTriggerVariant = "icon" | "full";

function isIosUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Only relevant while not yet installed — once standalone, "how to install"
// steps don't apply anymore.
function isIosDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIosUserAgent() && !isStandalone;
}

/**
 * Shared PWA install + offline-data experience backed by a centered shadcn
 * Dialog.
 *
 * Before install: one-tap "Install" button when the browser has surfaced
 * `beforeinstallprompt`, otherwise concise platform-specific manual steps
 * (iOS Safari vs. other browsers).
 *
 * The trigger stays visible after install (unlike a pure install prompt)
 * because the dialog doubles as the Offline Mode / sync-status surface —
 * there's no separate settings screen for it.
 */
export function PwaInstallTrigger({ variant }: { variant: PwaInstallTriggerVariant }) {
  const { canInstall, install, isStandalone } = usePwaInstall();
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
  // Computed client-side only — touches window/navigator
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [isIosPlatform, setIsIosPlatform] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(true);
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(
    null
  );

  useEffect(() => {
    setShowIosSteps(isIosDevice());
    setIsIosPlatform(isIosUserAgent());

    const mql = window.matchMedia("(min-width: 640px)");
    const onChange = () => setIsNarrowViewport(!mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
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

  const handleInstall = async () => {
    await install();
    setOpen(false);
  };

  const trigger =
    variant === "icon" ? (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 hover:bg-white/10"
        style={{ color: "var(--epi-cream-50)" }}
        title={isStandalone ? t("common.pwa.offlineSettingsTitle") : t("common.pwa.installApp")}
        aria-label={
          isStandalone ? t("common.pwa.offlineSettingsTitle") : t("common.pwa.installApp")
        }
      >
        <Download className="size-4" />
      </Button>
    ) : (
      <Button variant="outline" className="w-full">
        <Download className="size-4" />
        {isStandalone ? t("common.pwa.offlineSettingsTitle") : t("common.pwa.installApp")}
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {/* z-[80] so it renders above the mobile nav drawer (Sheet is z-[70]) when
          the install button is tapped from inside the drawer */}
      <DialogContent className="z-[80] flex max-h-[85dvh] flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {isStandalone ? t("common.pwa.offlineSettingsTitle") : t("common.pwa.installTitle")}
          </DialogTitle>
          <DialogDescription>
            {isStandalone ? t("common.pwa.offlineSettingsIntro") : t("common.pwa.installIntro")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {!isStandalone && (
            <>
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

              {canInstall && (
                <Button className="w-full" onClick={handleInstall}>
                  <Download className="size-4" />
                  {t("common.pwa.installNow")}
                </Button>
              )}

              {showIosSteps ? (
                <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <Share className="size-4 shrink-0" aria-hidden />
                  {t("common.pwa.installIosStep")}
                </p>
              ) : (
                <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <Plus className="size-4 shrink-0" aria-hidden />
                  {t("common.pwa.installDesktopStep")}
                </p>
              )}
            </>
          )}

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

                {isIosPlatform && (
                  <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                    <WifiOff className="mt-0.5 size-3 shrink-0" aria-hidden />
                    {t("common.pwa.iosEvictionWarning")}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
