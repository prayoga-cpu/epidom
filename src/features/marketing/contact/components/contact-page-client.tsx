"use client";

import { useState } from "react";
import { useI18n, type Locale } from "@/components/lang/i18n-provider";
import { trackEvent } from "@/lib/analytics";
import { getWhatsAppOptions, whatsappHref } from "@/lib/constants/contact";
import { getLocalizedPath } from "@/lib/i18n-routing";

const SUBJECT_OPTS: Record<Locale, string[]> = {
  en: ["Getting started", "Pricing question", "Technical support", "Partnership", "Press", "Other"],
  id: ["Mulai menggunakan", "Pertanyaan harga", "Dukungan teknis", "Kemitraan", "Pers", "Lainnya"],
  fr: ["Démarrer", "Question tarifaire", "Support technique", "Partenariat", "Presse", "Autre"],
};

export function ContactPageClient() {
  const { t, locale } = useI18n();

  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    await new Promise((r) => setTimeout(r, 1200));
    setStatus("sent");
    trackEvent("contact_form_submitted", {
      event_category: "engagement",
      event_label: form.subject || "unspecified",
    });
  };

  const subjectOpts = SUBJECT_OPTS[locale] ?? SUBJECT_OPTS.en;

  return (
    <div style={{ fontFamily: "var(--epi-font-body)", position: "relative", overflow: "hidden" }}>
      {/* Hero */}
      <section
        style={{ paddingTop: 140, paddingBottom: 80, position: "relative", textAlign: "center" }}
      >
        <div
          style={{
            position: "absolute",
            top: -160,
            left: "50%",
            transform: "translateX(-50%)",
            width: 800,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(217,174,59,0.18), transparent 60%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: 1120, margin: "0 auto", padding: "0 24px" }}>
          <div className="epi-eyebrow" style={{ marginBottom: 16 }}>
            {t("contact.page.eyebrow")}
          </div>
          <h1
            className="epi-display"
            style={{
              fontSize: "clamp(52px, 9vw, 120px)",
              lineHeight: 0.93,
              margin: 0,
              color: "var(--epi-cream-50)",
            }}
          >
            {t("contact.page.title1")}{" "}
            <span style={{ color: "var(--epi-gold-400)" }}>{t("contact.page.titleAccent")}</span>{" "}
            {t("contact.page.title2")}
          </h1>
          <p
            className="epi-script"
            style={{
              fontSize: "clamp(17px, 2vw, 22px)",
              color: "var(--epi-cream-100)",
              marginTop: 20,
              opacity: 0.7,
            }}
          >
            {t("contact.page.script")}
          </p>
        </div>
      </section>

      {/* Main content: form + channels */}
      <section style={{ paddingBottom: 120 }}>
        <div
          className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-12"
          style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px" }}
        >
          {/* Contact Form */}
          <div
            style={{
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(12px)",
              padding: "40px 36px",
            }}
          >
            {status === "sent" ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "rgba(217,174,59,0.14)",
                    border: "1px solid rgba(217,174,59,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 24px",
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path
                      d="M4 11l5 5 9-9"
                      stroke="var(--epi-gold-400)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p
                  style={{
                    fontSize: 18,
                    color: "var(--epi-cream-50)",
                    fontWeight: 600,
                    marginBottom: 8,
                  }}
                >
                  {t("contact.page.formSuccess")}
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                style={{ display: "flex", flexDirection: "column", gap: 20 }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Field label={t("contact.page.formName")}>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder={t("contact.page.formNamePlaceholder")}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label={t("contact.page.formEmail")}>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder={t("contact.page.formEmailPlaceholder")}
                      style={inputStyle}
                    />
                  </Field>
                </div>

                <Field label={t("contact.page.formSubject")}>
                  <select
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    style={{ ...inputStyle, cursor: "pointer" }}
                  >
                    <option value="" disabled style={{ background: "var(--epi-navy-900)" }}>
                      —
                    </option>
                    {subjectOpts.map((o) => (
                      <option key={o} value={o} style={{ background: "var(--epi-navy-900)" }}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={t("contact.page.formMessage")}>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    placeholder={t("contact.page.formMessagePlaceholder")}
                    style={{ ...inputStyle, resize: "vertical", minHeight: 120 }}
                  />
                </Field>

                {status === "error" && (
                  <p style={{ fontSize: 13, color: "#f87171", margin: 0 }}>
                    {t("contact.page.formError")}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  style={{
                    padding: "14px 28px",
                    borderRadius: 999,
                    border: "none",
                    background:
                      status === "sending" ? "rgba(217,174,59,0.5)" : "var(--epi-gold-500)",
                    color: "var(--epi-navy-900)",
                    fontFamily: "var(--epi-font-body)",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    cursor: status === "sending" ? "default" : "pointer",
                    boxShadow:
                      status === "sending" ? "none" : "0 8px 24px -8px rgba(217,174,59,0.55)",
                    transition: "all 0.15s ease",
                    alignSelf: "flex-start",
                  }}
                >
                  {status === "sending"
                    ? t("contact.page.formSending")
                    : t("contact.page.formSend")}
                </button>
              </form>
            )}
          </div>

          {/* Right: channels */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Response badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                alignSelf: "flex-start",
                padding: "8px 16px",
                borderRadius: 999,
                border: "1px solid rgba(217,174,59,0.2)",
                background: "rgba(217,174,59,0.06)",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#4ade80",
                  boxShadow: "0 0 6px #4ade80",
                  flexShrink: 0,
                }}
              />
              <span
                style={{ fontSize: 12, color: "rgba(251,249,228,0.7)", letterSpacing: "0.06em" }}
              >
                {t("contact.page.responseTime")} ·{" "}
                <strong style={{ color: "var(--epi-cream-50)" }}>
                  {t("contact.page.responseVal")}
                </strong>
              </span>
            </div>

            {/* Channel cards */}
            <ChannelCard
              index="01"
              title={t("contact.page.channel1title")}
              body={t("contact.page.channel1body")}
              cta="cro@prionation.io, ceo@prionation.io, consult@prionation.io"
              href="mailto:cro@prionation.io,ceo@prionation.io,consult@prionation.io"
            />
            {getWhatsAppOptions(locale).map((opt, i, arr) => (
              <ChannelCard
                key={opt.number}
                index={String(i + 2).padStart(2, "0")}
                title={arr.length > 1 ? `${t("contact.page.channel2title")} (${opt.label})` : t("contact.page.channel2title")}
                body={t("contact.page.channel2body")}
                cta={t("contact.page.whatsappCta")}
                href={whatsappHref(opt.number)}
                external
                gold={i === 0}
              />
            ))}
            <ChannelCard
              index={String(2 + getWhatsAppOptions(locale).length).padStart(2, "0")}
              title={t("contact.page.channel3title")}
              body={t("contact.page.channel3body")}
              cta={t("contact.page.channel3cta")}
              href={getLocalizedPath("/docs", locale)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "var(--epi-cream-50)",
  fontFamily: "var(--epi-font-body)",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.12s",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(251,249,228,0.4)",
          fontWeight: 600,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function ChannelCard({
  index,
  title,
  body,
  cta,
  href,
  external,
  gold,
}: {
  index: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  external?: boolean;
  gold?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 18,
        alignItems: "flex-start",
        padding: "22px 24px",
        borderRadius: 16,
        border: `1px solid ${gold ? "rgba(217,174,59,0.18)" : "rgba(255,255,255,0.07)"}`,
        background: gold ? "rgba(217,174,59,0.04)" : "rgba(255,255,255,0.02)",
        transition: "border-color 0.15s",
      }}
    >
      <div
        className="epi-script"
        aria-hidden="true"
        style={{
          fontSize: 28,
          lineHeight: 1,
          flexShrink: 0,
          width: 40,
          color: gold ? "var(--epi-gold-400)" : "rgba(251,249,228,0.4)",
          opacity: 0.85,
        }}
      >
        {index}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{ fontSize: 15, fontWeight: 700, color: "var(--epi-cream-50)", margin: "0 0 6px" }}
        >
          {title}
        </p>
        <p
          style={{
            fontSize: 13,
            color: "rgba(251,249,228,0.5)",
            margin: "0 0 12px",
            lineHeight: 1.5,
          }}
        >
          {body}
        </p>
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: gold ? "var(--epi-gold-400)" : "rgba(251,249,228,0.6)",
            textDecoration: "none",
            letterSpacing: "0.04em",
            transition: "color 0.12s",
          }}
        >
          {cta}
        </a>
      </div>
    </div>
  );
}

