"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  Bell,
  Coffee,
  CupSoda,
  Printer,
  Sandwich,
  TriangleAlert,
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
 * Dashboard (Operations) as three steps, then a status line that leads to the
 * Claude connector. Each card's picture is a real photo of the place (a café's
 * menu board, a kitchen pass, an owner's desk) laid faintly on a solid brand
 * colour, with one small product element on top: the QR tag, the two
 * reassurance pills, today's profit. Decorative: the sample figure is not a
 * claim. It replaced the pictures drawn in code (2026-11-11), which replaced the
 * screenshot cards (2026-11-07). The demo link under each card opens the shared
 * sample café (see src/app/demo/[target]/route.ts).
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

  // The sample figure in the visitor's currency (rupiah figures are written in thousands).
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
    // The QR tag on the table, then the phone it opens: the tag shrinks aside
    // and the menu rises beside it, over and over (CSS in globals.css, .spc-*).
    storefront: (
      <PhotoArt photo="phone-orders" tone="cream">
        <div className="spc-phone absolute bottom-[-12%] left-[46%] flex aspect-[9/17] w-[32%] flex-col rounded-[14px] border border-white/25 bg-[#10193a] p-[3%] shadow-[0_18px_40px_rgba(10,16,32,0.4)]">
          <div className="bg-epi-cream-50 flex flex-1 flex-col gap-[5%] rounded-[10px] p-[8%]">
            <span className="bg-epi-gold-500 block h-[5%] w-2/5 rounded-full" />
            {(
              [
                { icon: Coffee, name: "Latte" },
                { icon: Sandwich, name: "Burger" },
                { icon: CupSoda, name: "Soda" },
              ] as const
            ).map(({ icon: Icon, name }, row) => (
              <span
                key={name}
                className={cn(
                  "relative flex flex-1 items-center gap-[7%] rounded-lg bg-[#1a2547]/[0.07] px-[6%]",
                  row === 1 && "spc-row"
                )}
              >
                <span className="bg-epi-gold-500/80 flex aspect-square h-[66%] items-center justify-center rounded-md text-[#1a2547]">
                  <Icon className="size-[62%]" strokeWidth={2} />
                </span>
                {/* No label on purpose: the icon says it, and text this small is unreadable. */}
                <span className="min-w-0 flex-1" aria-hidden />
                <span className="sr-only">{name}</span>
                <span className="bg-epi-gold-500 flex aspect-square h-[26%] shrink-0 items-center justify-center rounded-full text-[7px] leading-none font-bold text-[#1a2547]">
                  +
                </span>
              </span>
            ))}
          </div>
          <span className="spc-pop bg-epi-gold-400 absolute -top-[4%] -right-[7%] flex aspect-square w-[22%] items-center justify-center rounded-full text-[#1a2547] shadow-[0_6px_16px_rgba(10,16,32,0.35)]">
            <Bell className="spc-ring size-[58%]" strokeWidth={2.25} />
          </span>
        </div>
        <div className="spc-qr absolute top-1/2 left-1/2 size-[34%]">
          <div className="spc-bob bg-epi-cream-50 border-epi-gold-500/40 size-full rounded-2xl border p-[4%] shadow-[0_16px_40px_rgba(10,16,32,0.25)]">
            <svg viewBox="0 0 24 24" className="size-full text-[#1a2547]" fill="currentColor">
              <path d="M1 1h8v8H1zM3 3v4h4V3zM15 1h8v8h-8zM17 3v4h4V3zM1 15h8v8H1zM3 17v4h4v-4zM11 1h2v2h-2zM11 5h2v4h-2zM11 11h4v2h-4zM15 13h2v4h-2zM19 11h4v2h-4zM17 17h2v2h-2zM21 15h2v4h-2zM13 17h2v6h-2zM19 21h4v2h-4z" />
            </svg>
          </div>
        </div>
      </PhotoArt>
    ),
    // Two reassurance pills slide in, a ticket prints, the Wi-Fi icon blinks.
    pos: (
      <PhotoArt photo="pos" tone="navy">
        <div className="absolute right-[8%] bottom-[8%] h-[48%] w-[24%] overflow-hidden">
          <span className="absolute inset-x-0 top-0 z-10 block h-1.5 rounded-full bg-[#0a1020]" />
          <div className="spc-print bg-epi-cream-50 absolute inset-x-[6%] top-1 flex h-[96%] flex-col gap-[7%] rounded-b-sm p-[10%] pt-[14%] shadow-[0_8px_24px_rgba(10,16,32,0.35)]">
            <span className="block h-1.5 w-3/5 rounded-full bg-[#1a2547]/70" />
            {[80, 65, 90, 50].map((w) => (
              <span
                key={w}
                className="block h-1 rounded-full bg-[#1a2547]/30"
                style={{ width: `${w}%` }}
              />
            ))}
            <span className="bg-epi-gold-500 mt-auto block h-1.5 w-2/5 self-end rounded-full" />
          </div>
        </div>
        <div className="absolute bottom-[8%] left-[6%] flex flex-col items-start gap-2">
          {[
            {
              label: t("redesign.landing.spaces.vPrinted"),
              icon: <Printer className="spc-blink size-3.5" />,
            },
            {
              label: t("redesign.landing.spaces.vOffline"),
              icon: <WifiOff className="spc-blink size-3.5" />,
            },
          ].map((chip, i) => (
            <span
              key={chip.label}
              style={{ animationDelay: `${i * 0.45}s` }}
              className="spc-chip bg-epi-cream-50 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-[#1a2547] shadow-[0_6px_20px_rgba(10,16,32,0.3)]"
            >
              {chip.icon}
              {chip.label}
            </span>
          ))}
        </div>
      </PhotoArt>
    ),
    // Today's profit counts up, its little bars grow, the arrow nudges.
    backOffice: (
      <PhotoArt photo="dashboard" tone="gold">
        <div className="spc-bob absolute top-[9%] left-[6%] rounded-xl bg-[#1a2547] px-3.5 py-2.5 shadow-[0_10px_30px_rgba(10,16,32,0.35)]">
          <p className="text-epi-gold-300 m-0 text-[9px] tracking-[0.12em] uppercase">
            {t("redesign.landing.spaces.vProfit")}
          </p>
          <p className="text-epi-cream-50 m-0 mt-0.5 flex items-center gap-1.5 font-mono text-xl font-semibold">
            <CountUp to={1240} format={money} />
            <ArrowUp className="spc-nudge text-epi-gold-400 size-4" />
          </p>
          <div className="mt-2 flex h-6 items-end gap-1">
            {[35, 55, 45, 75, 100].map((h, i) => (
              <span
                key={h}
                className="spc-bar bg-epi-gold-400/80 block w-full origin-bottom rounded-sm"
                style={{ height: `${h}%`, animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
        <div className="spc-stock absolute right-[6%] bottom-[9%] flex items-center gap-2 rounded-xl bg-[#1a2547] px-3 py-2 shadow-[0_10px_30px_rgba(10,16,32,0.35)]">
          <TriangleAlert className="spc-warn size-4 shrink-0 text-[#ff5a52]" />
          <div className="flex flex-col gap-1">
            <p className="text-epi-cream-50 m-0 text-[10px] leading-none font-medium">
              {t("redesign.landing.spaces.vStock")}
            </p>
            <span className="block h-1.5 w-20 overflow-hidden rounded-full bg-white/15">
              <span className="spc-drain block bg-[#ff5a52] h-full w-full origin-left scale-x-[0.18] rounded-full" />
            </span>
          </div>
        </div>
      </PhotoArt>
    ),
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

/**
 * A number that counts up from zero to `to` over ~2 s, holds, and starts over
 * every 7 s (the same beat as the bars next to it). It renders the final value
 * first (server render, reduced motion, tests) and only animates once it is on
 * screen.
 */
function CountUp({ to, format }: { to: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let visible = typeof IntersectionObserver === "undefined";
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    observer?.observe(node);
    const start = performance.now();
    const tick = (now: number) => {
      if (visible) {
        const t = ((now - start) % 7000) / 2200;
        const eased = t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
        setValue(Math.round(to * eased));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [to]);

  return <span ref={ref}>{format(value)}</span>;
}

/**
 * One card's picture: a solid brand colour with a real photo of the place laid
 * on it as a faint texture (grayscale file, so the colour stays the brand's),
 * and one product element on top. `blend` is how the photo meets the colour:
 * multiply darkens a light ground (cream, gold), screen lifts a dark one (navy).
 * The photos are CC0, in public/images/spaces/ (see CREDITS.md there).
 */
function PhotoArt({
  photo,
  tone,
  children,
}: {
  photo: string;
  tone: "cream" | "navy" | "gold";
  children: ReactNode;
}) {
  const ground = {
    cream: "bg-epi-cream-100",
    navy: "bg-[#1a2547]",
    gold: "bg-epi-gold-500",
  }[tone];
  const blend = {
    cream: "mix-blend-multiply opacity-60",
    navy: "mix-blend-screen opacity-30",
    gold: "mix-blend-multiply opacity-55",
  }[tone];
  return (
    <div className={cn("relative size-full overflow-hidden", ground)}>
      <Image
        src={`/images/spaces/${photo}.jpg`}
        alt=""
        fill
        sizes="(min-width: 1240px) 380px, (min-width: 768px) 33vw, 100vw"
        className={cn("object-cover", blend)}
      />
      {children}
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
