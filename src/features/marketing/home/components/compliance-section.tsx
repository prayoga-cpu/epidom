"use client";

import { Archive, Database, Lock, ShieldCheck, type LucideIcon } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { NF525_SETTLED } from "../lib/migration";
import { cn } from "@/lib/utils";
import { CARD, SectionHeading } from "./landing-ui";

/** The law's four conditions, in its own order (CGI art. 286, I, 3° bis). */
const POINTS: readonly { key: "p1" | "p2" | "p3" | "p4"; icon: LucideIcon }[] = [
  { key: "p1", icon: Lock },
  { key: "p2", icon: ShieldCheck },
  { key: "p3", icon: Database },
  { key: "p4", icon: Archive },
];

/**
 * "A till that meets the anti-fraud VAT law", on the French site. Each claim
 * is what src/lib/fiscal does, and the seal is Epidom's own: never the NF525
 * mark, which only software certified by an accredited body may show. The
 * note under the points says so in words, because the attestation route is
 * the one Epidom takes (docs/FISCAL_JOURNAL.md).
 *
 * Renders nothing until the attestation can be issued (NF525_SETTLED) and on
 * the other sites: it is a French law.
 */
export function ComplianceSection() {
  const { t, locale } = useI18n();
  if (!NF525_SETTLED || locale !== "fr") return null;

  return (
    <section
      id="conformite"
      aria-labelledby="compliance-title"
      className="epi-section scroll-mt-28"
    >
      <div className="epi-container">
        <div className="grid items-center gap-8 lg:grid-cols-[auto_1fr] lg:gap-12">
          <div
            data-testid="compliance-seal"
            className="border-epi-gold-400/60 mx-auto flex size-44 flex-col items-center justify-center gap-1 rounded-full border-2 bg-[radial-gradient(circle_at_50%_35%,rgba(244,220,144,.18),rgba(255,255,255,.02)_70%)] p-5 text-center ring-8 ring-white/[0.03] sm:size-48"
          >
            <ShieldCheck aria-hidden="true" className="text-epi-gold-400 size-10" />
            <p className="text-epi-cream-50 m-0 text-sm leading-tight font-semibold">
              {t("redesign.landing.compliance.badgeTitle")}
            </p>
            <p className="text-epi-cream-50/60 m-0 text-[11px] leading-tight">
              {t("redesign.landing.compliance.badgeSub")}
            </p>
          </div>
          <div>
            <SectionHeading
              id="compliance-title"
              eyebrow={t("redesign.landing.compliance.eyebrow")}
              title={t("redesign.landing.compliance.title")}
            />
            <p className="text-epi-cream-50/75 m-0 mt-4 max-w-2xl text-[15px] leading-relaxed">
              {t("redesign.landing.compliance.body")}
            </p>
          </div>
        </div>

        <ul className="m-0 mt-10 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map(({ key, icon: Icon }) => (
            <li key={key} data-reveal className={cn(CARD, "flex flex-col gap-3 p-6")}>
              <Icon aria-hidden="true" className="text-epi-gold-400 size-6" />
              <h3 className="text-epi-cream-50 m-0 text-lg font-medium">
                {t(`redesign.landing.compliance.${key}Title`)}
              </h3>
              <p className="text-epi-cream-50/70 m-0 text-[15px] leading-relaxed">
                {t(`redesign.landing.compliance.${key}`)}
              </p>
            </li>
          ))}
        </ul>

        <p className="text-epi-cream-50/50 m-0 mt-6 max-w-3xl text-xs leading-relaxed">
          {t("redesign.landing.compliance.note")}
        </p>
      </div>
    </section>
  );
}
