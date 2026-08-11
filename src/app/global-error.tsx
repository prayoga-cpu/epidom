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
 *    Inline styles need nothing but the HTML parser.
 * 2. Copy is hardcoded in all three languages instead of going through
 *    useI18n(). I18nProvider lives inside the layouts this boundary is
 *    replacing, so calling useI18n() here would throw *inside the error
 *    handler* and hand the user a blank page. Showing fr / en / id together
 *    is the honest trade: short enough to stack, and it can't guess wrong.
 */

const BUTTON_BASE: CSSProperties = {
  minHeight: "44px",
  padding: "12px 20px",
  borderRadius: "8px",
  fontSize: "15px",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid transparent",
  width: "100%",
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr" style={{ colorScheme: "light" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          backgroundColor: "#fafafa",
          color: "#0a0a0a",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          lineHeight: 1.5,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: "420px",
            backgroundColor: "#ffffff",
            border: "1px solid #e5e5e5",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              margin: "0 auto 16px",
              width: "48px",
              height: "48px",
              borderRadius: "9999px",
              backgroundColor: "#fee2e2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              lineHeight: 1,
            }}
            aria-hidden="true"
          >
            {"⚠"}
          </div>

          <h1 style={{ margin: "0 0 4px", fontSize: "19px", fontWeight: 600 }}>
            Une erreur est survenue
          </h1>
          <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#525252" }}>
            Something went wrong · Terjadi kesalahan
          </p>

          <p style={{ margin: "0 0 6px", fontSize: "14px", color: "#404040" }}>
            Rechargez la page pour continuer. Vos données sont intactes.
          </p>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#737373" }}>
            Reload the page to continue — nothing you saved was lost.
            <br />
            Muat ulang halaman untuk melanjutkan — data Anda tetap aman.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                ...BUTTON_BASE,
                backgroundColor: "#0a0a0a",
                color: "#ffffff",
              }}
            >
              Recharger · Reload · Muat ulang
            </button>
            <button
              type="button"
              onClick={reset}
              style={{
                ...BUTTON_BASE,
                backgroundColor: "#ffffff",
                color: "#0a0a0a",
                borderColor: "#e5e5e5",
              }}
            >
              Réessayer · Try again · Coba lagi
            </button>
          </div>

          {/* The hashed digest is the only handle support has to correlate a
            merchant's report with the corresponding server log line. */}
          {error.digest ? (
            <p
              style={{
                margin: "16px 0 0",
                fontSize: "11px",
                color: "#a3a3a3",
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
