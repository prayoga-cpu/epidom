"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { FaqStructuredData } from "@/components/seo/structured-data";
import {
  SUPPORT_EMAIL_DISPLAY,
  SUPPORT_MAILTO,
  getWhatsAppOptions,
  whatsappHref,
} from "@/lib/constants/contact";

export interface FaqItem {
  q: string;
  a: string;
  /** Optional link shown under the answer (already localised by the caller). */
  link?: { href: string; label: string };
}

/**
 * The homepage questions, in order: what <FaqSection /> shows when a page does
 * not pass its own `items` (/pricing does).
 */
function useHomeFaqItems(): FaqItem[] {
  const { t } = useI18n();
  return [1, 2, 3, 4, 5, 6].map((n) => ({
    q: t(`redesign.faq.q${n}` as const),
    a: t(`redesign.faq.a${n}` as const),
  }));
}

export function FaqSection({ items }: { items?: FaqItem[] }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState<number>(0);
  // Per-instance prefix: two FaqSections on one page must not share element ids.
  const uid = useId();
  const waOptions = getWhatsAppOptions(locale);
  const homeItems = useHomeFaqItems();
  const faqs = items ?? homeItems;

  return (
    <section className="epi-section">
      <FaqStructuredData faqs={faqs} />
      <div className="epi-container">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          {/* Left — sticky heading */}
          <div className="lg:sticky lg:top-28">
            <div className="epi-eyebrow" style={{ marginBottom: 16 }}>
              {t("redesign.faq.eyebrow")}
            </div>
            <h2
              className="epi-display"
              style={{
                fontSize: "clamp(40px, 5vw, 72px)",
                margin: 0,
                lineHeight: 0.95,
                color: "var(--epi-cream-50)",
              }}
            >
              {t("redesign.faq.title")}
            </h2>
            <p
              className="epi-script"
              style={{
                fontSize: 22,
                color: "var(--epi-gold-300)",
                marginTop: 18,
                lineHeight: 1.3,
                display: "block",
              }}
            >
              {t("redesign.faq.script")}
            </p>
            <p
              style={{
                color: "var(--epi-cream-50)",
                opacity: 0.6,
                fontSize: 15,
                lineHeight: 1.55,
                marginTop: 20,
              }}
            >
              {t("redesign.faq.helpText")}{" "}
              {waOptions.map((opt, i) => (
                <span key={opt.number}>
                  {i > 0 && " / "}
                  <a
                    href={whatsappHref(opt.number)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#25D366",
                      borderBottom: "1px solid #25D366",
                    }}
                  >
                    {waOptions.length > 1
                      ? `${t("redesign.faq.helpWa")} (${opt.label})`
                      : t("redesign.faq.helpWa")}
                  </a>
                </span>
              ))}{" "}
              {t("redesign.faq.helpOr")}{" "}
              <a
                href={SUPPORT_MAILTO}
                style={{
                  color: "var(--epi-gold-400)",
                  borderBottom: "1px solid var(--epi-gold-500)",
                  overflowWrap: "anywhere",
                }}
              >
                {SUPPORT_EMAIL_DISPLAY}
              </a>
              .
            </p>
          </div>

          {/* Right — accordion */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {faqs.map((faq, i) => (
              <div key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <button
                  type="button"
                  aria-expanded={open === i}
                  aria-controls={`${uid}-a-${i}`}
                  onClick={() => setOpen(open === i ? -1 : i)}
                  className="cursor-pointer"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "24px 0",
                    gap: 24,
                    width: "100%",
                    minHeight: 44,
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    color: "inherit",
                  }}
                >
                  <span
                    className="epi-display"
                    style={{
                      fontSize: 22,
                      letterSpacing: "0.04em",
                      color: open === i ? "var(--epi-cream-50)" : "rgba(251,249,228,0.5)",
                      transition: "color 0.2s",
                    }}
                  >
                    {faq.q}
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: "1px solid rgba(255,255,255,0.12)",
                      display: "grid",
                      placeItems: "center",
                      color: open === i ? "var(--epi-gold-400)" : "rgba(251,249,228,0.4)",
                      transition: "transform 0.2s, color 0.2s",
                      transform: open === i ? "rotate(45deg)" : "rotate(0)",
                      flexShrink: 0,
                      fontSize: 20,
                    }}
                  >
                    +
                  </span>
                </button>
                <div
                  id={`${uid}-a-${i}`}
                  style={{
                    // Generous ceiling: the pricing answers are several lines long
                    // and must not be clipped on a 375px-wide phone.
                    maxHeight: open === i ? 640 : 0,
                    overflow: "hidden",
                    // A closed answer is clipped, not removed, so it would stay in the
                    // accessibility tree and the tab order. visibility flips at the end
                    // of the collapse (delayed by its 0.3s) and at the start of the
                    // expand, so the animation is untouched.
                    visibility: open === i ? "visible" : "hidden",
                    transition:
                      open === i
                        ? "max-height 0.3s ease, padding 0.2s, visibility 0s"
                        : "max-height 0.3s ease, padding 0.2s, visibility 0s linear 0.3s",
                    paddingBottom: open === i ? 24 : 0,
                  }}
                >
                  <p
                    style={{
                      color: "var(--epi-cream-50)",
                      opacity: 0.65,
                      fontSize: 15,
                      lineHeight: 1.6,
                      margin: 0,
                      maxWidth: 580,
                    }}
                  >
                    {faq.a}
                  </p>
                  {faq.link && (
                    <Link
                      href={faq.link.href}
                      style={{
                        display: "inline-block",
                        marginTop: 12,
                        padding: "8px 0",
                        color: "var(--epi-gold-400)",
                        fontSize: 14,
                        borderBottom: "1px solid var(--epi-gold-500)",
                      }}
                    >
                      {faq.link.label}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
