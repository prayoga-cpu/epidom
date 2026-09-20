"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { getLocalizedPath } from "@/lib/i18n-routing";
import {
  CASE_STUDIES,
  getPublishableCaseStudies,
  type CaseStudy,
} from "@/features/marketing/home/data/case-studies";
import { resolveLocalizedText } from "@/features/marketing/home/data/localized-text";

/**
 * Real merchant results, driven entirely by data/case-studies.ts. With no
 * publishable entry it renders nothing at all (no heading, no spacing), so an
 * empty list leaves no hole and no placeholder proof on the page.
 */
export function CaseStudiesSection({ studies = CASE_STUDIES }: { studies?: readonly CaseStudy[] }) {
  const { t, locale } = useI18n();
  const publishable = getPublishableCaseStudies(studies);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const rejected = studies.length - getPublishableCaseStudies(studies).length;
    if (rejected > 0) {
      console.warn(
        `[case-studies] ${rejected} entr${rejected === 1 ? "y" : "ies"} not shown: each needs every field and exactly 2 metrics with a source (see data/case-studies.ts).`
      );
    }
  }, [studies]);

  if (publishable.length === 0) return null;

  const quoteMarks = locale === "fr" ? (["« ", " »"] as const) : (["“", "”"] as const);

  return (
    <section
      id="case-studies"
      aria-labelledby="case-studies-title"
      className="epi-section epi-warm-section overflow-hidden"
    >
      <div className="epi-container">
        <div className="mx-auto mb-12 max-w-[720px] text-center sm:mb-14">
          <div className="epi-eyebrow mb-4 text-[var(--epi-gold-600)]">
            {t("redesign.caseStudies.eyebrow")}
          </div>
          <h2
            id="case-studies-title"
            className="epi-display m-0 text-[clamp(40px,5vw,72px)] leading-[0.95] text-[var(--epi-navy-900)]"
          >
            {t("redesign.caseStudies.title1")}
            <br />
            {t("redesign.caseStudies.title2")}
          </h2>
        </div>

        <ul className="m-0 flex list-none flex-wrap justify-center gap-5 p-0">
          {publishable.map((study) => {
            const href = study.storyHref;
            const internal = href?.startsWith("/");
            return (
              <li
                key={study.slug}
                className="flex basis-full flex-col gap-6 rounded-[22px] border border-[rgba(6,15,27,0.08)] bg-white/55 p-6 md:basis-[calc(50%-0.625rem)] lg:basis-[calc(33.333%-0.84rem)]"
              >
                <blockquote className="m-0 flex-1 text-base leading-relaxed text-[var(--epi-navy-900)]">
                  {quoteMarks[0]}
                  {resolveLocalizedText(study.quote, locale)}
                  {quoteMarks[1]}
                </blockquote>

                <div>
                  <div className="text-sm font-medium text-[var(--epi-navy-900)]">
                    {study.ownerName}
                  </div>
                  <div className="text-xs text-[var(--epi-navy-700)] opacity-80">
                    {study.shopName} · {study.location}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-[rgba(6,15,27,0.08)] pt-5">
                  {study.metrics.map((metric) => (
                    <div key={metric.label} className="min-w-0">
                      <div className="epi-display text-3xl leading-none text-[var(--epi-navy-900)]">
                        {metric.value}
                      </div>
                      <div className="mt-1.5 text-sm text-[var(--epi-navy-900)]">
                        {metric.label}
                      </div>
                      <div className="mt-1 text-[11px] leading-snug text-[var(--epi-navy-700)] opacity-70">
                        {t("redesign.caseStudies.source")}
                        {locale === "fr" ? " " : ""}: {metric.source}
                      </div>
                    </div>
                  ))}
                </div>

                {href && (
                  <a
                    href={internal ? getLocalizedPath(href, locale) : href}
                    {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                    className="inline-flex min-h-11 w-fit items-center text-sm text-[var(--epi-gold-700)] underline decoration-[rgba(191,142,49,0.5)] underline-offset-4"
                  >
                    {t("redesign.caseStudies.readStory")} →
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
