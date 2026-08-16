"use client";

/**
 * ChangelogView
 *
 * Presentational rendering of the product changelog. Data-agnostic:
 * receives already-resolved releases via props so it can be reused by
 * both the public marketing page and the in-app dashboard page.
 */

import { renderInlineMarkdown } from "@/components/shared/rich-text";

type ReleaseTag = "feat" | "fix" | "infra" | "ux";

interface Release {
  version: string;
  releasedAt: string; // ISO string
  tag: ReleaseTag;
  items: string[];
}

const TAG_STYLES: Record<ReleaseTag, { bg: string; text: string; label: string }> = {
  feat: { bg: "rgba(217,174,59,0.15)", text: "var(--epi-gold-400)", label: "Feature" },
  fix: { bg: "rgba(239,68,68,0.12)", text: "#f87171", label: "Fix" },
  infra: { bg: "rgba(99,102,241,0.12)", text: "#a5b4fc", label: "Infra" },
  ux: { bg: "rgba(52,211,153,0.12)", text: "#6ee7b7", label: "UX" },
};

/** Format an ISO date to YYYY-MM-DD for the release label. */
function formatReleaseDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function ChangelogView({ releases }: { releases: Release[] }) {
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
          Changelog
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
          What's new in Epidom.
        </h1>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.75,
            color: "rgba(251,249,228,0.55)",
            maxWidth: 560,
            margin: "0 0 64px",
          }}
        >
          Every improvement, fix, and new feature — shipped fast and documented here.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {releases.map((release, i) => {
            const tag = TAG_STYLES[release.tag] ?? TAG_STYLES.feat;
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
                    {release.version} — {formatReleaseDate(release.releasedAt)}
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
                    {tag.label}
                  </span>
                </div>
                <ul
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
                            fontFamily:
                              "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
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
