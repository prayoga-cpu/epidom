"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { Check, Maximize2, Minimize2, MonitorOff, ShoppingBag } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { EpidomMark } from "@/features/marketing/shared/components/epidom-logo";
import { getContrastingInk, getPremiumTheme } from "@/lib/utils/color";
import { cn } from "@/lib/utils";
import { useCustomerDisplaySnapshot } from "../hooks/use-customer-display";

interface PosCustomerDisplayProps {
  storeId: string;
  storeName: string;
  logoUrl: string | null;
  themeColor: string | null;
}

/**
 * The customer's side of the till — a read-only mirror of the cashier's cart,
 * meant for a second screen turned to face the customer. No controls, nothing
 * tappable beyond the fullscreen toggle: everything here is driven by the
 * cashier window over `useCustomerDisplaySnapshot`.
 */
export function PosCustomerDisplay({
  storeId,
  storeName,
  logoUrl,
  themeColor,
}: PosCustomerDisplayProps) {
  const { t, formatDate } = useI18n();
  // Cart amounts are literal in the store's display currency, never IDR —
  // passing `currency` skips formatPrice's default base-currency conversion,
  // exactly as the cashier's own cart does.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number | null | undefined) => formatPriceRaw(value, currency);

  const snapshot = useCustomerDisplaySnapshot(storeId);
  const [now, setNow] = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Starts null and fills in on the client: seeding it with `new Date()` would
  // render a server clock that never matches the browser's on hydration.
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    syncFullscreen();
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = () => {
    // Both calls are feature-checked, not just try/caught: where the method is
    // undefined the call throws *synchronously*, so a bare `.catch()` never
    // runs and the TypeError escapes the click handler.
    try {
      if (document.fullscreenElement) {
        void document.exitFullscreen?.()?.catch(() => {});
        return;
      }
      void document.documentElement.requestFullscreen?.()?.catch(() => {});
    } catch {
      // Fullscreen unavailable (iOS Safari, an embedded webview, a policy
      // block). The display is perfectly usable windowed.
    }
  };

  const theme = getPremiumTheme(themeColor || "#FF6B35");
  const ink = getContrastingInk(theme);
  // A pale brand color gets dark ink, so the gradient has to deepen *away*
  // from that ink (toward white) or the bottom of the screen goes unreadable.
  const depth = ink === "#FFFFFF" ? "black" : "white";
  const themeStyle = {
    "--cfd-ink": ink,
    // Set as `background` rather than a Tailwind arbitrary class: a gradient
    // through a CSS var is the shape public-profile.tsx already uses for
    // --store-theme-gradient, and `bg-[var(--x)]` would emit background-COLOR.
    background: `linear-gradient(155deg, ${theme}, color-mix(in srgb, ${theme} 60%, ${depth}))`,
    "--cfd-panel": `color-mix(in srgb, ${ink} 10%, transparent)`,
    "--cfd-panel-strong": `color-mix(in srgb, ${ink} 18%, transparent)`,
    "--cfd-border": `color-mix(in srgb, ${ink} 16%, transparent)`,
    "--cfd-total": `color-mix(in srgb, ${ink} 22%, transparent)`,
  } as React.CSSProperties;

  const lines = snapshot.lines;
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const highlight = lines.find((line) => line.id === snapshot.highlightLineId) ?? null;
  const isPaid = snapshot.phase === "paid";
  // The cashier switched the display off. Standby rather than a frozen last
  // order — a customer must never be shown a total that stopped tracking.
  const isOff = snapshot.phase === "off";

  return (
    <div
      style={themeStyle}
      className="flex min-h-[calc(100dvh/var(--app-zoom,1))] w-full flex-col overflow-y-auto p-4 text-[color:var(--cfd-ink)] sm:p-6 lg:h-[calc(100dvh/var(--app-zoom,1))] lg:overflow-hidden lg:p-8"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 px-1 pb-4 sm:pb-6">
        <p className="min-w-0 truncate text-sm font-medium tracking-wide opacity-70 sm:text-base">
          {now ? formatDate(now, "d MMMM yyyy • HH:mm") : ""}
        </p>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <p className="max-w-[45vw] truncate text-sm font-semibold tracking-[0.14em] uppercase opacity-70 sm:text-base">
            {storeName}
          </p>
          {/* Always visible rather than revealed on hover — a customer display
              is a touch screen with no hover state to reveal it with. */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={t(
              isFullscreen
                ? "pos.customerDisplay.exitFullscreen"
                : "pos.customerDisplay.fullscreen"
            )}
            className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full opacity-50 transition-opacity hover:opacity-100"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {isOff ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 rounded-3xl border border-[color:var(--cfd-border)] bg-[color:var(--cfd-panel)] p-8 text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={storeName}
              className="max-h-[calc(24dvh/var(--app-zoom,1))] w-auto max-w-[60%] object-contain opacity-85"
            />
          ) : (
            <EpidomMark size={96} />
          )}
          <div className="flex items-center gap-2 opacity-60">
            <MonitorOff className="h-4 w-4 shrink-0" />
            <p className="text-sm sm:text-base">{t("pos.customerDisplay.standby")}</p>
          </div>
        </div>
      ) : isPaid ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 rounded-3xl border border-[color:var(--cfd-border)] bg-[color:var(--cfd-panel)] p-8 text-center sm:gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--cfd-panel-strong)] sm:h-20 sm:w-20">
            <Check className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold sm:text-4xl lg:text-5xl">
              {t("pos.customerDisplay.thankYou")}
            </h1>
            <p className="mt-2 text-base opacity-70 sm:text-lg">
              {t("pos.customerDisplay.thankYouDesc")}
            </p>
          </div>
          <p className="text-4xl font-bold tabular-nums sm:text-5xl">
            {formatPrice(snapshot.total)}
          </p>
          {snapshot.paidOrderNumber && (
            <p className="text-sm tracking-[0.16em] uppercase opacity-60 sm:text-base">
              {t("pos.queue.orderNumber")} {snapshot.paidOrderNumber}
            </p>
          )}
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-4 sm:gap-5 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(340px,40%)] lg:gap-6">
          {/* ── Left: the item just rung up, over the store's mark ── */}
          <div className="flex min-w-0 flex-col gap-4 sm:gap-5 lg:min-h-0">
            <div className="shrink-0 rounded-3xl border border-[color:var(--cfd-border)] bg-[color:var(--cfd-panel)] p-5 shadow-lg sm:p-7">
              {highlight ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      {snapshot.highlightIsNew && (
                        <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-60">
                          {t("pos.customerDisplay.justAdded")}
                        </p>
                      )}
                      <h2 className="mt-2 text-2xl leading-tight font-semibold break-words sm:text-3xl lg:text-4xl">
                        {highlight.name}
                      </h2>
                      {highlight.modifiers.length > 0 && (
                        <p className="mt-2 text-sm opacity-70 sm:text-base">
                          {highlight.modifiers.join(" · ")}
                        </p>
                      )}
                      {highlight.notes && (
                        <p className="mt-1 text-sm italic opacity-60 sm:text-base">
                          {highlight.notes}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-[color:var(--cfd-panel-strong)] px-3.5 py-1.5 text-lg font-bold tabular-nums sm:text-xl">
                      {highlight.quantity}×
                    </span>
                  </div>
                  <p className="mt-5 text-right text-3xl font-bold tabular-nums sm:text-4xl lg:text-5xl">
                    {formatPrice(highlight.lineTotal)}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl leading-tight font-semibold sm:text-3xl lg:text-4xl">
                    {t("pos.customerDisplay.welcome")}
                  </h2>
                  <p className="mt-2 text-base opacity-70 sm:text-lg">
                    {t("pos.customerDisplay.welcomeDesc")}
                  </p>
                </>
              )}
            </div>

            <div className="flex min-h-[180px] flex-1 items-center justify-center overflow-hidden rounded-3xl border border-[color:var(--cfd-border)] bg-[color:var(--cfd-panel)] p-6 shadow-lg sm:p-8 lg:min-h-0">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={storeName}
                  className="max-h-full w-auto max-w-[70%] object-contain lg:max-h-[calc(38dvh/var(--app-zoom,1))]"
                />
              ) : (
                <div className="flex flex-col items-center gap-4 opacity-85">
                  <EpidomMark size={104} />
                  {/* No size/tracking utilities: .epi-display is declared
                      unlayered in globals.css, so it outranks anything
                      Tailwind emits into @layer utilities on this element. */}
                  <p className="epi-display opacity-70">EPIDOM</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: the running receipt ── */}
          <div className="flex flex-col overflow-hidden rounded-3xl border border-[color:var(--cfd-border)] bg-[color:var(--cfd-panel)] shadow-lg lg:min-h-0">
            <div className="flex shrink-0 items-baseline justify-between gap-3 border-b border-[color:var(--cfd-border)] px-5 py-4 sm:px-6">
              <h2 className="text-base font-semibold tracking-wide sm:text-lg">
                {t("pos.customerDisplay.yourOrder")}
              </h2>
              {itemCount > 0 && (
                <span className="text-sm tabular-nums opacity-70 sm:text-base">
                  {t(
                    itemCount === 1
                      ? "pos.customerDisplay.itemCountSingular"
                      : "pos.customerDisplay.itemCountPlural"
                  ).replace("{count}", String(itemCount))}
                </span>
              )}
            </div>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center opacity-60">
                <ShoppingBag className="h-8 w-8" />
                <p className="text-sm sm:text-base">{t("pos.customerDisplay.emptyOrder")}</p>
              </div>
            ) : (
              <ul className="max-h-[calc(40dvh/var(--app-zoom,1))] min-h-0 flex-1 divide-y divide-[color:var(--cfd-border)] overflow-y-auto px-5 sm:px-6 lg:max-h-none">
                {lines.map((line) => (
                  <li
                    key={line.id}
                    className={cn(
                      "flex items-start justify-between gap-4 py-3 transition-opacity",
                      line.id === snapshot.highlightLineId ? "opacity-100" : "opacity-80"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium sm:text-base">
                        <span className="tabular-nums opacity-70">{line.quantity}×</span>{" "}
                        {line.name}
                      </p>
                      {line.modifiers.length > 0 && (
                        <p className="mt-0.5 text-xs opacity-60 sm:text-sm">
                          {line.modifiers.join(" · ")}
                        </p>
                      )}
                      {line.notes && (
                        <p className="mt-0.5 text-xs italic opacity-55 sm:text-sm">{line.notes}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums sm:text-base">
                      {formatPrice(line.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="shrink-0 border-t border-[color:var(--cfd-border)] px-5 py-4 sm:px-6 sm:py-5">
              <dl className="space-y-1.5 text-sm sm:text-base">
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
                <TotalsRow label={t("pos.cart.tax")} value={formatPrice(snapshot.tax)} />
              </dl>

              <div className="mt-4 flex items-baseline justify-between gap-3 rounded-2xl bg-[color:var(--cfd-total)] px-4 py-3 sm:px-5 sm:py-4">
                <span className="text-sm font-semibold tracking-[0.12em] uppercase opacity-80 sm:text-base">
                  {t("pos.cart.total")}
                </span>
                <span className="text-2xl font-bold tabular-nums sm:text-3xl">
                  {formatPrice(snapshot.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
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
