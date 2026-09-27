"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  LayoutDashboard,
  MessageCircle,
  MonitorSmartphone,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import type { OnboardingCompleteResult } from "@/lib/onboarding/contracts";
import { upgradeHrefFor } from "@/lib/plans/entitlements";
import { downloadDataUrl } from "@/lib/utils/export";
import { cn } from "@/lib/utils";
import { PRIMARY_BUTTON_CLASS } from "./wizard-frame";

export interface LaunchScreenProps {
  result: OnboardingCompleteResult;
  storeName: string;
}

/** The link a WhatsApp share opens with: a ready-to-send message plus the store link. */
export function whatsappShareHref(message: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`;
}

/**
 * The downloaded QR code is meant for print (table tents, menus): the 4-module
 * quiet zone the QR spec requires, so it still scans on a coloured design,
 * and at least 1024 px (qrcode.react multiplies by devicePixelRatio).
 */
export const QR_EXPORT_SIZE = 1024;
export const QR_EXPORT_MARGIN = 4;

/**
 * "Your store is live": shown once the storefront is published. The public
 * link with Copy, a QR code to print, a WhatsApp share, then the way in: the
 * 1-minute tour or straight to the Back Office. An owner who wants to take
 * orders at the counter also gets the POS trial offer. Nothing here blocks;
 * every action is optional.
 */
export function LaunchScreen({ result, storeName }: LaunchScreenProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  // The print-size QR is only drawn while a download is being prepared.
  const [exportingQr, setExportingQr] = useState(false);
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const dashboardHref = `/store/${result.storeId}/dashboard`;
  const tourHref = `${dashboardHref}?tour=1`;
  const shareHref = whatsappShareHref(
    t("onboarding.launch.whatsappMessage").replace("{store}", storeName),
    result.publicUrl
  );
  const wantsCounter = result.goals.includes("counter");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(result.publicUrl);
      setCopied(true);
      toast.success(t("onboarding.launch.copied"));
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("onboarding.launch.copyFailed"));
    }
  };

  // The export canvas has drawn by the time this runs (a child's effects run
  // before its parent's), so it is read, saved and dropped again.
  useEffect(() => {
    if (!exportingQr) return;
    const canvas = exportCanvasRef.current;
    if (canvas) downloadDataUrl(canvas.toDataURL("image/png"), `${result.slug}-qr.png`);
    setExportingQr(false);
  }, [exportingQr, result.slug]);

  const downloadQr = () => setExportingQr(true);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6 px-4 py-8 sm:px-8 sm:py-10">
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-3 text-center duration-500">
          <span
            aria-hidden="true"
            className="mx-auto flex size-16 items-center justify-center rounded-full bg-[var(--epi-gold-500)]/15 ring-8 ring-[var(--epi-gold-500)]/5"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-[var(--epi-gold-500)] text-[var(--epi-navy-900)]">
              <Check className="size-6" strokeWidth={3} />
            </span>
          </span>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-foreground text-2xl font-bold tracking-tight outline-none sm:text-3xl"
          >
            {t("onboarding.launch.title")}
          </h1>
          <p className="text-muted-foreground mx-auto max-w-md text-sm">
            {t("onboarding.launch.subtitle")}
          </p>
        </div>

        <section aria-labelledby="launch-link-label" className="space-y-2">
          <p id="launch-link-label" className="text-sm font-medium">
            {t("onboarding.launch.linkLabel")}
          </p>
          <div className="flex min-w-0 items-center gap-2">
            <p
              data-testid="launch-public-url"
              className="bg-muted/50 flex h-11 min-w-0 flex-1 items-center rounded-lg border px-3 font-mono text-sm"
            >
              <span className="truncate">{result.publicUrl}</span>
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={copyLink}
              className="h-11 shrink-0 rounded-lg px-3"
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              <span className="hidden sm:inline">
                {copied ? t("onboarding.launch.copied") : t("onboarding.launch.copy")}
              </span>
              <span className="sr-only sm:hidden">{t("onboarding.launch.copy")}</span>
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="h-11 rounded-lg">
              <a href={shareHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" />
                {t("onboarding.launch.shareWhatsapp")}
              </a>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-lg">
              <a href={result.publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                {t("onboarding.launch.openStore")}
              </a>
            </Button>
          </div>
        </section>

        <section
          aria-labelledby="launch-qr-title"
          className="flex flex-col items-center gap-4 rounded-xl border p-4 sm:flex-row sm:items-center"
        >
          <div className="shrink-0 rounded-lg border bg-white p-3">
            <QRCodeCanvas
              value={result.publicUrl}
              size={128}
              level="M"
              marginSize={0}
              aria-label={t("onboarding.launch.qrAlt")}
              role="img"
            />
          </div>
          {exportingQr ? (
            <QRCodeCanvas
              ref={exportCanvasRef}
              data-testid="launch-qr-export"
              value={result.publicUrl}
              size={QR_EXPORT_SIZE}
              level="M"
              marginSize={QR_EXPORT_MARGIN}
              aria-hidden="true"
              style={{ display: "none" }}
            />
          ) : null}
          <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
            <p id="launch-qr-title" className="font-medium">
              {t("onboarding.launch.qrTitle")}
            </p>
            <p className="text-muted-foreground text-sm">{t("onboarding.launch.qrHint")}</p>
            <Button
              type="button"
              variant="outline"
              onClick={downloadQr}
              className="h-10 rounded-lg"
            >
              <Download aria-hidden="true" />
              {t("onboarding.launch.downloadQr")}
            </Button>
          </div>
        </section>

        {wantsCounter ? (
          <section
            aria-labelledby="launch-pos-trial"
            data-testid="launch-pos-trial"
            className="flex flex-col gap-3 rounded-xl border border-[var(--epi-gold-500)]/40 bg-[var(--epi-gold-500)]/8 p-4 sm:flex-row sm:items-center"
          >
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--epi-gold-500)] text-[var(--epi-navy-900)]"
            >
              <MonitorSmartphone className="size-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p id="launch-pos-trial" className="font-semibold">
                {t("onboarding.launch.posTrial.title")}
              </p>
              <p className="text-muted-foreground text-sm">
                {t("onboarding.launch.posTrial.body")}
              </p>
            </div>
            <Button asChild variant="outline" className="h-10 shrink-0 rounded-lg">
              <Link href={upgradeHrefFor("POS")}>{t("onboarding.launch.posTrial.cta")}</Link>
            </Button>
          </section>
        ) : null}
      </div>

      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 flex flex-col-reverse gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:flex-row sm:justify-end sm:gap-3 sm:rounded-b-2xl sm:px-8 sm:py-4">
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <Link href={dashboardHref}>
            <LayoutDashboard aria-hidden="true" />
            {t("onboarding.launch.backOffice")}
          </Link>
        </Button>
        <Button asChild className={cn(PRIMARY_BUTTON_CLASS, "sm:min-w-48")}>
          <Link href={tourHref}>
            {t("onboarding.launch.tour")}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
