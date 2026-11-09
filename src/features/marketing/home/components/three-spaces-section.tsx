"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Check,
  Coffee,
  Cookie,
  Home,
  Printer,
  Soup,
  WifiOff,
} from "lucide-react";
import { INTL_LOCALES, useI18n } from "@/components/lang/i18n-provider";
import { LANDING_GROUPS } from "@/features/marketing/landing/registry";
import { trackEvent } from "@/lib/analytics";
import { LOCALE_PRICE_CURRENCY } from "@/lib/constants/plan-pricing";
import { getLocalizedPath } from "@/lib/i18n-routing";
import type { ProductScreen } from "@/features/marketing/shared/content/product-screens";
import type { BadgePlan } from "../data/problems";
import { cn } from "@/lib/utils";
import {
  CARD_INTERACTIVE,
  PlanBadge,
  SECONDARY_BUTTON,
  SectionHeading,
  TEXT_LINK,
} from "./landing-ui";
import { ClaudeMark } from "@/components/claude-mark";
import { OnlineDot } from "@/features/marketing/shared/components/whatsapp-support-menu";

/** Each card's demo: the shared sample café (see src/app/demo/[target]/route.ts). */
const DEMO_HREF = {
  storefront: "/demo/phone-orders",
  pos: "/demo/pos",
  backOffice: "/demo/dashboard",
} as const;

const STEPS: readonly { key: "storefront" | "pos" | "backOffice"; plan: BadgePlan }[] = [
  { key: "storefront", plan: "FREE" },
  { key: "pos", plan: "POS" },
  { key: "backOffice", plan: "OPERATIONS" },
];

/**
 * "One link, 3 devices connected": Phone Orders (free), POS Mode (POS) and the Store
 * Dashboard (Operations) as three illustrated steps, then a status line that
 * leads to the Claude connector. Each card's picture is drawn in code (a
 * stylised phone menu, an order ticket, profit bars: illustrations, never
 * passed off as product screens, and the sample figures are not claims). The
 * first card's link opens a real, currently published storefront when there is
 * one (the server page streams that slug in); the other two point to the
 * Products page, because there is no public demo of the till or the dashboard
 * to open. It replaced the screenshot cards (2026-11-07).
 */
export function ThreeSpacesSection(
  {
    // The home page still passes its streamed example slug; the demo café replaced it.
  }: {
    exampleStorefrontSlug?: Promise<string | null> | string | null;
  }
) {
  const { t, locale } = useI18n();
  // The Claude connector page, in the visitor's language (else the products page).
  const connectorSlug = LANDING_GROUPS["claude-connector"][locale];

  // Sample figures in the visitor's currency (rupiah figures are written in thousands).
  const currency = LOCALE_PRICE_CURRENCY[locale];
  const scale = currency === "IDR" ? 1000 : 1;
  const money = (n: number) =>
    new Intl.NumberFormat(INTL_LOCALES[locale], {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "IDR" || Number.isInteger(n * scale) ? 0 : 2,
      maximumFractionDigits: currency === "IDR" ? 0 : 2,
    }).format(n * scale);

  const visuals: Record<(typeof STEPS)[number]["key"], ReactNode> = {
    storefront: (
      <PhoneMenuArt
        cafe={t("redesign.landing.spaces.vCafe")}
        menu={t("redesign.landing.spaces.vMenu")}
        tabs={[
          t("redesign.landing.spaces.vCoffee"),
          t("redesign.landing.spaces.vPastry"),
          t("redesign.landing.spaces.vFood"),
        ]}
        items={[
          { name: "Iced latte", price: money(4.5), icon: <Coffee className="size-4" /> },
          { name: "Butter cookie", price: money(2.8), icon: <Cookie className="size-4" /> },
        ]}
        footer={`${t("redesign.landing.spaces.vItems").replace("{n}", "2")} · ${money(7.3)}`}
        order={t("redesign.landing.spaces.vOrderBtn")}
      />
    ),
    pos: (
      <TicketArt
        title={t("redesign.landing.spaces.vOrderNo")}
        total={money(20.8)}
        lines={[
          { name: "2× Iced latte", icon: <Coffee className="size-4" />, done: true },
          { name: "Nasi goreng", icon: <Soup className="size-4" />, done: false },
          { name: "Butter cookie", icon: <Cookie className="size-4" />, done: false },
        ]}
        chips={[
          { label: t("redesign.landing.spaces.vPrinted"), icon: <Printer className="size-3.5" /> },
          { label: t("redesign.landing.spaces.vOffline"), icon: <WifiOff className="size-3.5" /> },
        ]}
      />
    ),
    backOffice: <ProfitArt label={t("redesign.landing.spaces.vProfit")} value={money(1240)} />,
  };

  return (
    <section aria-labelledby="spaces-title" className="epi-section">
      <div className="epi-container">
        <SectionHeading
          id="spaces-title"
          eyebrow={t("redesign.landing.spaces.eyebrow")}
          title={t("redesign.landing.spaces.title")}
          sub={t("redesign.landing.spaces.sub")}
        />

        <ol className="m-0 mt-12 grid list-none gap-5 p-0 md:grid-cols-3">
          {STEPS.map(({ key, plan }, index) => (
            <li key={key} data-reveal className="flex flex-col gap-5">
              <div
                aria-hidden="true"
                className="aspect-[4/3] overflow-hidden rounded-3xl border border-white/10"
              >
                {visuals[key]}
              </div>
              <div className={cn(CARD_INTERACTIVE, "flex flex-1 flex-col gap-3")}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-epi-gold-300 m-0 text-xs font-medium tracking-[0.16em] uppercase">
                    {t("redesign.landing.spaces.stepLabel").replace(
                      "{n}",
                      String(index + 1).padStart(2, "0")
                    )}
                  </p>
                  <PlanBadge plan={plan} />
                </div>
                <h3 className="epi-display text-epi-cream-50 m-0 text-3xl">
                  {t(`redesign.landing.spaces.${key}Name`)}
                </h3>
                <p className="text-epi-cream-50/75 m-0 text-[15px] leading-relaxed">
                  {t(`redesign.landing.spaces.${key}Short`)}
                </p>
                {/* A shared, read-only demo café with sample data (src/lib/demo/): no
                    sign-up, opens in a new tab so the page stays where it is. */}
                <a
                  href={DEMO_HREF[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent("demo_open", { target: key })}
                  className={cn(TEXT_LINK, "mt-auto min-h-11 font-semibold")}
                >
                  {t(
                    key === "storefront"
                      ? "redesign.landing.spaces.demo"
                      : "redesign.landing.spaces.demoOpen"
                  )}{" "}
                  →
                </a>
              </div>
            </li>
          ))}
        </ol>

        <p className="text-epi-cream-50/80 m-0 mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2 font-medium">
            <OnlineDot />
            {t("redesign.landing.spaces.allRunning")}
          </span>
          <span aria-hidden="true" className="text-epi-cream-50/30">
            ·
          </span>
          <Link
            href={getLocalizedPath(connectorSlug ? `/${connectorSlug}` : "/products", locale)}
            onClick={() =>
              trackEvent("claude_promo_click", {
                event_category: "claude_connector",
                surface: "home_steps",
              })
            }
            className={cn(SECONDARY_BUTTON, "min-h-11 gap-2 px-5 text-sm")}
          >
            <ClaudeMark className="size-4 shrink-0" />
            {t("redesign.landing.spaces.connectClaude")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </p>
      </div>
    </section>
  );
}

/** Step 1's picture: a phone showing a small menu, with a QR tag hanging off its corner. */
function PhoneMenuArt({
  cafe,
  menu,
  tabs,
  items,
  footer,
  order,
}: {
  cafe: string;
  menu: string;
  tabs: string[];
  items: { name: string; price: string; icon: ReactNode }[];
  footer: string;
  order: string;
}) {
  return (
    <div className="relative size-full overflow-hidden bg-white">
      <div className="bg-epi-cream-50 absolute top-[10%] left-[18%] flex h-[96%] w-[56%] flex-col gap-2 rounded-t-3xl border-[6px] border-b-0 border-[#1a2547] p-3 text-[#1a2547]">
        <p className="text-epi-gold-700 m-0 text-[8px] tracking-[0.16em] uppercase">{cafe}</p>
        <p className="epi-display m-0 text-xl leading-none">{menu}</p>
        <div className="flex gap-1">
          {tabs.map((tab, i) => (
            <span
              key={tab}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[8px]",
                i === 0 ? "text-epi-cream-50 border-transparent bg-[#1a2547]" : "border-black/15"
              )}
            >
              {tab}
            </span>
          ))}
        </div>
        {items.map((item) => (
          <div key={item.name} className="flex items-center gap-2 rounded-xl bg-white p-1.5">
            <span className="text-epi-cream-50 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1a2547]">
              {item.icon}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[9px] font-semibold">{item.name}</span>
              <span className="block text-[8px] opacity-60">{item.price}</span>
            </span>
            <span className="bg-epi-gold-500 flex size-5 items-center justify-center rounded text-xs font-bold">
              +
            </span>
          </div>
        ))}
        <div className="text-epi-cream-50 mt-auto flex items-center justify-between rounded-lg bg-[#1a2547] px-2.5 py-2 text-[8px]">
          <span>{footer}</span>
          <span className="text-epi-gold-400 font-semibold">{order}</span>
        </div>
      </div>
      {/* The QR tag. */}
      <div className="bg-epi-cream-100 border-epi-gold-500/30 absolute top-[8%] right-[8%] flex size-[24%] items-center justify-center rounded-xl border p-2">
        <svg viewBox="0 0 24 24" className="size-full text-[#1a2547]" fill="currentColor">
          <path d="M1 1h8v8H1zM3 3v4h4V3zM15 1h8v8h-8zM17 3v4h4V3zM1 15h8v8H1zM3 17v4h4v-4zM11 1h2v2h-2zM11 5h2v4h-2zM11 11h4v2h-4zM15 13h2v4h-2zM19 11h4v2h-4zM17 17h2v2h-2zM21 15h2v4h-2zM13 17h2v6h-2zM19 21h4v2h-4z" />
        </svg>
      </div>
    </div>
  );
}

/** Step 2's picture: an order ticket with its lines ticked off, and two reassurance chips. */
function TicketArt({
  title,
  total,
  lines,
  chips,
}: {
  title: string;
  total: string;
  lines: { name: string; icon: ReactNode; done: boolean }[];
  chips: { label: string; icon: ReactNode }[];
}) {
  return (
    <div className="flex size-full flex-col justify-center gap-3 bg-[#1a2547] p-[8%]">
      <div className="bg-epi-cream-50 rounded-2xl p-3 text-[#1a2547]">
        <div className="mb-2 flex items-center justify-between font-mono text-[11px] font-semibold">
          <span>{title}</span>
          <span>{total}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {lines.map((line) => (
            <div key={line.name} className="flex items-center gap-2 rounded-xl bg-white p-1.5">
              <span className="text-epi-cream-50 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#1a2547]">
                {line.icon}
              </span>
              <span className="flex-1 text-[10px] font-medium">{line.name}</span>
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded border",
                  line.done ? "border-transparent bg-[#1a2547]" : "border-black/20"
                )}
              >
                {line.done ? <Check className="text-epi-cream-50 size-3" /> : null}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip.label}
            className="text-epi-cream-50/90 bg-epi-navy-800 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px]"
          >
            {chip.icon}
            {chip.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Step 3's picture: today's profit and four bars, up or down, on gold. */
function ProfitArt({ label, value }: { label: string; value: string }) {
  const bars: { h: string; up: boolean; icon: ReactNode; light: boolean }[] = [
    { h: "55%", up: true, icon: <Coffee className="size-4" />, light: false },
    { h: "35%", up: false, icon: <Soup className="size-4" />, light: true },
    { h: "78%", up: true, icon: <Cookie className="size-4" />, light: false },
    { h: "46%", up: true, icon: <Home className="size-4" />, light: true },
  ];
  return (
    <div className="bg-epi-gold-500 relative flex size-full items-end gap-[3%] px-[6%]">
      <div className="absolute top-[9%] left-[6%] rounded-xl bg-[#1a2547] px-3 py-2">
        <p className="text-epi-gold-300 m-0 text-[8px] tracking-[0.12em] uppercase">{label}</p>
        <p className="text-epi-cream-50 m-0 mt-0.5 flex items-center gap-1.5 font-mono text-lg font-semibold">
          {value}
          <ArrowUp className="text-epi-gold-400 size-3.5" />
        </p>
      </div>
      {bars.map((bar, i) => (
        <div
          key={i}
          style={{ height: bar.h }}
          className={cn(
            "flex flex-1 flex-col items-center justify-between rounded-t-xl py-2",
            bar.light ? "bg-epi-cream-50 text-[#1a2547]" : "text-epi-cream-50 bg-[#1a2547]"
          )}
        >
          {bar.up ? (
            <ArrowUp className="text-epi-gold-500 size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )}
          {bar.icon}
        </div>
      ))}
    </div>
  );
}

/**
 * A 16:10 window on a space's screenshot, so the three cards line up whatever
 * the capture's shape. A phone capture stands in it as a phone, cut off at the
 * bottom; a desktop capture fills it from the top-left corner.
 */
export function SpaceShot({ shot, alt }: { shot: ProductScreen; alt: string }) {
  const placeholder = shot.src.blurDataURL ? "blur" : "empty";
  return (
    <div className="bg-epi-navy-900 relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(217,174,59,0.16),transparent_65%)]">
      {shot.device === "phone" ? (
        <div className="absolute top-4 left-1/2 aspect-[514/1106] w-[44%] -translate-x-1/2 overflow-hidden rounded-t-[20px] border border-white/15 shadow-2xl">
          <Image
            src={shot.src}
            alt={alt}
            fill
            sizes="(min-width: 768px) 160px, 45vw"
            placeholder={placeholder}
            className="object-cover object-top"
          />
        </div>
      ) : (
        <Image
          src={shot.src}
          alt={alt}
          fill
          sizes="(min-width: 1240px) 380px, (min-width: 768px) 33vw, 100vw"
          placeholder={placeholder}
          className="object-cover object-left-top"
        />
      )}
    </div>
  );
}
