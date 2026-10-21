"use client";

import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";

export function NewsletterSignup() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus("sending");
    try {
      await fetch("/api/public/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "footer" }),
      });
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div
      style={{
        width: "100%",
        padding: "64px 0 56px",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
          textAlign: "center",
          padding: "0 16px",
        }}
      >
        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--epi-gold-400, #d9ae3b)",
            margin: "0 0 8px",
            letterSpacing: "-.01em",
          }}
        >
          {t("footer.newsletterHeading")}
        </h3>
        <p
          style={{
            fontSize: 14,
            color: "rgba(251,249,228,0.5)",
            margin: "0 0 20px",
            lineHeight: 1.5,
          }}
        >
          {t("footer.newsletterSubtitle")}
        </p>

        {status === "ok" ? (
          <p style={{ fontSize: 14, color: "#5bb37c", fontWeight: 600 }}>
            {t("footer.newsletterThanks")}
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              gap: 8,
              maxWidth: 420,
              margin: "0 auto",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("footer.newsletterPlaceholder")}
              disabled={status === "sending"}
              style={{
                flex: "1 1 200px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: "11px 16px",
                fontSize: 14,
                color: "rgba(251,249,228,0.9)",
                outline: "none",
                WebkitAppearance: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(217,174,59,0.5)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
              }}
            />
            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                padding: "11px 22px",
                background: "linear-gradient(180deg,#f4dc90,#d7b54b 55%,#a97c1c)",
                color: "#151004",
                fontWeight: 700,
                fontSize: 14,
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                whiteSpace: "nowrap",
                opacity: status === "sending" ? 0.7 : 1,
              }}
            >
              {status === "sending" ? "…" : t("footer.newsletterSubmit")}
            </button>
          </form>
        )}

        {status === "error" && (
          <p style={{ fontSize: 12, color: "#e57373", marginTop: 8 }}>
            {t("footer.newsletterError")}
          </p>
        )}
      </div>
    </div>
  );
}
