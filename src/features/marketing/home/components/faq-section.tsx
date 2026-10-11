"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { FaqStructuredData } from "@/components/seo/structured-data";
import { MailIcon, WhatsAppIcon } from "@/features/marketing/shared/components/contact-icons";
import {
  SUPPORT_EMAIL_ADDRESSES,
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
 * One row of the "still have questions?" list: the icon in a small round chip,
 * then the label. The whole row is the link, at least 44px tall.
 */
function ContactLink({
  href,
  external = false,
  icon,
  iconColor,
  children,
}: {
  href: string;
  external?: boolean;
  icon: React.ReactNode;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      // The colour is a class, not an inline style: an inline colour would beat
      // the hover class and the row would never turn gold.
      className="text-epi-cream-50/85 hover:text-epi-gold-300 flex min-h-11 items-start gap-3 py-1.5 text-[15px] leading-[1.55] transition-colors"
    >
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full"
        style={{
          color: iconColor,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        {icon}
      </span>
      <span className="pt-[5px]">{children}</span>
    </a>
  );
}

/**
 * An accordion of questions with the "still have questions?" contact list.
 * Each page passes its own questions: the home page's switcher FAQ, /pricing's
 * buyer questions.
 */
export function FaqSection({ items }: { items: FaqItem[] }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState<number>(0);
  // Per-instance prefix: two FaqSections on one page must not share element ids.
  const uid = useId();
  const waOptions = getWhatsAppOptions(locale);
  const faqs = items;

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
                marginBottom: 8,
              }}
            >
              {t("redesign.faq.helpText")}
            </p>
            {/* One row per WhatsApp number, then one row for email: the support
                inbox is a single mailto to every address (see contact.ts), so
                the addresses are listed under one link, not linked one by one. */}
            <ul className="m-0 flex list-none flex-col p-0">
              {waOptions.map((opt) => (
                <li key={opt.number}>
                  <ContactLink
                    href={whatsappHref(opt.number)}
                    external
                    icon={<WhatsAppIcon className="size-4" />}
                    iconColor="#25D366"
                  >
                    {t("redesign.faq.helpWa")}
                    {waOptions.length > 1 ? (
                      <span style={{ opacity: 0.55 }}> · {opt.label}</span>
                    ) : null}
                  </ContactLink>
                </li>
              ))}
              <li>
                <ContactLink
                  href={SUPPORT_MAILTO}
                  icon={<MailIcon className="size-4" />}
                  iconColor="var(--epi-gold-400)"
                >
                  <span className="flex flex-col">
                    {SUPPORT_EMAIL_ADDRESSES.map((address, i) => (
                      <span key={address} style={{ overflowWrap: "anywhere" }}>
                        {/* Read as one list by screen readers: "a, b, c". */}
                        {i > 0 ? <span className="sr-only">, </span> : null}
                        {address}
                      </span>
                    ))}
                  </span>
                </ContactLink>
              </li>
            </ul>
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
