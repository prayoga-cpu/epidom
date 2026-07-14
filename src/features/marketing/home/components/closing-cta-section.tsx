"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { trackConversion } from "@/lib/analytics";

export function ClosingCtaSection() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSent(true);
      trackConversion("email_capture", { event_label: "closing_cta" });
      router.push(`/register?email=${encodeURIComponent(email)}`);
    }
  };

  return (
    <section style={{ padding: "120px 0 80px" }}>
      <div className="epi-container">
        <div
          className="px-6 py-14 text-center sm:px-16 sm:py-20 lg:px-20 lg:py-24"
          style={{
            position: "relative",
            borderRadius: 32,
            background: "linear-gradient(160deg, #0E1F38 0%, #060F1B 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          {/* Glow */}
          <div
            style={{
              position: "absolute",
              width: 800,
              height: 800,
              borderRadius: "50%",
              top: "-50%",
              left: "50%",
              transform: "translateX(-50%)",
              background: "radial-gradient(circle, rgba(217,174,59,0.20), transparent 60%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative" }}>
            <div className="epi-eyebrow" style={{ marginBottom: 18 }}>
              {t("redesign.cta.eyebrow")}
            </div>
            <h2
              className="epi-display"
              style={{
                fontSize: "clamp(48px, 6vw, 96px)",
                margin: 0,
                lineHeight: 0.92,
                color: "var(--epi-cream-50)",
              }}
            >
              {t("redesign.cta.title1")}
              <br />
              {t("redesign.cta.title2")}{" "}
              <span style={{ color: "var(--epi-gold-400)" }}>{t("redesign.cta.titleAccent")}</span>
              {t("redesign.cta.title3")}
            </h2>
            <p
              className="epi-script"
              style={{
                fontSize: 26,
                color: "var(--epi-cream-100)",
                marginTop: 16,
                lineHeight: 1.3,
                display: "block",
              }}
            >
              {t("redesign.cta.script")}
            </p>

            {!sent ? (
              <form
                onSubmit={handleSubmit}
                style={{
                  marginTop: 40,
                  display: "flex",
                  gap: 10,
                  maxWidth: 520,
                  margin: "40px auto 0",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 999,
                  padding: 6,
                }}
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("redesign.cta.placeholder")}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--epi-cream-50)",
                    fontSize: 15,
                    padding: "0 22px",
                    fontFamily: "var(--epi-font-body)",
                    minWidth: 0,
                  }}
                />
                <button
                  type="submit"
                  className="cursor-pointer transition-all hover:-translate-y-px"
                  style={{
                    padding: "12px 24px",
                    borderRadius: 999,
                    background: "var(--epi-gold-500)",
                    color: "var(--epi-navy-900)",
                    fontSize: 14,
                    fontWeight: 500,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    border: "none",
                    fontFamily: "var(--epi-font-body)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t("redesign.cta.button")}
                </button>
              </form>
            ) : (
              <div style={{ marginTop: 40, color: "var(--epi-gold-300)", fontSize: 16 }}>
                {t("redesign.cta.sent").replace("{email}", email)}
              </div>
            )}

            <div
              style={{
                marginTop: 28,
                color: "var(--epi-cream-50)",
                opacity: 0.4,
                fontSize: 13,
                display: "flex",
                gap: 24,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <span>{t("redesign.cta.check1")}</span>
              <span>{t("redesign.cta.check2")}</span>
              <span>{t("redesign.cta.check3")}</span>
              <span>{t("redesign.cta.check4")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
