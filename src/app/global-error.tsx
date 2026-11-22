"use client";

import type { CSSProperties } from "react";

/**
 * Root (last-resort) error boundary.
 *
 * Next renders this only when the root layout itself failed, which means it
 * replaces the entire document — hence the hand-rolled <html>/<body>. Two
 * house rules are deliberately broken here, and only here:
 *
 * 1. Styling is inline rather than Tailwind. If the root layout threw, the
 *    reason may well be that globals.css or the font/provider tree never
 *    loaded — a Tailwind-classed fallback would then render as unstyled
 *    fragments, which looks more broken than the error it is reporting.
 *    Inline styles (plus one inline <style> for what an attribute cannot say:
 *    focus rings, the phone layout) need nothing but the HTML parser. The look
 *    is StatusScreen's "brand" tone (src/components/shared/status-screen.tsx),
 *    copied by hand: navy, cream, gold. Change them together.
 * 2. Copy is hardcoded in all four languages instead of going through
 *    useI18n(). I18nProvider lives inside the layouts this boundary is
 *    replacing, so calling useI18n() here would throw *inside the error
 *    handler* and hand the user a blank page. No hooks either: the language
 *    is read once at render (saved preference, then the browser's), shown
 *    large, and the other three stay printed underneath — so a wrong guess,
 *    or a server render that cannot know the language, still reads.
 */

type Lang = "fr" | "en" | "id" | "th";

const LANGS: readonly Lang[] = ["fr", "en", "id", "th"];

const COPY: Record<Lang, { title: string; body: string; reload: string; retry: string }> = {
  fr: {
    title: "Une erreur est survenue",
    body: "Rechargez la page pour continuer. Vos données sont intactes.",
    reload: "Recharger la page",
    retry: "Réessayer",
  },
  en: {
    title: "Something went wrong",
    body: "Reload the page to continue. Nothing you saved was lost.",
    reload: "Reload page",
    retry: "Try again",
  },
  id: {
    title: "Terjadi kesalahan",
    body: "Muat ulang halaman untuk melanjutkan. Data Anda tetap aman.",
    reload: "Muat ulang halaman",
    retry: "Coba lagi",
  },
  th: {
    title: "เกิดข้อผิดพลาด",
    body: "โหลดหน้านี้ใหม่เพื่อใช้งานต่อ ข้อมูลที่คุณบันทึกไว้ไม่สูญหาย",
    reload: "โหลดหน้าใหม่",
    retry: "ลองอีกครั้ง",
  },
};

function toLang(value: unknown): Lang | null {
  const code = String(value ?? "")
    .toLowerCase()
    .slice(0, 2);
  return (LANGS as readonly string[]).includes(code) ? (code as Lang) : null;
}

/**
 * The saved language (the same places src/lib/cookie-consent.ts reads), then
 * the browser's. French on the server, where neither exists: it is the site's
 * default locale. Every read is guarded — storage can throw in private mode.
 */
function pickLang(): Lang {
  if (typeof window === "undefined") return "fr";
  const candidates: unknown[] = [];
  try {
    const saved = JSON.parse(window.localStorage.getItem("cookie-consent-preferences") ?? "null");
    candidates.push(saved?.language);
  } catch {
    // No readable preference: fall through to the next source.
  }
  try {
    candidates.push(window.localStorage.getItem("locale"), window.localStorage.getItem("lang"));
  } catch {
    // Storage blocked: fall through to the browser language.
  }
  try {
    candidates.push(...(navigator.languages ?? []), navigator.language);
  } catch {
    // No navigator: the default below applies.
  }
  for (const candidate of candidates) {
    const lang = toLang(candidate);
    if (lang) return lang;
  }
  return "en";
}

const NAVY = "#060f1b";
const CREAM = "#fbf9e4";
const GOLD = "#d9ae3b";

const FONT_STACK =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans Thai', Thonburi, 'Leelawadee UI', Arial, sans-serif";

/** What a style attribute cannot express. Class names are local to this file. */
const CSS = `
*{box-sizing:border-box}
.ge-actions{display:flex;flex-direction:column;gap:12px;width:100%}
.ge-btn{transition:transform .15s,background-color .15s,border-color .15s}
.ge-btn:focus-visible{outline:2px solid #f4dc72;outline-offset:2px}
.ge-btn:active{transform:scale(.98)}
.ge-outline:hover{border-color:rgba(255,255,255,.4)!important;background-color:rgba(255,255,255,.04)!important}
@media (min-width:480px){.ge-actions{flex-direction:row;justify-content:center;width:auto}.ge-btn{width:auto!important;min-width:160px}}
@media (prefers-reduced-motion:reduce){.ge-btn{transition:none}.ge-btn:active{transform:none}}
`;

const BUTTON_BASE: CSSProperties = {
  minHeight: "48px",
  padding: "12px 24px",
  borderRadius: "9999px",
  fontFamily: "inherit",
  fontSize: "15px",
  lineHeight: 1.25,
  cursor: "pointer",
  width: "100%",
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const lang = pickLang();
  const copy = COPY[lang];
  const thai = lang === "th";

  return (
    // suppressHydrationWarning: when this was rendered on the server it is in
    // French; the browser may pick another language. Either text is correct.
    <html lang={lang} style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content={NAVY} />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding:
            "max(32px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(32px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left))",
          backgroundColor: NAVY,
          backgroundImage:
            "radial-gradient(1200px 600px at 80% -10%, rgba(91,136,178,0.18), transparent 60%), radial-gradient(900px 500px at 10% 110%, rgba(217,174,59,0.1), transparent 60%)",
          color: CREAM,
          fontFamily: FONT_STACK,
          lineHeight: 1.5,
          WebkitFontSmoothing: "antialiased",
          overflowX: "hidden",
        }}
      >
        <main
          role="alert"
          style={{
            width: "100%",
            maxWidth: "560px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
            textAlign: "center",
          }}
        >
          {/* Latin brand name: the only text here that may be letter-spaced. */}
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: GOLD,
            }}
          >
            Epidom
          </p>

          <div lang={lang} suppressHydrationWarning>
            <h1
              suppressHydrationWarning
              style={{
                margin: "0 0 12px",
                fontSize: "clamp(28px, 6.5vw, 44px)",
                fontWeight: 600,
                lineHeight: thai ? 1.35 : 1.12,
                letterSpacing: thai ? "normal" : "-0.025em",
                overflowWrap: "anywhere",
              }}
            >
              {copy.title}
            </h1>
            <p
              suppressHydrationWarning
              style={{
                margin: 0,
                fontSize: "clamp(15px, 2.8vw, 17px)",
                lineHeight: thai ? 1.75 : 1.6,
                color: "rgba(251, 249, 228, 0.75)",
              }}
            >
              {copy.body}
            </p>
          </div>

          <div className="ge-actions">
            <button
              type="button"
              className="ge-btn"
              suppressHydrationWarning
              onClick={() => window.location.reload()}
              style={{
                ...BUTTON_BASE,
                border: 0,
                background: "linear-gradient(180deg, #f4dc90, #d7b54b 55%, #a97c1c)",
                color: "#151004",
                fontWeight: 600,
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,.28) inset, 0 8px 28px rgba(217,174,59,.35), 0 3px 0 rgba(139,90,10,.85)",
              }}
            >
              {copy.reload}
            </button>
            <button
              type="button"
              className="ge-btn ge-outline"
              suppressHydrationWarning
              onClick={reset}
              style={{
                ...BUTTON_BASE,
                border: "1px solid rgba(255, 255, 255, 0.2)",
                backgroundColor: "transparent",
                color: CREAM,
                fontWeight: 500,
              }}
            >
              {copy.retry}
            </button>
          </div>

          {/* The other three languages stay on the page, compact: the guess
            above can be wrong (a shared till, a browser left in English). */}
          <div
            style={{
              width: "100%",
              paddingTop: "20px",
              borderTop: "1px solid rgba(217, 174, 59, 0.28)",
              display: "grid",
              gap: "6px",
            }}
          >
            {LANGS.map((other) => (
              <p
                key={other}
                lang={other}
                hidden={other === lang}
                suppressHydrationWarning
                style={{
                  margin: 0,
                  fontSize: "13px",
                  lineHeight: other === "th" ? 1.7 : 1.5,
                  color: "rgba(251, 249, 228, 0.6)",
                }}
              >
                <span style={{ color: "rgba(251, 249, 228, 0.85)", fontWeight: 600 }}>
                  {COPY[other].title}
                </span>
                {" · "}
                {COPY[other].body}
              </p>
            ))}
          </div>

          {/* The hashed digest is the only handle support has to correlate a
            merchant's report with the corresponding server log line. */}
          {error.digest ? (
            <p
              style={{
                margin: 0,
                fontSize: "11px",
                color: "rgba(251, 249, 228, 0.55)",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                wordBreak: "break-all",
              }}
            >
              {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
