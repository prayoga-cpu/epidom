"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { MarketFlag } from "@/components/market-flag";
import { FaqStructuredData } from "@/components/seo/structured-data";
import { OnlineDot } from "@/features/marketing/shared/components/whatsapp-support-menu";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { MailIcon, WhatsAppIcon } from "@/features/marketing/shared/components/contact-icons";
import {
  SUPPORT_EMAIL_ADDRESSES,
  SUPPORT_MAILTO,
  getWhatsAppOptions,
  whatsappHref,
} from "@/lib/constants/contact";
import { usePosTrialHref } from "../lib/use-pos-trial-href";
import { PRIMARY_BUTTON } from "./landing-ui";

export interface FaqItem {
  /** Makes the question linkable: /#faq-<id> opens it and scrolls to it. */
  id?: string;
  q: string;
  a: string;
  /** Optional link shown under the answer (already localised by the caller). */
  link?: { href: string; label: string };
}

/**
 * An answer's verdict ("No.", "Yes, it's your data.", "Free to start.") when it opens
 * the answer in a few words: shown in bold, the rest in the body colour. A long first
 * sentence is not a verdict, so it is left alone; so is a price like "$14.99" (a full
 * stop must be followed by a space).
 */
function splitVerdict(answer: string): { lead: string | null; rest: string } {
  const match = /^(.{1,50}?[.!])\s+([\s\S]+)$/.exec(answer);
  return match ? { lead: match[1], rest: match[2] } : { lead: null, rest: answer };
}

/** The way on, under the answers: the 14-day POS trial, no card. Same link as the hero's. */
function FaqTrialCta() {
  const { t } = useI18n();
  const trialHref = usePosTrialHref();
  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
      <Link
        href={trialHref}
        onClick={() =>
          trackEvent("cta_click", { event_category: "engagement", event_label: "faq_trial" })
        }
        className={cn(PRIMARY_BUTTON, "min-h-12 px-6")}
      >
        {t("redesign.landing.hero.trialCta")}
      </Link>
      <span className="text-epi-cream-50/80 inline-flex items-center gap-1.5 text-sm">
        <Check aria-hidden="true" className="text-epi-gold-300 size-4 shrink-0" />
        {t("redesign.landing.hero.noCard")}
      </span>
    </div>
  );
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
export function FaqSection({
  items,
  trialCta = false,
}: {
  items: FaqItem[];
  /** Ends the list with the 14-day trial button (the home page does; /pricing has its own). */
  trialCta?: boolean;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState<number>(0);
  // Per-instance prefix: two FaqSections on one page must not share element ids.
  const uid = useId();
  const waOptions = getWhatsAppOptions(locale);
  const faqs = items;

  // /#faq-offline opens that question and scrolls it into view (also when the hash changes
  // on the page, e.g. a link clicked inside the answers).
  useEffect(() => {
    const openFromHash = () => {
      const id = window.location.hash.replace(/^#faq-/, "");
      if (!id || id === window.location.hash.slice(1)) return;
      const index = faqs.findIndex((faq) => faq.id === id);
      if (index < 0) return;
      setOpen(index);
      document.getElementById(`faq-${id}`)?.scrollIntoView({ block: "start" });
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
    // The ids are fixed per page; re-running on every render would re-scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="epi-section">
      <FaqStructuredData faqs={faqs} />
      <div className="epi-container">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          {/* Left — sticky heading */}
          <div data-reveal className="lg:sticky lg:top-28">
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
                      <span style={{ opacity: 0.7 }}>
                        {" "}
                        ·{" "}
                        {opt.market === "id"
                          ? t("redesign.landing.hero.supportIndonesia")
                          : t("redesign.landing.hero.supportFrance")}{" "}
                        <MarketFlag market={opt.market} />
                      </span>
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
            <p className="text-epi-cream-50/60 m-0 mt-3 flex items-center gap-2 text-[13px]">
              <OnlineDot />
              {t("redesign.landing.hero.supportLabel")} · {t("redesign.landing.hero.supportValue")}
            </p>
          </div>

          {/* Right — accordion */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {faqs.map((faq, i) => (
              <div
                key={i}
                id={faq.id ? `faq-${faq.id}` : undefined}
                data-reveal
                className="scroll-mt-28"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
              >
                <button
                  type="button"
                  aria-expanded={open === i}
                  aria-controls={`${uid}-a-${i}`}
                  onClick={() => setOpen(open === i ? -1 : i)}
                  className="group cursor-pointer"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    // The open question sits closer to its answer.
                    padding: open === i ? "24px 0 12px" : "24px 0",
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
                    className={cn(
                      "epi-display transition-colors duration-200",
                      open === i
                        ? "text-epi-cream-50"
                        : "text-epi-cream-50/75 group-hover:text-epi-cream-50"
                    )}
                    style={{ fontSize: 22, letterSpacing: "0.04em" }}
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
                      color: open === i ? "var(--epi-gold-400)" : "rgba(251,249,228,0.6)",
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
                        ? "max-height 0.3s var(--epi-ease-out), padding 0.2s, visibility 0s"
                        : "max-height 0.3s var(--epi-ease-out), padding 0.2s, visibility 0s linear 0.3s",
                    paddingBottom: open === i ? 24 : 0,
                  }}
                >
                  {(() => {
                    const { lead, rest } = splitVerdict(faq.a);
                    return (
                      <p
                        style={{
                          color: "rgba(251,249,228,0.8)",
                          fontSize: 15,
                          lineHeight: 1.6,
                          margin: 0,
                          maxWidth: 580,
                        }}
                      >
                        {lead ? (
                          <>
                            <strong style={{ color: "var(--epi-cream-50)", fontWeight: 600 }}>
                              {lead}
                            </strong>{" "}
                          </>
                        ) : null}
                        {rest}
                      </p>
                    );
                  })()}
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
            {trialCta ? <FaqTrialCta /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
