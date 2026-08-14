"use client";

import { useState } from "react";
import { CloudDownload, Download, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { usePwaInstaller } from "@/components/pwa/pwa-install";
import { useOfflineSyncContext } from "./offline-sync-provider";
import { OfflineReadiness } from "./offline-readiness";

type PwaTriggerVariant = "icon" | "full";

/**
 * Install button. It does exactly one thing: force-open the
 * `@khmyznikov/pwa-install` dialog (see src/components/pwa/pwa-install.tsx),
 * which owns the entire install experience — one-tap install where the browser
 * exposes it, illustrated per-platform steps everywhere else.
 *
 * There used to be an Epidom-branded dialog in between, so installing took two
 * taps and showed a screenshot the library's own dialog already renders from
 * the manifest. The Offline & Sync controls that shared that dialog now live in
 * `OfflineSyncTrigger` below.
 *
 * Renders nothing once the app is already running installed.
 */
export function PwaInstallTrigger({ variant }: { variant: PwaTriggerVariant }) {
  const { t } = useI18n();
  const { isStandalone, showInstallDialog } = usePwaInstaller();

  if (isStandalone) return null;

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 shrink-0 hover:bg-white/10"
        style={{ color: "var(--epi-cream-50)" }}
        title={t("common.pwa.installApp")}
        aria-label={t("common.pwa.installApp")}
        onClick={showInstallDialog}
      >
        <Download className="size-4" />
      </Button>
    );
  }

  return (
    <Button variant="outline" className="w-full" onClick={showInstallDialog}>
      <Download className="size-4" />
      {t("common.pwa.installApp")}
    </Button>
  );
}

/**
 * Offline & Sync settings: the Offline Mode switch, last-synced stamp, a manual
 * "Sync now", and a per-page/per-domain readiness report (see
 * `OfflineReadiness`).
 *
 * Deliberately NOT hidden while standalone, unlike the install button.
 * It used to be, on the reasoning that Offline Mode is mandatory for the
 * installed app so there was nothing left to configure — but that removed the
 * status *report* along with the switch, and the installed app is precisely
 * where offline is load-bearing. A cashier whose tablet drops off the wifi had
 * no way to find out whether their device was actually ready, and no way to
 * tell "everything is mirrored" apart from "the service worker never took
 * control". The switch is still locked on there; it is shown that way rather
 * than removed, so its state is legible instead of merely asserted.
 */
export function OfflineSyncTrigger({ variant }: { variant: PwaTriggerVariant }) {
  const { t, formatDateTime } = useI18n();
  const { isStandalone } = usePwaInstaller();
  const {
    storeId,
    lastSyncedAt,
    isSyncing,
    pendingCount,
    isOnline,
    syncNow,
    offlineModeEnabled,
    isPriming,
    enableOfflineMode,
    disableOfflineMode,
  } = useOfflineSyncContext();
  const [open, setOpen] = useState(false);

  const trigger =
    variant === "icon" ? (
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 shrink-0 hover:bg-white/10"
        style={{ color: "var(--epi-cream-50)" }}
        title={t("common.pwa.offlineSettingsTitle")}
        aria-label={t("common.pwa.offlineSettingsTitle")}
      >
        <CloudDownload className="size-4" />
      </Button>
    ) : (
      <Button variant="outline" className="w-full">
        <CloudDownload className="size-4" />
        {t("common.pwa.offlineSettingsTitle")}
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {/* z-[80] so it renders above the mobile nav drawer (Sheet is z-[70]) when
          opened from inside the drawer */}
      <DialogContent className="z-[80] flex max-h-[85dvh] flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("common.pwa.offlineSettingsTitle")}</DialogTitle>
          <DialogDescription>{t("common.pwa.offlineSettingsIntro")}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={isOnline ? "" : "text-muted-foreground"}>
              {isOnline ? (
                <Wifi className="size-3" />
              ) : (
                <WifiOff className="size-3" />
              )}
              {isOnline ? t("common.pwa.connectionOnline") : t("common.pwa.connectionOffline")}
            </Badge>
            <Badge variant="outline">
              {isStandalone ? t("common.pwa.runningInstalled") : t("common.pwa.runningBrowser")}
            </Badge>
            {pendingCount > 0 && (
              <Badge variant="secondary">
                {t("common.pwa.pendingOrders").replace("{count}", String(pendingCount))}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{t("common.pwa.offlineModeLabel")}</Label>
              <p className="text-muted-foreground text-xs">
                {isStandalone
                  ? t("common.pwa.offlineModeRequired")
                  : t("common.pwa.offlineModeDescription")}
              </p>
            </div>
            {/* Locked on while installed. `disabled` rather than hidden: the
                hook refuses to turn it off there anyway (see useOfflineMode),
                so an interactive switch would be a control that silently does
                nothing — worse than one that visibly can't move. */}
            <Switch
              checked={offlineModeEnabled}
              disabled={isPriming || isStandalone}
              onCheckedChange={(checked) => (checked ? enableOfflineMode() : disableOfflineMode())}
              aria-label={t("common.pwa.offlineModeLabel")}
            />
          </div>

          {offlineModeEnabled && (
            <div className="space-y-3 border-t pt-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {isPriming
                    ? t("common.pwa.offlineModeDownloading")
                    : lastSyncedAt
                      ? t("common.pwa.lastSynced").replace("{date}", formatDateTime(lastSyncedAt))
                      : t("common.pwa.neverSynced")}
                </span>
                {/* h-10 = 40px, the touch-target floor in AGENTS.md. This used
                    to be h-6 (24px) — well under it for a cashier tablet. */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-10 gap-1 px-3 text-xs"
                  onClick={syncNow}
                  disabled={isSyncing || isPriming}
                >
                  <RefreshCw className={`size-3 ${isSyncing ? "animate-spin" : ""}`} />
                  {t("common.pwa.syncNow")}
                </Button>
              </div>

              <OfflineReadiness
                storeId={storeId}
                offlineModeEnabled={offlineModeEnabled}
                isPriming={isPriming || isSyncing}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
