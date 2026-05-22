"use client";
import * as React from "react";
import { useI18n } from "./i18n-provider";

const OPTS = [
  { label: "English",   value: "en", short: "EN", flag: "🇺🇸" },
  { label: "Indonesia", value: "id", short: "ID", flag: "🇮🇩" },
  { label: "Français",  value: "fr", short: "FR", flag: "🇫🇷" },
] as const;

export default function LangSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { setMounted(true); }, []);

  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = OPTS.find((o) => o.value === locale) ?? OPTS[0];

  const triggerStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(251,249,228,0.65)",
    fontSize: 12,
    fontFamily: "var(--epi-font-body)",
    letterSpacing: "0.08em",
    fontWeight: 600,
    cursor: "pointer",
    userSelect: "none",
    outline: "none",
    transition: "all 0.15s ease",
  };

  if (!mounted) {
    return (
      <div className={className} style={triggerStyle}>
        <GlobeIcon />
        <span>{current.short}</span>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }} className={className}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          ...triggerStyle,
          border: `1px solid ${open ? "rgba(217,174,59,0.40)" : "rgba(255,255,255,0.12)"}`,
          background: open ? "rgba(217,174,59,0.08)" : "rgba(255,255,255,0.04)",
          color: open ? "var(--epi-gold-400)" : "rgba(251,249,228,0.65)",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <GlobeIcon />
        <span>{current.short}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: 160,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "color-mix(in srgb, var(--epi-navy-900) 96%, transparent)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 20px 48px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.06) inset",
            padding: "6px",
            zIndex: 200,
          }}
        >
          {OPTS.map((opt) => {
            const active = opt.value === locale;
            return (
              <button
                key={opt.value}
                role="option"
                aria-selected={active}
                onClick={() => { setLocale(opt.value); setOpen(false); }}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 11px",
                  borderRadius: 9,
                  border: "none",
                  background: active ? "rgba(217,174,59,0.10)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.12s",
                  outline: "none",
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = active ? "rgba(217,174,59,0.10)" : "transparent"; }}
              >
                <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{opt.flag}</span>
                <span style={{
                  fontSize: 11,
                  fontFamily: "var(--epi-font-body)",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: active ? "var(--epi-gold-400)" : "rgba(251,249,228,0.55)",
                  flexShrink: 0,
                }}>
                  {opt.short}
                </span>
                <span style={{
                  fontSize: 12,
                  fontFamily: "var(--epi-font-body)",
                  color: active ? "var(--epi-cream-100)" : "rgba(251,249,228,0.32)",
                  marginLeft: "auto",
                  whiteSpace: "nowrap",
                }}>
                  {opt.label}
                </span>
                {active && (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0, marginLeft: 2 }}>
                    <path d="M2 5.5l2.5 2.5 4.5-5" stroke="var(--epi-gold-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="5.7" stroke="currentColor" strokeWidth="1.1" />
      <ellipse cx="6.5" cy="6.5" rx="2.4" ry="5.7" stroke="currentColor" strokeWidth="1.1" />
      <path d="M0.8 6.5h11.4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M1.5 4h10M1.5 9h10" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true"
      style={{ transition: "transform 0.15s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
    >
      <path d="M1.5 3l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
