"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Camera,
  Check,
  Hourglass,
  Maximize2,
  Minimize2,
  MessageCircle,
  MonitorOff,
  ShoppingBag,
  Star,
  Wifi,
} from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { EpidomMark, EpidomWordmark } from "@/features/marketing/shared/components/epidom-logo";
import { cn } from "@/lib/utils";
import type { CustomerDisplayConfig } from "@/types/api/customer-display";
import { isCustomerDisplayStandby, type CustomerDisplaySnapshot } from "../lib/customer-display";
import {
  CUSTOMER_DISPLAY_LOGO_SCALE,
  liveBannersOf,
  resolveCustomerDisplayLook,
} from "../lib/customer-display-look";
import { CustomerDisplaySlideshow } from "./customer-display-slideshow";

export interface CustomerDisplayPhoneCta {
  label: string;
  /** A number was given: a check instead of the chat icon. */
  done: boolean;
  onClick?: () => void;
}

interface CustomerDisplayViewProps {
  config: CustomerDisplayConfig;
  /** The state to draw (the live wrapper has already applied the thank-you hold). */
  snapshot: CustomerDisplaySnapshot;
  /** Null until mounted, so the server never renders a clock the browser disagrees with. */
  now: Date | null;
  /** `screen` fills the viewport; `preview` fills its parent (the dashboard editor). */
  variant?: "screen" | "preview";
  /** The WhatsApp receipt button, shown while a customer can use it. */
  phoneCta: CustomerDisplayPhoneCta | null;
  fullscreen?: { active: boolean; onToggle: () => void } | null;
  /** Overlays drawn over the whole screen (the number pad). */
  children?: ReactNode;
}

/** height > width: a screen mounted upright. Ratio-based, so app zoom can't skew it. */
function useIsPortrait(ref: RefObject<HTMLDivElement | null>): boolean {
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0) setPortrait(height > width * 1.05);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return portrait;
}

/**
 * The customer's side of the till, drawn from a config and a snapshot and
 * nothing else — the live window and the Store Dashboard's preview both render
 * this, so the preview is the real thing.
 *
 * Sized with container queries (`@2xl:` / `@5xl:`) and `cqh` units against its
 * own root rather than the viewport: on the real screen the root IS the
 * viewport, and in the preview it is a scaled 16:9 box, so both lay out alike.
 */
export function CustomerDisplayView({
  config,
  snapshot,
  now,
  variant = "screen",
  phoneCta,
  fullscreen,
  children,
}: CustomerDisplayViewProps) {
  const { t, formatDate } = useI18n();
  // Cart amounts are literal in the store's display currency, never IDR —
  // passing `currency` skips formatPrice's default base-currency conversion.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);

  const rootRef = useRef<HTMLDivElement>(null);
  const portrait = useIsPortrait(rootRef);

  const settings = config.settings;
  const look = resolveCustomerDisplayLook(config);
  // Re-evaluated once a minute, which is the finest grain a schedule has.
  const minute = now ? Math.floor(now.getTime() / 60_000) : 0;
  const live = useMemo(
    () => (minute ? liveBannersOf(settings.banners, new Date(minute * 60_000)) : []),
    [settings.banners, minute]
  );

  const welcomeTitle = settings.welcomeTitle || t("pos.customerDisplay.welcome");
  const welcomeMessage = settings.welcomeMessage || t("pos.customerDisplay.welcomeDesc");

  const lines = snapshot.lines;
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const highlight = lines.find((line) => line.id === snapshot.highlightLineId) ?? null;
  const isStandby = isCustomerDisplayStandby(snapshot.phase);
  const isClosed = snapshot.phase === "closed";
  const isPaid = snapshot.phase === "paid";
  const qrisUrl =
    snapshot.phase === "building" && snapshot.paymentPrompt === "QRIS"
      ? settings.qrisImageUrl
      : null;
  const orderLeft = settings.orderSide === "LEFT" && !portrait;
  const logoScale = CUSTOMER_DISPLAY_LOGO_SCALE[settings.logoSize];

  const logo = (maxHeightCqh: number, maxWidthPct: number, className?: string) =>
    look.logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={look.logoUrl}
        alt={look.storeName}
        className={cn("w-auto rounded-2xl object-contain", className)}
        style={{ maxHeight: `${maxHeightCqh}cqh`, maxWidth: `${maxWidthPct}%` }}
      />
    ) : (
      <div className={cn("flex flex-col items-center gap-4 opacity-85", className)}>
        <EpidomMark size={96} />
        <div className="opacity-70">
          <EpidomWordmark height={26} />
        </div>
      </div>
    );

  const phoneButton = (className?: string) =>
    phoneCta ? (
      <button
        type="button"
        onClick={phoneCta.onClick}
        disabled={!phoneCta.onClick}
        className={cn(
          "flex min-h-14 touch-manipulation items-center justify-center gap-2.5 rounded-3xl border border-[color:var(--cfd-border)] bg-[color:var(--cfd-panel)] px-5 py-3 text-left text-base font-semibold shadow-lg transition-opacity active:opacity-70 disabled:cursor-default @2xl:text-lg",
          className
        )}
      >
        {phoneCta.done ? (
          <Check className="h-5 w-5 shrink-0" />
        ) : (
          <MessageCircle className="h-5 w-5 shrink-0" />
        )}
        <span className="min-w-0 truncate">{phoneCta.label}</span>
      </button>
    ) : null;

  const panel =
    "rounded-3xl border border-[color:var(--cfd-border)] bg-[color:var(--cfd-panel)] shadow-lg";

  let content: ReactNode;
  if (isStandby) {
    content = (
      <div
        className={cn(
          panel,
          "flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center shadow-none"
        )}
      >
        {logo(24, 60, "opacity-85")}
        <div className="flex max-w-md flex-col items-center gap-1.5">
          <div className="flex items-center gap-2 opacity-60">
            {isClosed ? (
              <Hourglass className="h-4 w-4 shrink-0" />
            ) : (
              <MonitorOff className="h-4 w-4 shrink-0" />
            )}
            <p className="text-sm @2xl:text-base">
              {t(isClosed ? "pos.customerDisplay.waitingTill" : "pos.customerDisplay.standby")}
            </p>
          </div>
          {/* For staff setting the screen up — the customer has nothing to do
              here, so it stays small and quiet. */}
          <p className="text-xs opacity-45 @2xl:text-sm">
            {t(
              isClosed ? "pos.customerDisplay.waitingTillHint" : "pos.customerDisplay.standbyHint"
            )}
          </p>
        </div>
      </div>
    );
  } else if (isPaid) {
    content = (
      <ThankYou
        config={config}
        snapshot={snapshot}
        formatPrice={formatPrice}
        panelClassName={panel}
      />
    );
  } else if (lines.length === 0) {
    const slides = settings.idleSlideshow ? live : [];
    content =
      slides.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 @2xl:gap-5">
          <CustomerDisplaySlideshow
            banners={slides}
            seconds={settings.slideSeconds}
            className="min-h-[220px] flex-1 rounded-3xl border border-[color:var(--cfd-border)] shadow-lg"
          />
          <div
            className={cn(
              panel,
              "flex shrink-0 flex-col gap-3 p-4 @2xl:p-5 @3xl:flex-row @3xl:items-center @3xl:justify-between"
            )}
          >
            <div className="min-w-0">
              <h2 className="text-xl leading-tight font-semibold break-words @2xl:text-2xl">
                {welcomeTitle}
              </h2>
              <p className="mt-1 text-sm opacity-70 @2xl:text-base">{welcomeMessage}</p>
            </div>
            {phoneButton("@3xl:shrink-0")}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            panel,
            "flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center @2xl:p-10"
          )}
        >
          {logo(40 * logoScale, 100 * logoScale)}
          <div className="max-w-3xl">
            <h2 className="text-3xl leading-tight font-semibold break-words @2xl:text-4xl @5xl:text-5xl">
              {welcomeTitle}
            </h2>
            <p className="mt-2 text-base opacity-70 @2xl:text-lg">{welcomeMessage}</p>
          </div>
          {phoneButton("w-full max-w-md")}
        </div>
      );
  } else {
    const slides = settings.bannersDuringOrder ? live : [];
    content = (
      <div
        className={cn(
          "grid flex-1 gap-4 @2xl:gap-5 @5xl:gap-6",
          portrait
            ? "min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]"
            : cn(
                "grid-cols-1 @5xl:min-h-0",
                orderLeft
                  ? "@5xl:grid-cols-[minmax(340px,40%)_minmax(0,1fr)]"
                  : "@5xl:grid-cols-[minmax(0,1fr)_minmax(340px,40%)]"
              )
        )}
      >
        {/* ── The item just rung up, over a banner or the store's mark — or
            the store's QRIS while the cashier takes payment with it ── */}
        <div
          className={cn(
            "flex min-w-0 flex-col gap-4 @2xl:gap-5",
            portrait ? "min-h-0" : "@5xl:min-h-0"
          )}
        >
          {qrisUrl ? (
            <div
              className={cn(
                panel,
                "flex min-h-[320px] flex-1 flex-col items-center justify-center gap-4 p-5 text-center @2xl:p-7",
                portrait ? "min-h-0" : "@5xl:min-h-0"
              )}
            >
              <div>
                <h2 className="text-2xl leading-tight font-semibold @2xl:text-3xl">
                  {t("pos.customerDisplay.scanToPay")}
                </h2>
                <p className="mt-1 text-sm opacity-70 @2xl:text-base">
                  {t("pos.customerDisplay.scanToPayDesc")}
                </p>
              </div>
              <div className="flex min-h-0 items-center justify-center rounded-2xl bg-white p-3 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrisUrl}
                  alt="QRIS"
                  className="h-auto max-h-[46cqh] w-auto max-w-full object-contain"
                />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-60">
                  {t("pos.customerDisplay.amountToPay")}
                </p>
                <p className="text-4xl font-bold tabular-nums @2xl:text-5xl">
                  {formatPrice(snapshot.total)}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className={cn(panel, "shrink-0 p-5 @2xl:p-7")}>
                {highlight ? (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        {snapshot.highlightIsNew && (
                          <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-60">
                            {t("pos.customerDisplay.justAdded")}
                          </p>
                        )}
                        <h2 className="mt-2 text-2xl leading-tight font-semibold break-words @2xl:text-3xl @5xl:text-4xl">
                          {highlight.name}
                        </h2>
                        {highlight.modifiers.length > 0 && (
                          <p className="mt-2 text-sm opacity-70 @2xl:text-base">
                            {highlight.modifiers.join(" · ")}
                          </p>
                        )}
                        {highlight.notes && (
                          <p className="mt-1 text-sm italic opacity-60 @2xl:text-base">
                            {highlight.notes}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-[color:var(--cfd-panel-strong)] px-3.5 py-1.5 text-lg font-bold tabular-nums @2xl:text-xl">
                        {highlight.quantity}×
                      </span>
                    </div>
                    <p className="mt-5 text-right text-3xl font-bold tabular-nums @2xl:text-4xl @5xl:text-5xl">
                      {formatPrice(highlight.lineTotal)}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl leading-tight font-semibold @2xl:text-3xl @5xl:text-4xl">
                      {welcomeTitle}
                    </h2>
                    <p className="mt-2 text-base opacity-70 @2xl:text-lg">{welcomeMessage}</p>
                  </>
                )}
              </div>

              {slides.length > 0 ? (
                <CustomerDisplaySlideshow
                  banners={slides}
                  seconds={settings.slideSeconds}
                  className={cn(
                    "min-h-[180px] flex-1 rounded-3xl border border-[color:var(--cfd-border)] shadow-lg",
                    portrait ? "min-h-0" : "@5xl:min-h-0"
                  )}
                />
              ) : (
                <div
                  className={cn(
                    panel,
                    "flex min-h-[180px] flex-1 items-center justify-center overflow-hidden p-6 @2xl:p-8",
                    portrait ? "min-h-0" : "@5xl:min-h-0"
                  )}
                >
                  {logo(45 * logoScale, 100 * logoScale)}
                </div>
              )}

              {phoneButton("shrink-0")}
            </>
          )}
        </div>

        {/* ── The running receipt ── */}
        <div
          className={cn(
            panel,
            "flex flex-col overflow-hidden",
            portrait ? "min-h-0" : "@5xl:min-h-0",
            orderLeft && "@5xl:order-first"
          )}
        >
          <div className="flex shrink-0 items-baseline justify-between gap-3 border-b border-[color:var(--cfd-border)] px-5 py-4 @2xl:px-6">
            <h2 className="text-base font-semibold tracking-wide @2xl:text-lg">
              {t("pos.customerDisplay.yourOrder")}
            </h2>
            <span className="text-sm tabular-nums opacity-70 @2xl:text-base">
              {t(
                itemCount === 1
                  ? "pos.customerDisplay.itemCountSingular"
                  : "pos.customerDisplay.itemCountPlural"
              ).replace("{count}", String(itemCount))}
            </span>
          </div>

          <ul
            className={cn(
              "min-h-0 flex-1 divide-y divide-[color:var(--cfd-border)] overflow-y-auto px-5 @2xl:px-6",
              portrait ? "max-h-none" : "max-h-[40cqh] @5xl:max-h-none"
            )}
          >
            {lines.map((line) => (
              <li
                key={line.id}
                className={cn(
                  "flex items-start justify-between gap-4 py-3 transition-opacity",
                  line.id === snapshot.highlightLineId ? "opacity-100" : "opacity-80"
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium @2xl:text-base">
                    <span className="tabular-nums opacity-70">{line.quantity}×</span> {line.name}
                  </p>
                  {line.modifiers.length > 0 && (
                    <p className="mt-0.5 text-xs opacity-60 @2xl:text-sm">
                      {line.modifiers.join(" · ")}
                    </p>
                  )}
                  {line.notes && (
                    <p className="mt-0.5 text-xs italic opacity-55 @2xl:text-sm">{line.notes}</p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums @2xl:text-base">
                  {formatPrice(line.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          <div className="shrink-0 border-t border-[color:var(--cfd-border)] px-5 py-4 @2xl:px-6 @2xl:py-5">
            <dl className="space-y-1.5 text-sm @2xl:text-base">
              <TotalsRow label={t("pos.cart.subtotal")} value={formatPrice(snapshot.subtotal)} />
              {snapshot.serviceCharge > 0 && (
                <TotalsRow
                  label={t("pos.cart.serviceCharge")}
                  value={formatPrice(snapshot.serviceCharge)}
                />
              )}
              {snapshot.discountAmount > 0 && (
                <TotalsRow
                  label={
                    snapshot.discountReason
                      ? `${t("pos.cart.discount")} (${snapshot.discountReason})`
                      : t("pos.cart.discount")
                  }
                  value={`-${formatPrice(snapshot.discountAmount)}`}
                />
              )}
              {/* A tax-free store (or a tax-free cart) doesn't need a 0 line. */}
              {snapshot.tax > 0 && (
                <TotalsRow label={t("pos.cart.tax")} value={formatPrice(snapshot.tax)} />
              )}
            </dl>

            <div className="mt-4 flex items-baseline justify-between gap-3 rounded-2xl bg-[color:var(--cfd-total)] px-4 py-3 @2xl:px-5 @2xl:py-4">
              <span className="text-sm font-semibold tracking-[0.12em] uppercase opacity-80 @2xl:text-base">
                {t("pos.cart.total")}
              </span>
              <span className="text-2xl font-bold tabular-nums @2xl:text-3xl">
                {formatPrice(snapshot.total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      style={look.style}
      className={cn(
        "relative isolate w-full overflow-hidden text-[color:var(--cfd-ink)] [container-type:size]",
        variant === "screen" ? "h-[calc(100dvh/var(--app-zoom,1))]" : "h-full"
      )}
    >
      {look.backgroundImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={look.backgroundImage.url}
            alt=""
            aria-hidden
            className="absolute inset-0 -z-10 h-full w-full object-cover"
            style={{
              filter: look.backgroundImage.blur ? `blur(${look.backgroundImage.blur}px)` : undefined,
              // Blur pulls the edges in; a little scale hides the halo.
              transform: look.backgroundImage.blur ? "scale(1.08)" : undefined,
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[color:var(--cfd-theme)]"
            style={{ opacity: look.backgroundImage.dim / 100 }}
          />
        </>
      )}

      <div className="absolute inset-0 flex flex-col overflow-y-auto p-4 @2xl:p-6 @5xl:p-8">
        <header className="flex shrink-0 items-center justify-between gap-3 px-1 pb-4 @2xl:pb-6">
          <p className="min-w-0 truncate text-sm font-medium tracking-wide opacity-70 @2xl:text-base">
            {now ? formatDate(now, "d MMMM yyyy • HH:mm") : ""}
          </p>
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <p className="max-w-[45cqw] truncate text-sm font-semibold tracking-[0.14em] uppercase opacity-70 @2xl:text-base">
              {look.storeName}
            </p>
            {/* Always visible rather than revealed on hover — a customer display
                is a touch screen with no hover state to reveal it with. */}
            {fullscreen && (
              <button
                type="button"
                onClick={fullscreen.onToggle}
                aria-label={t(
                  fullscreen.active
                    ? "pos.customerDisplay.exitFullscreen"
                    : "pos.customerDisplay.fullscreen"
                )}
                className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full opacity-50 transition-opacity hover:opacity-100"
              >
                {fullscreen.active ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </header>

        {content}
      </div>

      {children}
    </div>
  );
}

function ThankYou({
  config,
  snapshot,
  formatPrice,
  panelClassName,
}: {
  config: CustomerDisplayConfig;
  snapshot: CustomerDisplaySnapshot;
  formatPrice: (value: number | null | undefined) => string;
  panelClassName: string;
}) {
  const { t } = useI18n();
  const { settings, branding } = config;
  const changeDue = snapshot.changeDue ?? null;

  const extras: ReactNode[] = [];
  if (settings.showReviewQr && branding.googleReviewUrl) {
    extras.push(
      <QrTile
        key="review"
        value={branding.googleReviewUrl}
        icon={<Star className="h-3.5 w-3.5 shrink-0" />}
        label={t("pos.customerDisplay.reviewUs")}
      />
    );
  }
  if (settings.showInstagramQr && branding.instagramUrl) {
    extras.push(
      <QrTile
        key="instagram"
        value={branding.instagramUrl}
        icon={<Camera className="h-3.5 w-3.5 shrink-0" />}
        label={t("pos.customerDisplay.followUs")}
      />
    );
  }
  if (settings.showWifi && branding.wifiName) {
    extras.push(
      <div
        key="wifi"
        className="flex w-40 flex-col items-center justify-center gap-2 rounded-2xl bg-[color:var(--cfd-panel-strong)] p-4 text-center @5xl:w-48"
      >
        <Wifi className="h-7 w-7" />
        <p className="text-xs font-semibold tracking-[0.14em] uppercase opacity-70">
          {t("pos.customerDisplay.wifi")}
        </p>
        <p className="w-full truncate text-base font-semibold">{branding.wifiName}</p>
        {/* Label above, password on its own line: no colon to localize, and a
            password only ever wraps when it can't fit the tile at all. */}
        {branding.wifiPassword && (
          <div className="w-full">
            <p className="text-xs opacity-60">{t("pos.customerDisplay.wifiPassword")}</p>
            <p className="font-mono text-sm font-semibold [overflow-wrap:anywhere]">
              {branding.wifiPassword}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        panelClassName,
        "flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center shadow-none @2xl:p-8",
        extras.length > 0 && "@5xl:flex-row @5xl:gap-14"
      )}
    >
      <div className="flex flex-col items-center gap-5 @2xl:gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--cfd-panel-strong)] @2xl:h-20 @2xl:w-20">
          <Check className="h-8 w-8 @2xl:h-10 @2xl:w-10" />
        </div>
        <div className="max-w-2xl">
          <h1 className="text-3xl leading-tight font-semibold break-words @2xl:text-4xl @5xl:text-5xl">
            {settings.thankYouTitle || t("pos.customerDisplay.thankYou")}
          </h1>
          <p className="mt-2 text-base opacity-70 @2xl:text-lg">
            {settings.thankYouMessage || t("pos.customerDisplay.thankYouDesc")}
          </p>
        </div>
        <p className="text-4xl font-bold tabular-nums @2xl:text-5xl">
          {formatPrice(snapshot.total)}
        </p>
        {changeDue !== null && changeDue > 0 && (
          <p className="rounded-2xl bg-[color:var(--cfd-panel-strong)] px-5 py-2.5 text-xl font-semibold @2xl:text-2xl">
            <span className="opacity-70">{t("pos.customerDisplay.change")}</span>{" "}
            <span className="tabular-nums">{formatPrice(changeDue)}</span>
          </p>
        )}
        {snapshot.paidOrderNumber && (
          <p className="text-sm tracking-[0.16em] uppercase opacity-60 @2xl:text-base">
            {t("pos.queue.orderNumber")} {snapshot.paidOrderNumber}
          </p>
        )}
      </div>
      {extras.length > 0 && (
        <div className="flex flex-wrap items-stretch justify-center gap-3 @2xl:gap-4">{extras}</div>
      )}
    </div>
  );
}

function QrTile({ value, icon, label }: { value: string; icon: ReactNode; label: string }) {
  return (
    <div className="flex w-40 flex-col items-center gap-2 rounded-2xl bg-white p-3 text-[#141210] shadow-lg @5xl:w-48">
      <QRCodeSVG value={value} size={256} level="M" className="h-auto w-full" />
      <p className="flex items-center gap-1.5 text-xs font-semibold @5xl:text-sm">
        {icon}
        <span>{label}</span>
      </p>
    </div>
  );
}

function TotalsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 truncate opacity-70">{label}</dt>
      <dd className="shrink-0 tabular-nums">{value}</dd>
    </div>
  );
}
