"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  LayoutGrid,
  Link2,
  PackageCheck,
  Percent,
  QrCode,
  ReceiptText,
  RefreshCw,
  Smartphone,
  TrendingUp,
  UserRound,
  Users,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { trackEvent } from "@/lib/analytics";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PAIN,
  PAINS,
  PLATFORM_COMMISSION_PERCENT,
  STOCK_GUIDE_SLUG,
  type Pain,
  type PainId,
} from "../data/problems";
import { usePosTrialHref } from "../lib/use-pos-trial-href";
import { PlanBadge, PRIMARY_BUTTON, SectionHeading, SourceRef } from "./landing-ui";
import { onlinePaymentCopyKey } from "@/config/storefront-ordering.config";

const ILLUSTRATION: Record<PainId, { before: LucideIcon; after: LucideIcon }> = {
  commissions: { before: Percent, after: Link2 },
  margin: { before: ReceiptText, after: TrendingUp },
  stock: { before: ClipboardList, after: PackageCheck },
  outages: { before: WifiOff, after: RefreshCw },
  queues: { before: Users, after: QrCode },
  staff: { before: UserRound, after: Smartphone },
  apps: { before: LayoutGrid, after: Link2 },
};

/**
 * "Which problem costs you the most?": the visitor picks their pain and sees
 * the fix. Chips from sm up, a native select on a phone. Commissions is
 * selected on load so the panel is never empty, and the panel is a polite
 * live region so a screen reader hears the new content.
 */
export function ProblemPickerSection({
  onOpenCalculator,
}: {
  /** Scrolls to the calculator; `commission` (in %) presets its rate. */
  onOpenCalculator: (preset?: { commission: number }) => void;
}) {
  const { t, locale } = useI18n();
  const selectId = useId();
  const [selected, setSelected] = useState<PainId>(DEFAULT_PAIN);
  const pain = PAINS.find((p) => p.id === selected) ?? PAINS[0];

  const choose = (id: PainId) => {
    if (id === selected) return;
    setSelected(id);
    trackEvent("problem_selected", { pain_id: id });
  };

  return (
    <section id="problems" aria-labelledby="problems-title" className="epi-section">
      <div className="epi-container">
        <SectionHeading
          id="problems-title"
          eyebrow={t("redesign.landing.picker.eyebrow")}
          title={t("redesign.landing.picker.title")}
        />

        <div className="mt-10">
          <label htmlFor={selectId} className="sr-only sm:hidden">
            {t("redesign.landing.picker.selectLabel")}
          </label>
          <select
            id={selectId}
            value={selected}
            onChange={(e) => choose(e.target.value as PainId)}
            className="bg-epi-navy-850 text-epi-cream-50 h-12 w-full rounded-xl border border-white/15 px-4 text-base sm:hidden"
          >
            {PAINS.map((p) => (
              <option key={p.id} value={p.id}>
                {t(`redesign.landing.picker.pains.${p.id}.chip`)}
              </option>
            ))}
          </select>

          <div
            role="group"
            aria-label={t("redesign.landing.picker.selectLabel")}
            className="hidden flex-wrap gap-2.5 sm:flex"
          >
            {PAINS.map((p) => {
              const active = p.id === selected;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => choose(p.id)}
                  className={cn(
                    "focus-visible:outline-epi-gold-300 min-h-11 cursor-pointer rounded-full border px-5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                    active
                      ? "border-epi-gold-500 bg-epi-gold-500 text-epi-navy-900"
                      : "text-epi-cream-50 border-white/15 bg-white/[0.03] hover:border-white/35"
                  )}
                >
                  {t(`redesign.landing.picker.pains.${p.id}.chip`)}
                </button>
              );
            })}
          </div>
        </div>

        <div aria-live="polite" className="mt-6">
          <PainPanel
            key={pain.id}
            pain={pain}
            locale={locale}
            onOpenCalculator={onOpenCalculator}
          />
        </div>
      </div>
    </section>
  );
}

function PainPanel({
  pain,
  locale,
  onOpenCalculator,
}: {
  pain: Pain;
  locale: "en" | "fr" | "id";
  onOpenCalculator: (preset?: { commission: number }) => void;
}) {
  const { t } = useI18n();
  const trialHref = usePosTrialHref();
  const k = (field: string) => t(`redesign.landing.picker.pains.${pain.id}.${field}`);
  const Illustration = ILLUSTRATION[pain.id];
  const ctaLabel = k("cta");
  const trackCta = () => trackEvent("problem_cta_click", { pain_id: pain.id, cta: pain.cta });

  let cta;
  if (pain.cta === "calculator") {
    cta = (
      <a
        href="#calculator"
        onClick={() => {
          trackCta();
          onOpenCalculator(
            pain.id === "commissions" ? { commission: PLATFORM_COMMISSION_PERCENT } : undefined
          );
        }}
        className={PRIMARY_BUTTON}
      >
        {ctaLabel}
      </a>
    );
  } else {
    const href =
      pain.cta === "trial"
        ? trialHref
        : pain.cta === "stockGuide"
          ? getLocalizedPath(`/docs/${STOCK_GUIDE_SLUG[locale]}`, locale)
          : "/register";
    cta = (
      <Link href={href} onClick={trackCta} className={PRIMARY_BUTTON}>
        {ctaLabel}
      </Link>
    );
  }

  return (
    <article
      aria-labelledby={`pain-${pain.id}`}
      className="grid gap-8 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-5 sm:p-8 lg:grid-cols-2 lg:gap-12 lg:p-10"
    >
      <div className="min-w-0">
        <div className="text-epi-cream-50/50 text-xs tracking-[0.18em] uppercase">
          {t("redesign.landing.picker.painLabel")}
        </div>
        <h3
          id={`pain-${pain.id}`}
          className="epi-display text-epi-cream-50 mt-3 text-[clamp(28px,3.4vw,44px)] leading-[0.95]"
        >
          {k("pain")}
        </h3>
        {pain.numberSource ? (
          <p className="text-epi-gold-300 mt-4 text-base leading-relaxed">
            {k("number")}
            <SourceRef id={pain.numberSource} />
            {pain.numberNote ? (
              <span className="text-epi-cream-50/70 ml-2 inline-block rounded-full border border-white/15 px-2 py-0.5 align-middle text-[11px] tracking-[0.1em] uppercase">
                {k("numberNote")}
              </span>
            ) : null}
          </p>
        ) : null}

        {/* Before → after, drawn with icons and words: no screenshot claims. */}
        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-3">
          <figure className="m-0 flex flex-col gap-2 rounded-2xl border border-[rgba(254,43,43,0.25)] bg-[rgba(254,43,43,0.05)] p-3 sm:p-4">
            <Illustration.before aria-hidden="true" className="size-6 text-[#FE6B6B]" />
            <figcaption className="text-[11px] tracking-[0.14em] text-[#FE6B6B] uppercase">
              {t("redesign.landing.picker.beforeLabel")}
            </figcaption>
            <p className="text-epi-cream-50/80 m-0 text-sm leading-snug">{k("before")}</p>
          </figure>
          <ArrowRight aria-hidden="true" className="text-epi-cream-50/40 size-5 self-center" />
          <figure className="border-epi-gold-500/40 bg-epi-gold-500/10 m-0 flex flex-col gap-2 rounded-2xl border p-3 sm:p-4">
            <Illustration.after aria-hidden="true" className="text-epi-gold-400 size-6" />
            <figcaption className="text-epi-gold-300 text-[11px] tracking-[0.14em] uppercase">
              {t("redesign.landing.picker.afterLabel")}
            </figcaption>
            <p className="text-epi-cream-50 m-0 text-sm leading-snug">
              {k(pain.id === "commissions" ? onlinePaymentCopyKey("after") : "after")}
            </p>
          </figure>
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-epi-cream-50/50 mr-1 text-xs tracking-[0.18em] uppercase">
            {t("redesign.landing.picker.fixLabel")}
          </span>
          {pain.plans.map((plan) => (
            <PlanBadge key={plan} plan={plan} />
          ))}
        </div>
        <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
          {([1, 2, 3] as const).map((n) => {
            const source = pain.fixSources?.[n];
            return (
              <li key={n} className="text-epi-cream-50 flex gap-3 text-[15px] leading-relaxed">
                <span aria-hidden="true" className="text-epi-gold-400">
                  ✓
                </span>
                <span>
                  {k(
                    pain.id === "commissions" && n === 2 ? onlinePaymentCopyKey("fix2") : `fix${n}`
                  )}
                  {source ? <SourceRef id={source} /> : null}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-8 lg:mt-auto lg:pt-8">{cta}</div>
      </div>
    </article>
  );
}
