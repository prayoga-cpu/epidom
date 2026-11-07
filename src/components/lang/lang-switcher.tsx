"use client";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "./i18n-provider";
import { stripLocalePrefix, getLocalizedPath } from "@/lib/i18n-routing";
import { LANGUAGE_OPTIONS, rememberLocaleChoice } from "./language-options";

/** Re-exported so other language pickers (POS Mode's More menu) offer the same set, in the same order. */
export { LANGUAGE_OPTIONS };

export default function LangSwitcher({
  className = "",
  dropUp = false,
  /**
   * True on the marketing site, where language is URL-driven (/, /id/*,
   * /en/*) — selecting a language navigates instead of just flipping
   * client state, so it survives the next server render. Leave false (the
   * dashboard/topbar/sidebar usage) where locale is purely a client
   * preference and there's no per-locale URL to go to.
   */
  urlDriven = false,
  tone = "dark",
}: {
  className?: string;
  dropUp?: boolean;
  urlDriven?: boolean;
  /**
   * "dark" (default) is the cream-on-navy look for the dark marketing/app
   * topbars. "surface" follows the page theme (light or dark) through the
   * design tokens, for pages that sit on the normal background such as the
   * setup wizard.
   */
  tone?: "dark" | "surface";
}) {
  const c =
    tone === "surface"
      ? {
          border: "var(--border)",
          bg: "var(--card)",
          text: "var(--muted-foreground)",
          openBorder: "color-mix(in srgb, var(--epi-gold-500) 55%, transparent)",
          openBg: "color-mix(in srgb, var(--epi-gold-500) 14%, var(--card))",
          openText: "var(--foreground)",
          menuBg: "var(--popover)",
          menuBorder: "var(--border)",
          menuShadow: "0 12px 32px rgba(10,24,46,0.18)",
          activeBg: "color-mix(in srgb, var(--epi-gold-500) 16%, transparent)",
          hoverBg: "var(--accent)",
          short: "var(--muted-foreground)",
          shortActive: "var(--foreground)",
          label: "var(--muted-foreground)",
          labelActive: "var(--foreground)",
          check: "var(--epi-gold-600)",
        }
      : {
          border: "rgba(255,255,255,0.12)",
          bg: "rgba(255,255,255,0.04)",
          text: "rgba(251,249,228,0.65)",
          openBorder: "rgba(217,174,59,0.40)",
          openBg: "rgba(217,174,59,0.08)",
          openText: "var(--epi-gold-400)",
          menuBg: "color-mix(in srgb, var(--epi-navy-900) 96%, transparent)",
          menuBorder: "rgba(255,255,255,0.10)",
          menuShadow: "0 20px 48px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.06) inset",
          activeBg: "rgba(217,174,59,0.10)",
          hoverBg: "rgba(255,255,255,0.05)",
          short: "rgba(251,249,228,0.55)",
          shortActive: "var(--epi-gold-400)",
          label: "rgba(251,249,228,0.32)",
          labelActive: "var(--epi-cream-100)",
          check: "var(--epi-gold-400)",
        };
  const { locale, setLocale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = LANGUAGE_OPTIONS.find((o) => o.value === locale) ?? LANGUAGE_OPTIONS[0];

  const triggerStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    minHeight: tone === "surface" ? 40 : undefined,
    borderRadius: 999,
    border: `1px solid ${c.border}`,
    background: c.bg,
    color: c.text,
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
          border: `1px solid ${open ? c.openBorder : c.border}`,
          background: open ? c.openBg : c.bg,
          color: open ? c.openText : c.text,
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
            ...(dropUp ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" }),
            right: 0,
            minWidth: 160,
            borderRadius: 14,
            border: `1px solid ${c.menuBorder}`,
            background: c.menuBg,
            backdropFilter: "blur(24px)",
            boxShadow: c.menuShadow,
            padding: "6px",
            zIndex: 200,
          }}
        >
          {LANGUAGE_OPTIONS.map((opt) => {
            const active = opt.value === locale;
            return (
              <button
                key={opt.value}
                role="option"
                aria-selected={active}
                onClick={() => {
                  setLocale(opt.value);
                  setOpen(false);
                  if (urlDriven) {
                    rememberLocaleChoice(opt.value);
                    if (pathname) {
                      const { basePath } = stripLocalePrefix(pathname);
                      router.push(getLocalizedPath(basePath, opt.value));
                    }
                  }
                }}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 11px",
                  borderRadius: 9,
                  border: "none",
                  background: active ? c.activeBg : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.12s",
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = c.hoverBg;
                }}
                onMouseLeave={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLButtonElement).style.background = active
                      ? c.activeBg
                      : "transparent";
                }}
              >
                <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{opt.flag}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--epi-font-body)",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: active ? c.shortActive : c.short,
                    flexShrink: 0,
                  }}
                >
                  {opt.short}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "var(--epi-font-body)",
                    color: active ? c.labelActive : c.label,
                    marginLeft: "auto",
                    whiteSpace: "nowrap",
                  }}
                >
                  {opt.label}
                </span>
                {active && (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 11 11"
                    fill="none"
                    style={{ flexShrink: 0, marginLeft: 2 }}
                  >
                    <path
                      d="M2 5.5l2.5 2.5 4.5-5"
                      stroke={c.check}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
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
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
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
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      aria-hidden="true"
      style={{
        transition: "transform 0.15s ease",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        flexShrink: 0,
      }}
    >
      <path
        d="M1.5 3l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
