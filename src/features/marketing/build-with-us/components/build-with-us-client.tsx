"use client";

import { motion } from "motion/react";
import type { Locale } from "@/components/lang/i18n-provider";
import { PrionationLogoFull } from "@/features/marketing/shared/components/prionation-logo-full";
import { trackEvent } from "@/lib/analytics";

const PRIONATION_BOOKING_URL = "https://www.prionation.io/en#engage?tab=meet";

const COPY: Record<
  Locale,
  {
    eyebrow: string;
    title1: string;
    title2: string;
    subhead: string;
    tabLabel: string;
    cardTitle: string;
    cardBody: string;
    weekdays: string[];
    onlineLabel: string;
    location: string;
    ctaButton: string;
    ctaNote: string;
    statDurationLabel: string;
    statDurationVal: string;
    statResponseLabel: string;
    statResponseVal: string;
    statCommitmentLabel: string;
    statCommitmentVal: string;
    footerNote: string;
  }
> = {
  en: {
    eyebrow: "Work with us",
    title1: "Build your own",
    title2: "Epidom.",
    subhead:
      "Epidom is a Prionation build. If you're building a production SaaS — not a prototype — talk to the team that built this one.",
    tabLabel: "Meet Us",
    cardTitle: "Book a 30-minute conversation",
    cardBody:
      "No pitch. We'll hear what you're building and tell you honestly whether we're the right fit.",
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    onlineLabel: "Online",
    location: "Canggu, Bali, Indonesia",
    ctaButton: "Book a call on Prionation",
    ctaNote: "Opens prionation.io in a new tab",
    statDurationLabel: "Duration",
    statDurationVal: "30 min",
    statResponseLabel: "Response",
    statResponseVal: "Within 24h",
    statCommitmentLabel: "Commitment",
    statCommitmentVal: "None",
    footerNote: "A Prionation project",
  },
  id: {
    eyebrow: "Kerja sama",
    title1: "Bangun Epidom",
    title2: "versi kamu.",
    subhead:
      "Epidom dibangun oleh Prionation. Kalau kamu lagi bangun SaaS produksi — bukan prototipe — ngobrol sama tim yang bangun ini.",
    tabLabel: "Ngobrol Yuk",
    cardTitle: "Jadwalkan ngobrol 30 menit",
    cardBody:
      "Tanpa pitching. Kami dengerin apa yang lagi kamu bangun dan kasih tahu jujur apa kami cocok buat itu.",
    weekdays: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
    onlineLabel: "Online",
    location: "Canggu, Bali, Indonesia",
    ctaButton: "Jadwalkan di Prionation",
    ctaNote: "Buka prionation.io di tab baru",
    statDurationLabel: "Durasi",
    statDurationVal: "30 menit",
    statResponseLabel: "Respons",
    statResponseVal: "Dalam 24 jam",
    statCommitmentLabel: "Komitmen",
    statCommitmentVal: "Tidak ada",
    footerNote: "Sebuah proyek Prionation",
  },
  fr: {
    eyebrow: "Travailler avec nous",
    title1: "Construisez votre",
    title2: "propre Epidom.",
    subhead:
      "Epidom est un projet Prionation. Si vous construisez un vrai SaaS en production — pas un prototype — parlez à l'équipe qui a construit celui-ci.",
    tabLabel: "Nous rencontrer",
    cardTitle: "Réservez un échange de 30 minutes",
    cardBody:
      "Sans argumentaire commercial. On écoute ce que vous construisez et on vous dit honnêtement si on est les bons pour ça.",
    weekdays: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
    onlineLabel: "En ligne",
    location: "Canggu, Bali, Indonésie",
    ctaButton: "Réserver sur Prionation",
    ctaNote: "Ouvre prionation.io dans un nouvel onglet",
    statDurationLabel: "Durée",
    statDurationVal: "30 min",
    statResponseLabel: "Réponse",
    statResponseVal: "Sous 24h",
    statCommitmentLabel: "Engagement",
    statCommitmentVal: "Aucun",
    footerNote: "Un projet Prionation",
  },
};

function buildCalendarDays(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  // JS getDay(): 0=Sun..6=Sat — shift so Monday is column 0, matching the weekdays header.
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number; isWeekend: boolean } | null> = Array(leadingBlanks).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month, day).getDay();
    cells.push({ day, isWeekend: dow === 0 || dow === 6 });
  }
  return cells;
}

function openBooking() {
  trackEvent("cta_click", { event_category: "engagement", event_label: "build_with_us_book_call" });
  window.open(PRIONATION_BOOKING_URL, "_blank", "noopener,noreferrer");
}

export function BuildWithUsClient({ locale }: { locale: Locale }) {
  const copy = COPY[locale];
  const now = new Date();
  const monthLabel = now.toLocaleDateString(
    locale === "id" ? "id-ID" : locale === "fr" ? "fr-FR" : "en-US",
    { month: "long", year: "numeric" }
  );
  const cells = buildCalendarDays(now.getFullYear(), now.getMonth());

  return (
    <div style={{ fontFamily: "var(--epi-font-body)" }}>
      {/* Hero */}
      <section className="epi-section" style={{ paddingTop: 140, paddingBottom: 40 }}>
        <div className="epi-container" style={{ maxWidth: 820 }}>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
          >
            <div className="epi-eyebrow" style={{ marginBottom: 20 }}>
              {copy.eyebrow}
            </div>
            <h1
              className="epi-display"
              style={{
                fontSize: "clamp(40px, 6.5vw, 84px)",
                lineHeight: 0.98,
                margin: 0,
                color: "var(--epi-cream-50)",
              }}
            >
              {copy.title1}
              <br />
              <span style={{ color: "var(--epi-gold-400)" }}>{copy.title2}</span>
            </h1>
            <p
              style={{
                color: "rgba(251,249,228,0.65)",
                fontSize: 17,
                lineHeight: 1.7,
                maxWidth: 640,
                marginTop: 24,
              }}
            >
              {copy.subhead}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Booking card */}
      <section className="epi-section" style={{ paddingTop: 0 }}>
        <div className="epi-container" style={{ maxWidth: 820 }}>
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] as const }}
            style={{
              borderRadius: 28,
              border: "1px solid rgba(255,255,255,0.09)",
              background: "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))",
              padding: "36px 36px 28px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 16,
                marginBottom: 28,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "8px 18px",
                  borderRadius: 999,
                  background: "rgba(217,174,59,0.14)",
                  border: "1px solid rgba(217,174,59,0.3)",
                  color: "var(--epi-gold-300)",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                }}
              >
                {copy.tabLabel}
              </span>
              <PrionationLogoFull height={22} />
            </div>

            <h2
              className="epi-display"
              style={{
                fontSize: "clamp(22px, 3vw, 32px)",
                margin: 0,
                color: "var(--epi-cream-50)",
                lineHeight: 1.1,
              }}
            >
              {copy.cardTitle}
            </h2>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: "rgba(251,249,228,0.55)",
                maxWidth: 560,
                marginTop: 12,
              }}
            >
              {copy.cardBody}
            </p>

            <div
              className="grid grid-cols-1 lg:grid-cols-[1fr_auto]"
              style={{ gap: 32, marginTop: 32, alignItems: "start" }}
            >
              {/* Decorative calendar — visual only. The real, bookable calendar
                  lives on prionation.io; this never claims to book anything
                  itself, it's here purely so the page matches Prionation's
                  own booking-page look. */}
              <div aria-hidden="true">
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "rgba(251,249,228,0.4)",
                    marginBottom: 14,
                  }}
                >
                  {monthLabel}
                </div>
                <div
                  className="grid grid-cols-7"
                  style={{ gap: 6, fontSize: 12, color: "rgba(251,249,228,0.35)" }}
                >
                  {copy.weekdays.map((d) => (
                    <div key={d} style={{ textAlign: "center", padding: "4px 0" }}>
                      {d}
                    </div>
                  ))}
                  {cells.map((cell, i) =>
                    cell === null ? (
                      <div key={i} />
                    ) : (
                      <div
                        key={i}
                        style={{
                          textAlign: "center",
                          padding: "8px 0",
                          borderRadius: 8,
                          fontSize: 13,
                          color: cell.isWeekend ? "rgba(251,249,228,0.22)" : "var(--epi-cream-50)",
                          background: cell.isWeekend ? "transparent" : "rgba(255,255,255,0.04)",
                        }}
                      >
                        {cell.day}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Status + CTA */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 220 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#22c55e",
                      boxShadow: "0 0 6px rgba(34,197,94,0.7)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 13, color: "var(--epi-cream-50)", opacity: 0.75 }}>
                    {copy.onlineLabel}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "rgba(251,249,228,0.55)", lineHeight: 1.5 }}>
                  {copy.location}
                </div>
                <button
                  onClick={openBooking}
                  className="cursor-pointer transition-all hover:-translate-y-px"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    height: 52,
                    padding: "0 24px",
                    borderRadius: 999,
                    background: "var(--epi-gold-500)",
                    color: "var(--epi-navy-900)",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: "0.01em",
                    border: "none",
                    boxShadow: "0 8px 24px -10px rgba(217,174,59,0.6)",
                    fontFamily: "var(--epi-font-body)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {copy.ctaButton} →
                </button>
                <span style={{ fontSize: 11, color: "rgba(251,249,228,0.35)" }}>{copy.ctaNote}</span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 24,
                flexWrap: "wrap",
                marginTop: 32,
                paddingTop: 22,
                borderTop: "1px solid rgba(255,255,255,0.07)",
                fontSize: 12,
                color: "rgba(251,249,228,0.4)",
              }}
            >
              <span>
                <span style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {copy.statDurationLabel}
                </span>{" "}
                · <strong style={{ color: "rgba(251,249,228,0.7)" }}>{copy.statDurationVal}</strong>
              </span>
              <span>
                <span style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {copy.statResponseLabel}
                </span>{" "}
                · <strong style={{ color: "rgba(251,249,228,0.7)" }}>{copy.statResponseVal}</strong>
              </span>
              <span>
                <span style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {copy.statCommitmentLabel}
                </span>{" "}
                · <strong style={{ color: "rgba(251,249,228,0.7)" }}>{copy.statCommitmentVal}</strong>
              </span>
            </div>
          </motion.div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginTop: 28,
            }}
          >
            <a
              href="https://www.prionation.io"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                textDecoration: "none",
                opacity: 0.7,
              }}
              className="transition-opacity hover:opacity-100"
            >
              <PrionationLogoFull height={18} />
              <span style={{ fontSize: 12, color: "rgba(251,249,228,0.5)" }}>{copy.footerNote}</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
