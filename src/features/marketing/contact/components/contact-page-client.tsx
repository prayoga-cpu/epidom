"use client";

import { useState } from "react";
import { useI18n, type Locale } from "@/components/lang/i18n-provider";

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
  };

  const subjectOpts = SUBJECT_OPTS[locale] ?? SUBJECT_OPTS.en;

  return (
    <div style={{ fontFamily: "var(--epi-font-body)", position: "relative", overflow: "hidden" }}>

      {/* Hero */}
      <section style={{ paddingTop: 140, paddingBottom: 80, position: "relative", textAlign: "center" }}>
        <div style={{
          position: "absolute", top: -160, left: "50%", transform: "translateX(-50%)",
          width: 800, height: 600, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(217,174,59,0.18), transparent 60%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative", maxWidth: 1120, margin: "0 auto", padding: "0 24px" }}>
          <div className="epi-eyebrow" style={{ marginBottom: 16 }}>{t("contact.page.eyebrow")}</div>
          <h1
            className="epi-display"
            style={{ fontSize: "clamp(52px, 9vw, 120px)", lineHeight: 0.93, margin: 0, color: "var(--epi-cream-50)" }}
          >
            {t("contact.page.title1")}{" "}
            <span style={{ color: "var(--epi-gold-400)" }}>{t("contact.page.titleAccent")}</span>{" "}
            {t("contact.page.title2")}
          </h1>
          <p className="epi-script" style={{ fontSize: "clamp(17px, 2vw, 22px)", color: "var(--epi-cream-100)", marginTop: 20, opacity: 0.7 }}>
            {t("contact.page.script")}
          </p>
        </div>
      </section>

      {/* Main content: form + channels */}
      <section style={{ paddingBottom: 120 }}>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-12 items-start" style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px" }}>

          {/* Contact Form */}
          <div style={{
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(12px)",
            padding: "40px 36px",
          }}>
            {status === "sent" ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "rgba(217,174,59,0.14)", border: "1px solid rgba(217,174,59,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 24px",
                }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M4 11l5 5 9-9" stroke="var(--epi-gold-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p style={{ fontSize: 18, color: "var(--epi-cream-50)", fontWeight: 600, marginBottom: 8 }}>
                  {t("contact.page.formSuccess")}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
                    <option value="" disabled style={{ background: "var(--epi-navy-900)" }}>—</option>
                    {subjectOpts.map((o) => (
                      <option key={o} value={o} style={{ background: "var(--epi-navy-900)" }}>{o}</option>
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
                  <p style={{ fontSize: 13, color: "#f87171", margin: 0 }}>{t("contact.page.formError")}</p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  style={{
                    padding: "14px 28px",
                    borderRadius: 999,
                    border: "none",
                    background: status === "sending" ? "rgba(217,174,59,0.5)" : "var(--epi-gold-500)",
                    color: "var(--epi-navy-900)",
                    fontFamily: "var(--epi-font-body)",
                    fontSize: 14, fontWeight: 700, letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    cursor: status === "sending" ? "default" : "pointer",
                    boxShadow: status === "sending" ? "none" : "0 8px 24px -8px rgba(217,174,59,0.55)",
                    transition: "all 0.15s ease",
                    alignSelf: "flex-start",
                  }}
                >
                  {status === "sending" ? t("contact.page.formSending") : t("contact.page.formSend")}
                </button>
              </form>
            )}
          </div>

          {/* Right: channels */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Response badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10, alignSelf: "flex-start",
              padding: "8px 16px", borderRadius: 999,
              border: "1px solid rgba(217,174,59,0.2)", background: "rgba(217,174,59,0.06)",
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "rgba(251,249,228,0.7)", letterSpacing: "0.06em" }}>
                {t("contact.page.responseTime")} · <strong style={{ color: "var(--epi-cream-50)" }}>{t("contact.page.responseVal")}</strong>
              </span>
            </div>

            {/* Channel cards */}
            <ChannelCard
              icon={<MailIconLg />}
              title={t("contact.page.channel1title")}
              body={t("contact.page.channel1body")}
              cta="support@epidom.fr"
              href="mailto:support@epidom.fr"
            />
            <ChannelCard
              icon={<WaIconLg />}
              title={t("contact.page.channel2title")}
              body={t("contact.page.channel2body")}
              cta={t("contact.page.whatsappCta")}
              href="https://wa.me/6281234567890"
              external
              gold
            />
            <ChannelCard
              icon={<DocsIconLg />}
              title={t("contact.page.channel3title")}
              body={t("contact.page.channel3body")}
              cta={t("contact.page.channel3cta")}
              href="/docs"
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
      <label style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(251,249,228,0.4)", fontWeight: 600 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ChannelCard({
  icon, title, body, cta, href, external, gold,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  href: string;
  external?: boolean;
  gold?: boolean;
}) {
  return (
    <div style={{
      display: "flex", gap: 18, alignItems: "flex-start",
      padding: "22px 24px", borderRadius: 16,
      border: `1px solid ${gold ? "rgba(217,174,59,0.18)" : "rgba(255,255,255,0.07)"}`,
      background: gold ? "rgba(217,174,59,0.04)" : "rgba(255,255,255,0.02)",
      transition: "border-color 0.15s",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: gold ? "rgba(217,174,59,0.12)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${gold ? "rgba(217,174,59,0.2)" : "rgba(255,255,255,0.08)"}`,
        color: gold ? "var(--epi-gold-400)" : "rgba(251,249,228,0.5)",
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--epi-cream-50)", margin: "0 0 6px" }}>{title}</p>
        <p style={{ fontSize: 13, color: "rgba(251,249,228,0.5)", margin: "0 0 12px", lineHeight: 1.5 }}>{body}</p>
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          style={{
            fontSize: 13, fontWeight: 600,
            color: gold ? "var(--epi-gold-400)" : "rgba(251,249,228,0.6)",
            textDecoration: "none", letterSpacing: "0.04em",
            transition: "color 0.12s",
          }}
        >
          {cta}
        </a>
      </div>
    </div>
  );
}

function MailIconLg() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8l9 6 9-6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
  );
}

function WaIconLg() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.552 4.122 1.523 5.854L0 24l6.335-1.492A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.882 0-3.659-.5-5.2-1.378l-.372-.215-3.758.884.934-3.65-.236-.389A10 10 0 012 12c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10z" />
    </svg>
  );
}

function DocsIconLg() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}
