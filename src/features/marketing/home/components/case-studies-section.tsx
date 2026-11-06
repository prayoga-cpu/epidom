"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { cn } from "@/lib/utils";
import {
  CASE_STUDIES,
  getPublishableCaseStudies,
  type CaseStudy,
} from "@/features/marketing/home/data/case-studies";
import { resolveLocalizedText } from "@/features/marketing/home/data/localized-text";
import { LIGHT_BUTTON, SectionHeading } from "./landing-ui";

/**
 * Real merchant results as a carousel: the shop, its owner's own words and the
 * figures that were checked, one story at a time with its neighbours peeking
 * in. Driven entirely by data/case-studies.ts. With no publishable entry it
 * renders nothing at all (no heading, no spacing), so an empty list leaves no
 * hole and no placeholder proof on the page; every figure carries its source.
 *
 * The track is a scroll-snap row (swipe on a phone, arrows on desktop); the
 * card nearest the middle is the open one and the others are dimmed.
 */
export function CaseStudiesSection({ studies = CASE_STUDIES }: { studies?: readonly CaseStudy[] }) {
  const { t, locale } = useI18n();
  const publishable = getPublishableCaseStudies(studies);
  const track = useRef<HTMLUListElement>(null);
  // It opens on the SECOND story, so a neighbour peeks in on each side (the
  // first alone would leave the left side empty); a single story is the first.
  const start = Math.min(1, Math.max(publishable.length - 1, 0));
  const [active, setActive] = useState(start);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const rejected = studies.length - getPublishableCaseStudies(studies).length;
    if (rejected > 0) {
      console.warn(
        `[case-studies] ${rejected} entr${rejected === 1 ? "y" : "ies"} not shown: each needs every field, and either no metrics or two or three with a source (see data/case-studies.ts).`
      );
    }
  }, [studies]);

  // The open card is the one whose middle is nearest the track's middle.
  const onScroll = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const middle = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDistance = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const card = child as HTMLElement;
      const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle);
      if (distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    });
    setActive(best);
  }, []);

  function go(index: number, behavior: ScrollBehavior = "smooth") {
    const el = track.current;
    const card = el?.children[index] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo?.({
      left: card.offsetLeft + card.offsetWidth / 2 - el.clientWidth / 2,
      behavior,
    });
    setActive(index);
  }

  // Centre the opening story before the first paint, without a scroll animation.
  const count = publishable.length;
  useLayoutEffect(() => {
    if (count > 1) go(Math.min(1, count - 1), "instant");
    // Only when the number of stories changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (publishable.length === 0) return null;

  const quoteMarks = locale === "fr" ? (["« ", " »"] as const) : (["“", "”"] as const);
  const several = publishable.length > 1;

  return (
    // A cream panel inset from the screen edges, the same frame as the hero card.
    <section id="case-studies" aria-labelledby="case-studies-title" className="p-2 sm:p-3 lg:p-4">
      <div className="epi-section epi-warm-section epi-surface-panel overflow-hidden rounded-[24px] sm:rounded-[32px]">
        <div className="epi-container mb-12 sm:mb-14">
          <SectionHeading
            id="case-studies-title"
            align="center"
            tone="light"
            eyebrow={t("redesign.caseStudies.eyebrow")}
            title={
              <>
                {t("redesign.caseStudies.title1")}
                <br />
                {t("redesign.caseStudies.title2")}
              </>
            }
          />
        </div>

        <div aria-roledescription="carousel" aria-label={t("redesign.caseStudies.title1")}>
          <ul
            ref={track}
            onScroll={onScroll}
            className="relative m-0 flex snap-x snap-mandatory list-none items-stretch gap-4 overflow-x-auto px-[max(1.25rem,calc((100%-min(88vw,760px))/2))] pb-2 [scrollbar-width:none] sm:gap-6 [&::-webkit-scrollbar]:hidden"
          >
            {publishable.map((study, index) => {
              const href = study.storyHref;
              const internal = href?.startsWith("/");
              const summary = study.summary ? resolveLocalizedText(study.summary, locale) : "";
              const role = study.ownerRole ? resolveLocalizedText(study.ownerRole, locale) : "";
              return (
                <li
                  key={study.slug}
                  aria-roledescription="slide"
                  aria-label={`${index + 1} / ${publishable.length}`}
                  className={cn(
                    "flex shrink-0 basis-[min(88vw,760px)] snap-center flex-col justify-between gap-8 rounded-[28px] bg-[rgba(6,15,27,0.05)] p-6 transition-[opacity,transform] duration-300 sm:p-9",
                    index === active ? "opacity-100" : "scale-[0.97] opacity-55"
                  )}
                >
                  <div className="flex flex-col gap-8 md:flex-row md:gap-10">
                    <div className="flex min-w-0 flex-1 flex-col gap-6">
                      {/* The shop's mark: its initial and its name, until it supplies a logo. */}
                      <div className="flex items-center gap-3 text-[var(--epi-navy-900)]">
                        <span
                          aria-hidden="true"
                          className="epi-display inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--epi-navy-900)] text-2xl text-[var(--epi-cream-50)]"
                        >
                          {study.shopName.trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="epi-display text-2xl leading-none">{study.shopName}</span>
                      </div>
                      {summary ? (
                        <p className="m-0 text-sm leading-relaxed text-[var(--epi-navy-700)]">
                          {summary}
                        </p>
                      ) : null}
                      <blockquote className="m-0 border-l-2 border-[var(--epi-gold-500)] pl-5 text-xl leading-snug font-medium text-[var(--epi-navy-900)] sm:text-2xl">
                        {quoteMarks[0]}
                        {resolveLocalizedText(study.quote, locale)}
                        {quoteMarks[1]}
                      </blockquote>
                    </div>

                    {study.metrics ? (
                      <div className="flex shrink-0 flex-col gap-5 md:w-[34%]">
                        {study.metrics.map((metric) => (
                          <div key={metric.label} data-reveal className="min-w-0">
                            <div className="epi-display text-[clamp(34px,4vw,48px)] leading-none text-[var(--epi-navy-900)]">
                              {metric.value}
                            </div>
                            <div className="mt-1.5 text-sm text-[var(--epi-navy-900)]">
                              {metric.label}
                            </div>
                            <div className="mt-1 text-[11px] leading-snug text-[var(--epi-navy-700)] opacity-70">
                              {t("redesign.caseStudies.source")}
                              {locale === "fr" ? " " : ""}: {metric.source}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="inline-flex size-12 items-center justify-center rounded-xl bg-[var(--epi-gold-500)]/25 text-lg font-medium text-[var(--epi-navy-900)]"
                      >
                        {study.ownerName.trim().charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-[var(--epi-navy-900)]">
                          {study.ownerName}
                        </div>
                        <div className="text-xs text-[var(--epi-navy-700)] opacity-80">
                          {role ? `${role} · ` : ""}
                          {study.shopName} · {study.location}
                        </div>
                      </div>
                    </div>

                    {href ? (
                      <a
                        href={internal ? getLocalizedPath(href, locale) : href}
                        {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                        className={LIGHT_BUTTON}
                      >
                        {t("redesign.caseStudies.readStory")}
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {several ? (
            <div className="mt-8 flex justify-center gap-2">
              {(
                [
                  { dir: -1, label: "prev", Icon: ChevronLeft },
                  { dir: 1, label: "next", Icon: ChevronRight },
                ] as const
              ).map(({ dir, label, Icon }) => (
                <button
                  key={label}
                  type="button"
                  aria-label={t(`redesign.caseStudies.${label}`)}
                  disabled={active + dir < 0 || active + dir >= publishable.length}
                  onClick={() => go(active + dir)}
                  className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-[rgba(6,15,27,0.12)] bg-white text-[var(--epi-navy-900)] shadow-sm transition-opacity hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--epi-gold-600)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon aria-hidden="true" className="size-5" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
