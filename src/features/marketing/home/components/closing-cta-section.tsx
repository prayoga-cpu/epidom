"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { trackConversion } from "@/lib/analytics";
import { stashPrefillEmail } from "@/features/auth/register/lib/prefill-handoff";

export function ClosingCtaSection() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  // True from the submit until /register has loaded. Nothing is emailed here: the
  // visitor is only being sent to the sign-up page, and the message must say so.
  const [redirecting, setRedirecting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setRedirecting(true);
      trackConversion("email_capture", { event_label: "closing_cta" });
      // The address goes to the sign-up form through sessionStorage, NOT the URL:
      // GA4 and the Meta Pixel receive the full page URL (for visitors who
      // consented), and it would also sit in browser history and server logs.
      stashPrefillEmail(email);
      router.push("/register");
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

            {!redirecting ? (
              // Stacked (input above a full-width button, both 48px tall) below sm, the
              // pill (input and button side by side inside one rounded shell) from sm up.
              // A side-by-side row is what squeezed the field to ~44px at 375px in French,
              // where the nowrap button label alone is ~195px wide. Layout is classes on
              // purpose: an inline `display` or `padding` would beat the sm: overrides.
              <form
                onSubmit={handleSubmit}
                className="sm:focus-within:border-epi-gold-500 mx-auto mt-10 flex max-w-[520px] flex-col gap-3 sm:flex-row sm:gap-2.5 sm:rounded-full sm:border sm:border-white/[0.14] sm:bg-white/[0.04] sm:p-1.5"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("redesign.cta.placeholder")}
                  className="text-epi-cream-50 focus-visible:border-epi-gold-500 h-12 w-full min-w-0 rounded-full border border-white/[0.14] bg-white/[0.04] px-5 [font-family:var(--epi-font-body)] text-base outline-none sm:h-auto sm:flex-1 sm:border-0 sm:bg-transparent sm:px-[22px] sm:text-[15px]"
                />
                <button
                  type="submit"
                  className="bg-epi-gold-500 text-epi-navy-900 h-12 w-full cursor-pointer rounded-full px-4 [font-family:var(--epi-font-body)] text-sm font-medium tracking-[0.06em] whitespace-nowrap uppercase transition-all hover:-translate-y-px sm:h-auto sm:w-auto sm:px-6 sm:py-3"
                >
                  {t("redesign.cta.button")}
                </button>
              </form>
            ) : (
              <div role="status" className="text-epi-gold-300 mt-10 text-base">
                {t("redesign.cta.sent")}
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
