"use client";

import { useEffect, useState } from "react";
import { Download, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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

type PwaInstallTriggerVariant = "icon" | "full";

function isIosDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIos && !isStandalone;
}

/**
 * Shared PWA install experience backed by a centered shadcn Dialog.
 *
 * Works on every platform: when the browser has surfaced `beforeinstallprompt`
 * we show a one-tap "Install" button; otherwise we fall back to concise
 * platform-specific manual steps (iOS Safari vs. other browsers).
 *
 * Renders nothing when the app is already running standalone / installed.
 */
export function PwaInstallTrigger({ variant }: { variant: PwaInstallTriggerVariant }) {
  const { canInstall, install, isStandalone } = usePwaInstall();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  // Computed client-side only — touches window/navigator
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    setShowIosSteps(isIosDevice());
  }, []);

  if (isStandalone) return null;

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {/* z-[80] so it renders above the mobile nav drawer (Sheet is z-[70]) when
          the install button is tapped from inside the drawer */}
      <DialogContent className="z-[80]">
        <DialogHeader>
          <DialogTitle>{t("common.pwa.installTitle")}</DialogTitle>
          <DialogDescription>{t("common.pwa.installIntro")}</DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
