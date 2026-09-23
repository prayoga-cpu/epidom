"use client";

import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { cn } from "@/lib/utils";

interface PlaceholderPageProps {
  eyebrow: string;
  title: string;
  body: string;
  /**
   * Optional call-to-action area, rendered right under the body so it stays
   * above the fold on a phone: a row of `PlaceholderCta` buttons or a compact
   * card. Pages that pass nothing render exactly as before.
   */
  actions?: React.ReactNode;
  /** Optional extra content below the body */
  children?: React.ReactNode;
}

export function PlaceholderPage({ eyebrow, title, body, actions, children }: PlaceholderPageProps) {
  const { t, locale } = useI18n();
  return (
    <div
      style={{
        fontFamily: "var(--epi-font-body)",
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: 500,
          height: 400,
          background:
            "radial-gradient(ellipse at top right, rgba(217,174,59,0.10), transparent 65%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <section
        style={{
          flex: 1,
          maxWidth: 860,
          margin: "0 auto",
          padding: "140px 32px 100px",
          width: "100%",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div className="epi-eyebrow" style={{ marginBottom: 20, color: "var(--epi-gold-500)" }}>
          {eyebrow}
        </div>
        <h1
          className="epi-display"
          style={{
            fontSize: "clamp(52px, 8vw, 96px)",
            lineHeight: 0.93,
            margin: "0 0 28px",
            color: "var(--epi-cream-50)",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: 18,
            lineHeight: 1.75,
            color: "rgba(251,249,228,0.6)",
            maxWidth: 640,
            margin: 0,
          }}
        >
          {body}
        </p>

        {actions ? (
          // Stacked full-width on a phone (each button is its own tap row), a
          // wrapping row from `sm` up.
          <div
            data-slot="placeholder-actions"
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
          >
            {actions}
          </div>
        ) : null}

        {children}

        <div style={{ marginTop: 56, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Link
            href={getLocalizedPath("/", locale)}
            style={{
              fontSize: 13,
              color: "rgba(251,249,228,0.45)",
              textDecoration: "none",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
            className="inline-flex min-h-11 items-center transition-colors hover:text-[rgba(251,249,228,0.8)]"
          >
            ← {t("notFound.backToHome")}
          </Link>
        </div>
      </section>
    </div>
  );
}

/**
 * Pill-shaped call-to-action link for placeholder pages — a real `<a>`, so a
 * `mailto:` or `wa.me` deep link works without JavaScript. At least 48px tall
 * (the touch-target floor is 44px), and long localised labels wrap instead of
 * overflowing a 375px screen. Hover only brightens; nothing depends on it.
 */
export function PlaceholderCta({
  href,
  children,
  variant = "primary",
  external = false,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  /** Opens in a new tab (WhatsApp); leave off for `mailto:` links. */
  external?: boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-full px-6 py-3 text-center text-sm leading-snug font-medium tracking-[0.06em] text-balance uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--epi-gold-400)]",
        variant === "primary"
          ? "bg-[var(--epi-gold-500)] text-[var(--epi-navy-900)] hover:bg-[var(--epi-gold-400)]"
          : "border border-white/20 text-[var(--epi-cream-50)] hover:bg-white/5"
      )}
    >
      {children}
    </a>
  );
}

/** Reusable section divider with a heading for placeholder content blocks */
export function PlaceholderSection({
  title,
  items,
  footer,
}: {
  title: string;
  items: string[];
  /** Optional content under the list, e.g. a call-to-action for that section. */
  footer?: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 56, paddingTop: 48, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      <h2
        style={{
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--epi-gold-500)",
          fontWeight: 700,
          marginBottom: 24,
        }}
      >
        {title}
      </h2>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {items.map((item, i) => (
          <li key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--epi-gold-500)",
                marginTop: 8,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 15, lineHeight: 1.65, color: "rgba(251,249,228,0.65)" }}>
              {item}
            </span>
          </li>
        ))}
      </ul>
      {footer ? <div className="mt-7">{footer}</div> : null}
    </div>
  );
}
