"use client";

import { X } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";

/** One shining gold surface for the frame and the bar, so the shine runs across both as a single piece. */
const GOLD_CSS = `
@keyframes epi-demo-shine { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
.epi-demo-gold {
  background: linear-gradient(110deg, #b8902a 0%, #f4dc90 18%, #d7b54b 36%, #fbf3cf 50%, #d7b54b 64%, #f4dc90 82%, #b8902a 100%);
  background-size: 200% 100%;
  animation: epi-demo-shine 5s linear infinite;
}
@media (prefers-reduced-motion: reduce) { .epi-demo-gold { animation: none; } }
`;

/**
 * The public demo's window (src/app/demo/view/[target]/page.tsx): a shining
 * gold frame filling the screen, a slim bar on top ("Live demo · sample data,
 * read-only · Start free · close") and, under it, the real app running in an
 * iframe with rounded corners. The iframe is its own viewport, so the app gets
 * exactly the space it is drawn for: nothing is scaled, cropped or covered, in
 * any browser. "Start free" and close both go through /demo/exit, which ends
 * the demo session and returns to the website.
 */
export function DemoWindow({ src, title }: { src: string; title: string }) {
  const { t } = useI18n();
  return (
    <div
      className="epi-demo-gold"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        padding: "0 12px 12px",
      }}
    >
      <style>{GOLD_CSS}</style>
      <div
        role="region"
        aria-label={t("redesign.landing.demoBar.label")}
        style={{
          flex: "0 0 auto",
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          color: "#151004",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <span className="min-w-0 truncate">{t("redesign.landing.demoBar.label")}</span>
        <a
          href="/demo/exit?to=register"
          className="shrink-0 cursor-pointer rounded-full bg-[#151004] px-3.5 py-1.5 text-xs font-semibold text-[#f4dc90] hover:bg-[#2a2208]"
        >
          {t("redesign.landing.demoBar.cta")}
        </a>
        <a
          href="/demo/exit"
          onClick={(e) => {
            // The demo opened in its own tab: end the session, close the tab and
            // leave the original tab on the website. If the browser refuses to
            // close it, fall back to the exit redirect (a plain link).
            e.preventDefault();
            fetch("/demo/exit", { redirect: "manual", cache: "no-store" })
              .catch(() => undefined)
              .finally(() => {
                window.close();
                window.setTimeout(() => window.location.replace("/"), 150);
              });
          }}
          aria-label={t("redesign.landing.demoBar.close")}
          title={t("redesign.landing.demoBar.close")}
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-black/10"
        >
          <X aria-hidden="true" className="size-4" />
        </a>
      </div>
      <iframe
        src={src}
        title={title}
        allow="fullscreen; clipboard-write"
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          width: "100%",
          border: 0,
          borderRadius: 16,
          background: "#0a1020",
        }}
      />
    </div>
  );
}
