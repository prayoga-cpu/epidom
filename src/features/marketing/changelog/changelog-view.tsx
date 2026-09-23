"use client";

/**
 * ChangelogView
 *
 * Presentational rendering of the public product changelog. Data-agnostic:
 * receives already-resolved releases via props. (The in-app dashboard has its
 * own light-theme page; this one is styled for the dark marketing site.)
 *
 * The chrome (headings, tag labels, dates, empty state) follows the visitor's
 * locale. The release entries themselves come from the Release table, which is
 * synced from CHANGELOG.md and written in English, so they are shown as-is and
 * marked `lang="en"` for screen readers; a note on the page says so.
 */

import { useMemo } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { renderInlineMarkdown } from "@/components/shared/rich-text";

type ReleaseTag = "feat" | "fix" | "infra" | "ux";

interface Release {
  version: string;
  releasedAt: string; // ISO string
  tag: ReleaseTag;
  items: string[];
}

const TAG_STYLES: Record<ReleaseTag, { bg: string; text: string }> = {
  feat: { bg: "rgba(217,174,59,0.15)", text: "var(--epi-gold-400)" },
  fix: { bg: "rgba(239,68,68,0.12)", text: "#f87171" },
  infra: { bg: "rgba(99,102,241,0.12)", text: "#a5b4fc" },
  ux: { bg: "rgba(52,211,153,0.12)", text: "#6ee7b7" },
};

export function ChangelogView({ releases }: { releases: Release[] }) {
  const { t, intlLocale } = useI18n();

  const tagLabels: Record<ReleaseTag, string> = {
    feat: t("changelogPage.tagFeat"),
    fix: t("changelogPage.tagFix"),
    infra: t("changelogPage.tagInfra"),
    ux: t("changelogPage.tagUx"),
  };

  // `releasedAt` is a date with no time (CHANGELOG.md headers carry none),
  // stored as UTC midnight. Formatting it in the viewer's own timezone would
  // show the previous day west of Greenwich, so the formatter is pinned to UTC.
  const formatReleaseDate = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(intlLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
    return (iso: string) => {
      const date = new Date(iso);
      return Number.isNaN(date.getTime()) ? iso.slice(0, 10) : formatter.format(date);
    };
  }, [intlLocale]);

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
          maxWidth: 760,
          margin: "0 auto",
          padding: "140px 32px 100px",
          width: "100%",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          className="epi-eyebrow"
          style={{
            marginBottom: 20,
            color: "var(--epi-gold-500)",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {t("changelogPage.eyebrow")}
        </div>
        <h1
          className="epi-display"
          style={{
            fontSize: "clamp(40px, 7vw, 72px)",
            lineHeight: 0.95,
            margin: "0 0 20px",
            color: "var(--epi-cream-50)",
          }}
        >
          {t("changelogPage.title")}
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.75,
            color: "rgba(251,249,228,0.55)",
            maxWidth: 560,
            margin: "0 0 16px",
          }}
        >
          {t("changelogPage.subtitle")}
        </p>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "rgba(251,249,228,0.4)",
            margin: "0 0 64px",
          }}
        >
          {t("changelogPage.englishNote")}
        </p>

        {releases.length === 0 ? (
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "rgba(251,249,228,0.55)",
              margin: 0,
              padding: "32px 0",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {t("changelogPage.empty")}
          </p>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {releases.map((release, i) => {
            const tagKey: ReleaseTag = Object.prototype.hasOwnProperty.call(TAG_STYLES, release.tag)
              ? release.tag
              : "feat";
            const tag = TAG_STYLES[tagKey];
            return (
              <div
                key={release.version}
                style={{
                  paddingTop: i === 0 ? 0 : 48,
                  paddingBottom: 48,
                  borderBottom:
                    i < releases.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 20,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--epi-cream-50)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {release.version} —{" "}
                    <time dateTime={release.releasedAt.slice(0, 10)}>
                      {formatReleaseDate(release.releasedAt)}
                    </time>
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: tag.bg,
                      color: tag.text,
                    }}
                  >
                    {tagLabels[tagKey]}
                  </span>
                </div>
                <ul
                  lang="en"
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {release.items.map((item, j) => (
                    <li key={j} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: tag.text,
                          marginTop: 9,
                          flexShrink: 0,
                          opacity: 0.7,
                        }}
                      />
                      {/* minWidth: 0 is load-bearing — a flex child defaults to
                          min-width:auto and will not shrink below its content,
                          so a single unbreakable token (a shell command, a path)
                          pushes the row past the page instead of wrapping. */}
                      <span
                        style={{
                          fontSize: 14,
                          lineHeight: 1.7,
                          color: "rgba(251,249,228,0.62)",
                          minWidth: 0,
                          flex: 1,
                          overflowWrap: "break-word",
                        }}
                      >
                        {renderInlineMarkdown(item, {
                          // Entries read "**Lead sentence.** supporting detail",
                          // so bold is doing sub-heading duty and lifts to full
                          // cream against the dimmed body around it.
                          strong: { color: "var(--epi-cream-50)", fontWeight: 600 },
                          code: {
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                            fontSize: "0.85em",
                            background: "rgba(255,255,255,0.07)",
                            padding: "1px 5px",
                            borderRadius: 4,
                          },
                          link: { color: tag.text, textDecoration: "underline" },
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
