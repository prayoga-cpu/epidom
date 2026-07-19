"use client";

import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";

const SECTIONS = [
  { id: "s1", key: "section1" },
  { id: "s2", key: "section2" },
  { id: "s3", key: "section3" },
  { id: "s4", key: "section4" },
  { id: "s5", key: "section5" },
  { id: "s6", key: "section6" },
  { id: "s7", key: "section7" },
  { id: "s8", key: "section8" },
  { id: "s9", key: "section9" },
  { id: "s10", key: "section10" },
] as const;

const LIST_SECTIONS = new Set(["section3", "section4", "section5"]);

export function TermsContent() {
  const { t } = useI18n();

  return (
    <div style={{ fontFamily: "var(--epi-font-body)" }}>
      {/* Ambient glow */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: 600,
          height: 500,
          background:
            "radial-gradient(ellipse at top right, rgba(217,174,59,0.09), transparent 65%)",
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
          Legal
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
          {t("terms.title")}
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
          {t("terms.lastUpdated")} {t("terms.lastUpdatedDate")}
        </p>
      </section>

      {/* Body: sidebar + content */}
      <section
        className="relative z-10 grid grid-cols-1 items-start gap-8 lg:grid-cols-[220px_1fr] lg:gap-16"
        style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 120px" }}
      >
        {/* Sticky TOC */}
        <aside className="sticky top-24 hidden lg:block">
          <div
            style={{
              borderRadius: 16,
              border: "1px solid rgba(217,174,59,0.14)",
              background: "rgba(255,255,255,0.02)",
              padding: "24px 20px",
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
              Contents
            </p>
            <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {SECTIONS.map((s) => (
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
                  {t(`terms.${s.key}.title` as Parameters<typeof t>[0])}
                </a>
              ))}
            </nav>
          </div>
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
              {t("terms.introduction")}
            </p>
          </div>

          {SECTIONS.map((s, i) => (
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
                  {t(`terms.${s.key}.title` as Parameters<typeof t>[0])}
                </h2>
              </div>

              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.78,
                  color: "rgba(251,249,228,0.62)",
                  margin: 0,
                }}
              >
                {t(`terms.${s.key}.content` as Parameters<typeof t>[0])}
              </p>

              {/* List items */}
              {LIST_SECTIONS.has(
                s.key as (typeof s.key & "section3") | "section4" | "section5"
              ) && (
                <ul
                  style={{
                    margin: "20px 0 0",
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {(["item1", "item2", "item3", "item4"] as const).map((item) => (
                    <li key={item} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
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
                        {t(`terms.${s.key}.${item}` as Parameters<typeof t>[0])}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Contact section extras */}
              {s.key === "section10" && (
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
                    {t("terms.section10.email")}:{" "}
                  </span>
                  <a
                    href="mailto:cro@prionation.io,ceo@prionation.io,consult@prionation.io"
                    style={{ color: "var(--epi-gold-400)", textDecoration: "none" }}
                    className="hover:underline"
                  >
                    cro@prionation.io, ceo@prionation.io, consult@prionation.io
                  </a>
                </p>
              )}
            </div>
          ))}

          {/* Footer note */}
          <div style={{ paddingTop: 40, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(251,249,228,0.3)", margin: 0 }}>
              {t("terms.footer")}
            </p>
            <div style={{ marginTop: 32 }}>
              <Link
                href="/"
                style={{
                  fontSize: 12,
                  color: "rgba(251,249,228,0.35)",
                  textDecoration: "none",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
                className="transition-colors hover:text-[rgba(251,249,228,0.7)]"
              >
                ← Back to home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
