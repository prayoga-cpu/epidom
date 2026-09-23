"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { resolveLocalizedText } from "@/features/marketing/home/data/localized-text";
import { TEAM_MEMBERS, type TeamMember } from "@/features/marketing/about/data/team";

const VALUES = ["v1", "v2", "v3"] as const;

export function AboutPageClient({ team = TEAM_MEMBERS }: { team?: readonly TeamMember[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();

  return (
    <div style={{ fontFamily: "var(--epi-font-body)" }}>
      {/* ── Hero ── */}
      <section
        style={{
          minHeight: "100vh",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "0 0 80px",
        }}
      >
        {/* Subtle top-right ambient glow — matches screenshot */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 600,
            height: 500,
            background:
              "radial-gradient(ellipse at top right, rgba(217,174,59,0.13), transparent 65%)",
            pointerEvents: "none",
          }}
        />

        <div
          className="pt-24 lg:pt-36"
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            padding: "0 24px",
            paddingBottom: 0,
            width: "100%",
          }}
        >
          {/* Eyebrow */}
          <div className="epi-eyebrow" style={{ marginBottom: 28, color: "var(--epi-gold-500)" }}>
            {t("about.eyebrow")}
          </div>

          {/* Headline */}
          <h1
            className="epi-display"
            style={{
              fontSize: "clamp(64px, 11vw, 160px)",
              lineHeight: 0.9,
              margin: 0,
              color: "var(--epi-cream-50)",
            }}
          >
            {t("about.headline1")}
            <br />
            <span style={{ color: "var(--epi-gold-400)" }}>{t("about.headlineAccent")}</span>
          </h1>

          {/* Script */}
          <p
            className="epi-script"
            style={{
              fontSize: "clamp(20px, 2.5vw, 30px)",
              color: "var(--epi-cream-100)",
              marginTop: 36,
              maxWidth: 660,
              lineHeight: 1.5,
              opacity: 0.75,
            }}
          >
            {t("about.script")}
          </p>
        </div>
      </section>

      {/* ── Story ── */}
      <section style={{ padding: "80px 0 100px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px" }}>
          <div className="flex max-w-[720px] flex-col gap-7">
            {[t("about.p1"), t("about.p2"), t("about.p3")].map((para, i) => (
              <p
                key={i}
                style={{
                  fontSize: 17,
                  lineHeight: 1.75,
                  color: "rgba(251,249,228,0.72)",
                  margin: 0,
                }}
              >
                {para}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section style={{ padding: "80px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 48px" }}>
          <div className="epi-eyebrow" style={{ marginBottom: 48, color: "var(--epi-gold-500)" }}>
            {t("about.valuesEyebrow")}
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3" style={{ gap: 28 }}>
            {VALUES.map((v, i) => (
              <div
                key={v}
                style={{
                  padding: "32px 28px",
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div
                  className="epi-script"
                  aria-hidden="true"
                  style={{
                    fontSize: 30,
                    lineHeight: 1,
                    color: "var(--epi-gold-500)",
                    opacity: 0.85,
                    marginBottom: 18,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: "var(--epi-cream-50)",
                    margin: "0 0 10px",
                  }}
                >
                  {t(`about.${v}title` as Parameters<typeof t>[0])}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: "rgba(251,249,228,0.55)",
                    margin: 0,
                  }}
                >
                  {t(`about.${v}body` as Parameters<typeof t>[0])}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section style={{ padding: "80px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px" }}>
          <div className="max-w-[720px]">
            <div className="epi-eyebrow" style={{ marginBottom: 18, color: "var(--epi-gold-500)" }}>
              {t("about.teamEyebrow")}
            </div>
            <h2
              className="epi-display"
              style={{
                fontSize: "clamp(36px, 4vw, 64px)",
                lineHeight: 0.95,
                margin: "0 0 20px",
                color: "var(--epi-cream-50)",
              }}
            >
              {t("about.teamTitle")}
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(251,249,228,0.6)", margin: 0 }}>
              {t("about.teamBody")}
            </p>
            <a
              href={getLocalizedPath("/build-with-us", locale)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                minHeight: 44,
                marginTop: 12,
                fontSize: 14,
                color: "var(--epi-gold-400)",
                textDecoration: "none",
                borderBottom: "1px solid rgba(217,174,59,0.4)",
              }}
            >
              {t("about.buildWithUs")} →
            </a>
          </div>

          {/* Real people only: renders nothing until data/team.ts has entries. */}
          {team.length > 0 && (
            <ul
              data-testid="team-members"
              className="m-0 mt-12 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3"
            >
              {team.map((member) => (
                <li
                  key={member.slug}
                  className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
                >
                  <Image
                    src={member.photo}
                    alt={member.name}
                    width={88}
                    height={88}
                    sizes="88px"
                    className="size-22 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0">
                    <div className="text-base font-bold text-[var(--epi-cream-50)]">
                      {member.name}
                    </div>
                    <div className="mt-0.5 text-sm text-[rgba(251,249,228,0.6)]">
                      {resolveLocalizedText(member.role, locale)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        style={{
          padding: "100px 48px",
          textAlign: "center",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg, transparent, rgba(217,174,59,0.04))",
        }}
      >
        <h2
          className="epi-display"
          style={{
            fontSize: "clamp(48px, 7vw, 96px)",
            margin: "0 0 16px",
            color: "var(--epi-cream-50)",
            lineHeight: 0.95,
          }}
        >
          {t("about.ctaTitle")}
        </h2>
        <p style={{ fontSize: 17, color: "rgba(251,249,228,0.55)", marginBottom: 36 }}>
          {t("about.ctaBody")}
        </p>
        <button
          onClick={() => router.push("/register")}
          className="cursor-pointer transition-all hover:-translate-y-px"
          style={{
            padding: "16px 36px",
            borderRadius: 999,
            border: "none",
            background: "var(--epi-gold-500)",
            color: "var(--epi-navy-900)",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.06em",
            fontFamily: "var(--epi-font-body)",
            boxShadow: "0 12px 32px -10px rgba(217,174,59,0.65)",
          }}
        >
          {t("about.ctaButton")}
        </button>
      </section>
    </div>
  );
}
