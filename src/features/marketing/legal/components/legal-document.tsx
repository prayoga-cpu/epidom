"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { SUPPORT_EMAIL_DISPLAY, SUPPORT_MAILTO } from "@/lib/constants/contact";

/**
 * The one template every legal page renders through (Terms, Refund Policy,
 * Privacy, Cookie Policy, GDPR): numbered sections, a sticky contents card on
 * desktop that becomes a collapsible list above the text on mobile, and an
 * optional support-email block.
 *
 * It was extracted from the Terms / Refund implementations, so the desktop
 * markup and styling are deliberately unchanged from those pages. The mobile
 * contents list, the mobile copy of the `aside` callout and the translated
 * chrome ("Legal", "Contents", "Back to home") are the only additions.
 */

export interface LegalLink {
  href: string;
  label: string;
}

/** A list entry: plain text, or text followed by a link (provider policies, related pages). */
export type LegalItem = string | { text: string; link?: LegalLink };

export interface LegalSectionData {
  /** Anchor id — also the contents-list target, so keep it stable once published. */
  id: string;
  title: string;
  /** Lead paragraph under the heading. */
  body?: string;
  items?: LegalItem[];
  /** Numbered-circle steps instead of bullets. */
  ordered?: boolean;
  /** Renders the support-email row under the section, with this label ("Email"). */
  contactLabel?: string;
}

export interface LegalDocumentProps {
  title: string;
  /** Already-composed line, e.g. "Last updated: 20 September 2026". */
  lastUpdated: string;
  intro: string;
  sections: LegalSectionData[];
  footerNote: string;
  /** Which corner the ambient gold glow sits in (Terms right, Refund left). */
  glow?: "left" | "right";
  /** Small highlighted card under the contents: in the desktop sidebar, and under the mobile contents list below lg (the refund page's key policy). */
  aside?: { title: string; body: string };
  /** Extra content rendered under the last section, above the footer note. */
  children?: ReactNode;
}

const isExternal = (href: string) => /^https?:\/\//.test(href);

function InlineLink({ link }: { link: LegalLink }) {
  const style = { color: "var(--epi-gold-400)", textDecoration: "none" } as const;
  if (isExternal(link.href)) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        style={style}
        className="hover:underline"
      >
        {link.label}
      </a>
    );
  }
  return (
    <Link href={link.href} style={style} className="hover:underline">
      {link.label}
    </Link>
  );
}

function ItemContent({ item }: { item: LegalItem }) {
  if (typeof item === "string") return <>{item}</>;
  return (
    <>
      {item.text}
      {item.link && (
        <>
          {" "}
          <InlineLink link={item.link} />
        </>
      )}
    </>
  );
}

/** The highlighted callout (the refund page's key policy). Shown in the desktop sidebar and, below lg, above the text. */
function AsideCard({ aside }: { aside: { title: string; body: string } }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(217,174,59,0.18)",
        background: "rgba(217,174,59,0.05)",
        padding: "18px 20px",
      }}
    >
      <p
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--epi-gold-500)",
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        {aside.title}
      </p>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(251,249,228,0.5)", margin: 0 }}>
        {aside.body}
      </p>
    </div>
  );
}

export function LegalDocument({
  title,
  lastUpdated,
  intro,
  sections,
  footerNote,
  glow = "right",
  aside,
  children,
}: LegalDocumentProps) {
  const { t, locale } = useI18n();
  const contentsLabel = t("legal.contents");

  return (
    <div style={{ fontFamily: "var(--epi-font-body)" }}>
      {/* Ambient glow */}
      <div
        style={{
          position: "fixed",
          top: 0,
          ...(glow === "right" ? { right: 0 } : { left: 0 }),
          width: glow === "right" ? 600 : 500,
          height: glow === "right" ? 500 : 450,
          background:
            glow === "right"
              ? "radial-gradient(ellipse at top right, rgba(217,174,59,0.09), transparent 65%)"
              : "radial-gradient(ellipse at top left, rgba(217,174,59,0.07), transparent 65%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Hero */}
      <section
        className="relative z-10 pt-28 pb-12 lg:pt-36"
        style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px" }}
      >
        <div className="epi-eyebrow" style={{ marginBottom: 20, color: "var(--epi-gold-500)" }}>
          {t("legal.eyebrow")}
        </div>
        <h1
          className="epi-display"
          style={{
            fontSize: "clamp(56px, 9vw, 120px)",
            lineHeight: 0.91,
            margin: 0,
            color: "var(--epi-cream-50)",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            marginTop: 24,
            fontSize: 14,
            color: "rgba(251,249,228,0.38)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {lastUpdated}
        </p>
      </section>

      {/* Body: sidebar + content */}
      <section
        className="relative z-10 grid grid-cols-1 items-start gap-8 lg:grid-cols-[220px_1fr] lg:gap-16"
        style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 120px" }}
      >
        {/* Mobile contents: the desktop card is hidden below lg, so a phone
            reader would otherwise have no way to jump between sections. */}
        <details
          className="group rounded-2xl border lg:hidden"
          style={{
            borderColor: "rgba(217,174,59,0.14)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <summary
            className="flex min-h-11 cursor-pointer list-none items-center justify-between px-5 py-2 text-[10px] font-bold tracking-[0.2em] uppercase [&::-webkit-details-marker]:hidden"
            style={{ color: "var(--epi-gold-500)" }}
          >
            {contentsLabel}
            <ChevronDown
              aria-hidden="true"
              className="size-4 transition-transform group-open:rotate-180"
            />
          </summary>
          <nav aria-label={contentsLabel} className="flex flex-col px-2 pb-3">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex min-h-11 items-center rounded-lg px-3 text-sm leading-snug hover:bg-[rgba(255,255,255,0.04)]"
                style={{ color: "rgba(251,249,228,0.7)", textDecoration: "none" }}
              >
                {s.title}
              </a>
            ))}
          </nav>
        </details>

        {/* The sidebar (and the callout in it) is desktop-only, so a phone reader
            gets the callout here, right under the contents. */}
        {aside && (
          <div className="lg:hidden">
            <AsideCard aside={aside} />
          </div>
        )}

        {/* Sticky TOC */}
        <aside className="sticky top-24 hidden lg:block">
          <div
            style={{
              borderRadius: 16,
              border: "1px solid rgba(217,174,59,0.14)",
              background: "rgba(255,255,255,0.02)",
              padding: "24px 20px",
              ...(aside ? { marginBottom: 20 } : {}),
            }}
          >
            <p
              style={{
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--epi-gold-500)",
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              {contentsLabel}
            </p>
            <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  style={{
                    fontSize: 12,
                    color: "rgba(251,249,228,0.45)",
                    textDecoration: "none",
                    padding: "6px 8px",
                    borderRadius: 8,
                    lineHeight: 1.4,
                    transition: "color 0.15s, background 0.15s",
                  }}
                  className="hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(251,249,228,0.85)]"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </div>

          {aside && <AsideCard aside={aside} />}
        </aside>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Intro card */}
          <div
            style={{
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(217,174,59,0.04)",
              padding: "28px 32px",
              marginBottom: 48,
            }}
          >
            <p
              style={{ fontSize: 16, lineHeight: 1.75, color: "rgba(251,249,228,0.65)", margin: 0 }}
            >
              {intro}
            </p>
          </div>

          {sections.map((s, i) => (
            <div
              key={s.id}
              id={s.id}
              style={{
                paddingTop: i === 0 ? 0 : 48,
                paddingBottom: 48,
                borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                scrollMarginTop: 110,
              }}
            >
              {/* Section number + title */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 20 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                    color: "var(--epi-gold-500)",
                    textTransform: "uppercase",
                    flexShrink: 0,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2
                  className="epi-display"
                  style={{
                    fontSize: "clamp(22px, 2.5vw, 32px)",
                    margin: 0,
                    color: "var(--epi-cream-50)",
                    lineHeight: 1.1,
                  }}
                >
                  {s.title}
                </h2>
              </div>

              {s.body && (
                <p
                  style={{
                    fontSize: 15,
                    lineHeight: 1.78,
                    color: "rgba(251,249,228,0.62)",
                    margin: 0,
                  }}
                >
                  {s.body}
                </p>
              )}

              {/* Bullet list */}
              {s.items && s.items.length > 0 && !s.ordered && (
                <ul
                  style={{
                    margin: s.body ? "20px 0 0" : 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {s.items.map((item, idx) => (
                    <li key={idx} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: "var(--epi-gold-500)",
                          marginTop: 9,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{ fontSize: 15, lineHeight: 1.65, color: "rgba(251,249,228,0.58)" }}
                      >
                        <ItemContent item={item} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Ordered / steps list */}
              {s.items && s.items.length > 0 && s.ordered && (
                <ol
                  style={{
                    margin: s.body ? "20px 0 0" : 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  {s.items.map((item, si) => (
                    <li key={si} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          border: "1px solid rgba(217,174,59,0.35)",
                          background: "rgba(217,174,59,0.08)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--epi-gold-400)",
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        {si + 1}
                      </span>
                      <span
                        style={{ fontSize: 15, lineHeight: 1.65, color: "rgba(251,249,228,0.58)" }}
                      >
                        <ItemContent item={item} />
                      </span>
                    </li>
                  ))}
                </ol>
              )}

              {/* Support contact */}
              {s.contactLabel && (
                <p
                  style={{
                    marginTop: 16,
                    fontSize: 15,
                    color: "rgba(251,249,228,0.62)",
                    lineHeight: 1.78,
                  }}
                >
                  <span
                    style={{
                      color: "rgba(251,249,228,0.4)",
                      fontSize: 12,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    {s.contactLabel}
                    {/* French puts a no-break space before a colon. */}
                    {locale === "fr" ? " :" : ":"}{" "}
                  </span>
                  <a
                    href={SUPPORT_MAILTO}
                    style={{ color: "var(--epi-gold-400)", textDecoration: "none" }}
                    className="hover:underline"
                  >
                    {SUPPORT_EMAIL_DISPLAY}
                  </a>
                </p>
              )}
            </div>
          ))}

          {children}

          {/* Footer note */}
          <div style={{ paddingTop: 40, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(251,249,228,0.3)", margin: 0 }}>
              {footerNote}
            </p>
            <div style={{ marginTop: 32 }}>
              <Link
                href={getLocalizedPath("/", locale)}
                style={{
                  fontSize: 12,
                  color: "rgba(251,249,228,0.35)",
                  textDecoration: "none",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
                className="transition-colors hover:text-[rgba(251,249,228,0.7)]"
              >
                {`← ${t("legal.backHome")}`}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
