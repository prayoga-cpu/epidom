"use client";

import { trackEvent } from "@/lib/analytics";

interface ArticleCtaProps {
  /**
   * "section" is the blog's full-width band after a post. Its markup and
   * inline styles are frozen: blog-post-view.test.tsx pins them against the
   * pre-refactor output, so change them deliberately.
   * "card" is the compact card at the end of a docs guide.
   */
  variant: "section" | "card";
  title: string;
  body?: string;
  button: string;
  /** `event_label` of the `cta_click` event sent on click, e.g. "docs_article_start_free". */
  trackLabel: string;
  href?: string;
}

/**
 * End-of-article conversion path shared by blog posts and docs guides. Copy
 * comes from the caller so each feature keeps its own per-locale COPY map.
 * A plain anchor, not next/link: /register lives outside the marketing
 * locale routing and is unprefixed in every locale.
 */
export function ArticleCta({
  variant,
  title,
  body,
  button,
  trackLabel,
  href = "/register",
}: ArticleCtaProps) {
  const handleClick = () => {
    // Consent-gated inside trackEvent; same event the hero and login CTAs send.
    trackEvent("cta_click", { event_category: "engagement", event_label: trackLabel });
  };

  if (variant === "card") {
    return (
      <aside
        aria-label={title}
        className="mt-14 flex flex-col gap-5 rounded-[20px] border border-[rgba(217,174,59,0.22)] bg-[linear-gradient(180deg,rgba(217,174,59,0.09),rgba(217,174,59,0.03))] p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-7"
      >
        <div className="min-w-0">
          {/* .epi-display is unlayered CSS, so its line-height would beat a Tailwind utility: type stays inline. */}
          <p
            className="epi-display"
            style={{
              margin: 0,
              fontSize: "clamp(22px, 3vw, 28px)",
              lineHeight: 1.05,
              color: "var(--epi-cream-50)",
            }}
          >
            {title}
          </p>
          {body && (
            <p className="mt-2 text-[15px] leading-relaxed text-[rgba(251,249,228,0.6)]">{body}</p>
          )}
        </div>
        <a
          href={href}
          onClick={handleClick}
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-[var(--epi-gold-500)] px-7 text-sm font-bold tracking-[0.06em] whitespace-nowrap text-[var(--epi-navy-900)] no-underline shadow-[0_12px_32px_-10px_rgba(217,174,59,0.65)] transition-transform hover:-translate-y-px"
        >
          {button}
        </a>
      </aside>
    );
  }

  return (
    <section
      style={{
        padding: "100px 24px",
        textAlign: "center",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg, transparent, rgba(217,174,59,0.04))",
      }}
    >
      <h2
        className="epi-display"
        style={{
          fontSize: "clamp(28px, 4.5vw, 48px)",
          margin: "0 0 16px",
          color: "var(--epi-cream-50)",
        }}
      >
        {title}
      </h2>
      {body && (
        <p style={{ fontSize: 16, color: "rgba(251,249,228,0.55)", marginBottom: 32 }}>{body}</p>
      )}
      <a
        href={href}
        onClick={handleClick}
        style={{
          display: "inline-flex",
          padding: "16px 36px",
          borderRadius: 999,
          background: "var(--epi-gold-500)",
          color: "var(--epi-navy-900)",
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textDecoration: "none",
          boxShadow: "0 12px 32px -10px rgba(217,174,59,0.65)",
        }}
      >
        {button}
      </a>
    </section>
  );
}
