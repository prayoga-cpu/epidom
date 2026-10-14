"use client";

import Link from "next/link";
import { FaqStructuredData } from "@/components/seo/structured-data";
import { useI18n } from "@/components/lang/i18n-provider";
import { MarginCalculatorSection } from "@/features/marketing/home/components/margin-calculator-section";
import { usePosTrialHref } from "@/features/marketing/home/lib/use-pos-trial-href";
import { trackEvent } from "@/lib/analytics";
import { getLocalizedPath } from "@/lib/i18n-routing";
import type { LandingBlock, LandingCta, LandingPage } from "../types";
import { RecipeCostCalculator } from "./recipe-cost-calculator";

const PROSE = {
  fontSize: 16,
  lineHeight: 1.75,
  color: "rgba(251,249,228,0.72)",
  margin: 0,
} as const;

function useCtaHref(target: LandingCta): string {
  const { locale } = useI18n();
  const trialHref = usePosTrialHref();
  if (target === "trial") return trialHref;
  if (target === "pricing") return getLocalizedPath("/pricing", locale);
  return "/register";
}

function Block({ block, page }: { block: LandingBlock; page: LandingPage }) {
  switch (block.type) {
    case "h2":
      return (
        <h2
          className="epi-display"
          style={{
            fontSize: "clamp(24px, 3.2vw, 36px)",
            lineHeight: 1.1,
            color: "var(--epi-cream-50)",
            margin: "18px 0 0",
          }}
        >
          {block.text}
        </h2>
      );
    case "p":
      return <p style={PROSE}>{block.text}</p>;
    case "list":
      return (
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {block.items.map((item, j) => (
            <li
              key={j}
              style={{
                ...PROSE,
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
                padding: "10px 0",
                borderTop: j === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--epi-gold-500)",
                  marginTop: 12,
                  flexShrink: 0,
                }}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {block.items.map((step, j) => (
            <li key={j} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <span
                aria-hidden="true"
                className="epi-display"
                style={{
                  flexShrink: 0,
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  border: "1px solid rgba(217,174,59,0.45)",
                  color: "var(--epi-gold-300)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 17,
                  lineHeight: 1,
                }}
              >
                {j + 1}
              </span>
              <span style={{ ...PROSE, display: "block" }}>
                <strong style={{ color: "var(--epi-cream-50)", fontWeight: 600 }}>
                  {step.title}
                </strong>
                {step.text ? <> — {step.text}</> : null}
              </span>
            </li>
          ))}
        </ol>
      );
    case "callout":
      return (
        <p
          style={{
            ...PROSE,
            color: "var(--epi-cream-50)",
            padding: "18px 20px",
            borderRadius: 18,
            border: "1px solid rgba(217,174,59,0.3)",
            background: "rgba(217,174,59,0.06)",
          }}
        >
          {block.text}
        </p>
      );
    case "tool":
      // Rendered by LandingPageView outside the prose column (it needs the width).
      return null;
  }
}

/** The page's interactive tool, in a container wider than the prose. */
function Tool({ page }: { page: LandingPage }) {
  if (page.tool === "commission") return <MarginCalculatorSection preset={null} />;
  if (page.tool === "recipe-cost")
    return (
      <section className="epi-section" style={{ paddingTop: 8 }}>
        <div className="epi-container" style={{ maxWidth: 1100 }}>
          <RecipeCostCalculator />
        </div>
      </section>
    );
  return null;
}

/**
 * A search landing page (src/features/marketing/landing/content): the answer
 * first, the tool where the page has one, then how Epidom does it, the FAQ
 * (also as FAQPage JSON-LD, from the same strings), related pages in the same
 * language and one call to action.
 */
export function LandingPageView({
  page,
  related,
}: {
  page: LandingPage;
  related: Array<{ href: string; label: string }>;
}) {
  const { t, formatDateOnly } = useI18n();
  const ctaHref = useCtaHref(page.cta.target);
  const track = (where: string) =>
    trackEvent("cta_click", {
      event_category: "engagement",
      event_label: `landing_${page.slug}_${where}`,
    });

  // The tool renders between the article's first section and the rest.
  const toolAt = page.tool ? page.blocks.findIndex((b) => b.type === "tool") : -1;
  const before = toolAt >= 0 ? page.blocks.slice(0, toolAt) : page.blocks;
  const after = toolAt >= 0 ? page.blocks.slice(toolAt + 1) : [];

  const ctaButton = (where: string) => (
    <a
      href={ctaHref}
      onClick={() => track(where)}
      className="inline-flex min-h-12 items-center justify-center rounded-full px-8 text-[15px] font-bold tracking-[0.06em] transition-all hover:-translate-y-px"
      style={{
        background: "var(--epi-gold-500)",
        color: "var(--epi-navy-900)",
        boxShadow: "0 12px 32px -10px rgba(217,174,59,0.65)",
      }}
    >
      {page.cta.button}
    </a>
  );

  return (
    <div style={{ fontFamily: "var(--epi-font-body)" }}>
      {page.faqs.length > 0 && <FaqStructuredData faqs={page.faqs} />}

      <article>
        <header className="epi-section" style={{ paddingTop: 140, paddingBottom: 24 }}>
          <div className="epi-container" style={{ maxWidth: 820 }}>
            <div className="epi-eyebrow" style={{ marginBottom: 20, color: "var(--epi-gold-500)" }}>
              {page.eyebrow}
            </div>
            <h1
              className="epi-display"
              style={{
                fontSize: "clamp(34px, 5.6vw, 64px)",
                lineHeight: 1.04,
                margin: 0,
                color: "var(--epi-cream-50)",
              }}
            >
              {page.h1}
            </h1>
            <p
              style={{
                color: "rgba(251,249,228,0.75)",
                fontSize: 18,
                lineHeight: 1.7,
                maxWidth: 680,
                marginTop: 24,
              }}
            >
              {page.lede}
            </p>
            <div style={{ marginTop: 28 }}>{ctaButton("hero")}</div>
          </div>
        </header>

        <div className="epi-section" style={{ paddingTop: 24 }}>
          <div
            className="epi-container"
            style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 26 }}
          >
            {before.map((block, i) => (
              <Block key={i} block={block} page={page} />
            ))}
          </div>
        </div>

        {toolAt >= 0 && <Tool page={page} />}

        {after.length > 0 && (
          <div className="epi-section" style={{ paddingTop: 24 }}>
            <div
              className="epi-container"
              style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 26 }}
            >
              {after.map((block, i) => (
                <Block key={i} block={block} page={page} />
              ))}
            </div>
          </div>
        )}

        {page.faqs.length > 0 && (
          <section className="epi-section" aria-labelledby="landing-faq">
            <div className="epi-container" style={{ maxWidth: 760 }}>
              <h2
                id="landing-faq"
                className="epi-display"
                style={{
                  fontSize: "clamp(28px, 4vw, 44px)",
                  margin: "0 0 28px",
                  color: "var(--epi-cream-50)",
                }}
              >
                {t("landing.view.faqTitle")}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
                {page.faqs.map((faq, i) => (
                  <div key={i}>
                    <h3
                      style={{
                        fontSize: 17,
                        fontWeight: 600,
                        color: "var(--epi-cream-50)",
                        margin: "0 0 8px",
                      }}
                    >
                      {faq.q}
                    </h3>
                    <p style={{ ...PROSE, fontSize: 15 }}>{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {related.length > 0 && (
          <nav className="epi-section" aria-labelledby="landing-related" style={{ paddingTop: 0 }}>
            <div className="epi-container" style={{ maxWidth: 760 }}>
              <h2
                id="landing-related"
                className="epi-eyebrow"
                style={{ margin: "0 0 14px", color: "var(--epi-gold-500)" }}
              >
                {t("landing.view.related")}
              </h2>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px 10px",
                }}
              >
                {related.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-10 items-center rounded-full border border-white/12 px-4 text-sm transition-colors hover:border-[rgba(217,174,59,0.5)]"
                      style={{ color: "rgba(251,249,228,0.8)" }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p style={{ marginTop: 22, fontSize: 13, color: "rgba(251,249,228,0.4)" }}>
                {t("landing.view.updated").replace(
                  "{date}",
                  formatDateOnly(`${page.updated}T12:00:00Z`)
                )}
              </p>
            </div>
          </nav>
        )}
      </article>

      <section
        style={{
          padding: "90px 24px",
          textAlign: "center",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg, transparent, rgba(217,174,59,0.04))",
        }}
      >
        <h2
          className="epi-display"
          style={{
            fontSize: "clamp(30px, 5vw, 52px)",
            margin: "0 auto 16px",
            maxWidth: 820,
            color: "var(--epi-cream-50)",
          }}
        >
          {page.cta.title}
        </h2>
        <p style={{ ...PROSE, maxWidth: 600, margin: "0 auto 30px" }}>{page.cta.text}</p>
        {ctaButton("footer")}
      </section>
    </div>
  );
}
