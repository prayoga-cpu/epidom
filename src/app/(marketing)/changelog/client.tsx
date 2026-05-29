"use client";

import { useI18n } from "@/components/lang/i18n-provider";

interface Release {
  version: string;
  date: string;
  tag: "feat" | "fix" | "infra" | "ux";
  items: string[];
}

const TAG_STYLES: Record<Release["tag"], { bg: string; text: string; label: string }> = {
  feat: { bg: "rgba(217,174,59,0.15)", text: "var(--epi-gold-400)", label: "Feature" },
  fix:  { bg: "rgba(239,68,68,0.12)",  text: "#f87171",             label: "Fix"     },
  infra:{ bg: "rgba(99,102,241,0.12)", text: "#a5b4fc",             label: "Infra"   },
  ux:   { bg: "rgba(52,211,153,0.12)", text: "#6ee7b7",             label: "UX"      },
};

const RELEASES: Release[] = [
  {
    version: "2.6 — 2026-05-29",
    date: "May 29, 2026",
    tag: "ux",
    items: [
      "Storefront logo & cover image are now photo-upload fields — drag-and-drop with preview, auto-compression, and resolution guide (logo 400×400 · cover 1920×1080).",
      "Data / Products — 'Add to POS menu' button now shows 'In Menu' badge instantly (optimistic update) instead of waiting for a page reload.",
      "Sync-to-menu prompt: editing a product's price or name now offers a one-click action to update the linked POS menu item.",
      "Recipe cards show a '47× last 30d' demand badge — pulls 30-day POS order counts so you know which recipes are driven by real sales.",
      "Tracking page gains a 'Recent Movements' tab showing all stock changes with source context (POS order # / Batch # / Manual).",
      "Dashboard now includes a 'Recent Stock Movements' card as a live activity feed.",
      "Subscription pricing on profile page updates instantly when you change your currency (IDR / USD / EUR) — no reload needed.",
      "Pricing labels corrected: POS = Rp 99.000/bln, OPERATIONS = Rp 249.000/bln.",
      "PWA install button in the topbar — disappears automatically when the app is already installed.",
      "Removed orphaned placeholder component (data-manage.tsx).",
    ],
  },
  {
    version: "2.5 — 2026-05-28",
    date: "May 28, 2026",
    tag: "infra",
    items: [
      "Prisma 6 → 7 — migrated to pg driver adapter (@prisma/adapter-pg); removed url/directUrl from schema.prisma; added prisma.config.ts for CLI.",
      "Added DIRECT_URL support (Neon non-pooled endpoint) so prisma migrate deploy runs over a direct connection and never hits pgBouncer prepared-statement limits.",
      "build script: prisma migrate deploy now runs before next build — missing columns (isAdmin, hasOnboarded) are created automatically on every Vercel deploy.",
      "Service worker fix: response.clone() was called inside an async .then(), causing 'body already used' errors that blocked login. Fixed to clone synchronously.",
      "OAuth errors now redirect to /login?error=<code> with a human-readable toast instead of Better Auth's raw HTML error page.",
    ],
  },
  {
    version: "2.4 — 2026-05-28",
    date: "May 28, 2026",
    tag: "feat",
    items: [
      "Guided onboarding (5 steps: business → logo → menu → theme → publish) with server-side redirect guard after completion (hasOnboarded flag).",
      "POST /api/onboarding/complete — marks onboarding done permanently; subsequent visits to /onboarding redirect to /stores instantly.",
      "Fixed onboarding menu-item save bug: createCategory() was returning the inner payload directly but code was reading .data?.id — items silently skipped. Fixed.",
      "Staff email invitation flow — PIN delivered via Resend after invite.",
      "Table reservations — per-table toggle, public booking form, dashboard management panel.",
      "Notification bell with badge count for unread alerts.",
    ],
  },
  {
    version: "2.3 — 2026-05-24",
    date: "May 24, 2026",
    tag: "ux",
    items: [
      "Full i18n sweep — 100+ new translation keys across POS, KDS, Tables, Storefront editor, Finance pages.",
      "epi-navy dark / epi-cream light design tokens fully bridged into shadcn CSS variables.",
      "Dark/light mode toggle in topbar; default dark.",
      "Currency provider — formatPrice() auto-converts from stored value to user's selected currency (IDR / USD / EUR).",
      "Shift management — currency-aware formatting, sortable columns.",
      "Account Settings — data usage stats, linked accounts, change password, delete account.",
    ],
  },
  {
    version: "2.2 — 2026-05-23",
    date: "May 23, 2026",
    tag: "feat",
    items: [
      "Finance reports — daily/weekly/monthly P&L: revenue, COGS, gross margin. Per-channel breakdown (DIRECT / GoFood / GrabFood / ShopeeFood / Tokopedia).",
      "Multi-outlet owner dashboard (ENTERPRISE) — rolls up all stores with drill-down.",
      "Aggregator email ingestion — GoFood/GrabFood order emails → Order records via Inngest + OpenAI.",
      "Automatic stock deduction on order → DELIVERED (serializable transaction through Recipe → Material chain).",
      "LOW_STOCK and CRITICAL_STOCK alerts with notification bell badge.",
      "Staff PIN login — clock-in with PIN, shift open/close.",
    ],
  },
  {
    version: "2.1 — 2026-05-22",
    date: "May 22, 2026",
    tag: "feat",
    items: [
      "POS cashier — menu grid, cart, checkout dialog (CASH / CARD / TRANSFER / QRIS).",
      "Kitchen Display System (KDS) — real-time order columns by status.",
      "Order queue with SSE real-time updates.",
      "Table management — seat assignment, status tracking (FREE / OCCUPIED / RESERVED).",
      "Production batch management — schedule batches from recipes, track status, view history.",
      "CSV Smart Import (AI-powered) for Products, Materials, Recipes, Suppliers.",
    ],
  },
  {
    version: "2.0 — 2026-05-21",
    date: "May 21, 2026",
    tag: "feat",
    items: [
      "Public storefront at /@slug — customizable menu page, theme color, tagline, social links.",
      "Online ordering — customer checkout form, QRIS/cash payment, order tracking page.",
      "Storefront editor — WYSIWYG menu builder with drag-and-drop category reordering.",
      "GoFood / GrabFood / ShopeeFood / Tokopedia aggregator link fields.",
      "Storefront analytics — view counts.",
      "Inventory management — Products, Materials, Recipes (with cost-per-batch), Suppliers.",
    ],
  },
  {
    version: "1.0 — 2026-05-01",
    date: "May 1, 2026",
    tag: "feat",
    items: [
      "Public launch — auth (email/password + Google OAuth), store creation, billing (FREE / POS / OPERATIONS / ENTERPRISE via Stripe).",
      "Dashboard with stock overview, production chart, alerts card, supplier card.",
      "Better Auth integration — HMAC-signed cookies, email verification, password reset.",
      "Multi-store support (Business → Stores hierarchy).",
      "Indonesian (id) primary language, English (en) secondary.",
    ],
  },
];

export function ChangelogClient() {
  return (
    <div style={{ fontFamily: "var(--epi-font-body)", minHeight: "80vh", display: "flex", flexDirection: "column" }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", top: 0, right: 0, width: 500, height: 400, background: "radial-gradient(ellipse at top right, rgba(217,174,59,0.10), transparent 65%)", pointerEvents: "none", zIndex: 0 }} />

      <section style={{ flex: 1, maxWidth: 760, margin: "0 auto", padding: "140px 32px 100px", width: "100%", position: "relative", zIndex: 1 }}>
        <div className="epi-eyebrow" style={{ marginBottom: 20, color: "var(--epi-gold-500)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>Changelog</div>
        <h1 className="epi-display" style={{ fontSize: "clamp(40px, 7vw, 72px)", lineHeight: 0.95, margin: "0 0 20px", color: "var(--epi-cream-50)" }}>
          What's new in Epidom.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.75, color: "rgba(251,249,228,0.55)", maxWidth: 560, margin: "0 0 64px" }}>
          Every improvement, fix, and new feature — shipped fast and documented here.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {RELEASES.map((release, i) => {
            const tag = TAG_STYLES[release.tag];
            return (
              <div
                key={release.version}
                style={{
                  paddingTop: i === 0 ? 0 : 48,
                  paddingBottom: 48,
                  borderBottom: i < RELEASES.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--epi-cream-50)", letterSpacing: "-0.01em" }}>
                    {release.version}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                    padding: "2px 8px", borderRadius: 4,
                    background: tag.bg, color: tag.text,
                  }}>
                    {tag.label}
                  </span>
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                  {release.items.map((item, j) => (
                    <li key={j} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: tag.text, marginTop: 9, flexShrink: 0, opacity: 0.7 }} />
                      <span style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(251,249,228,0.62)" }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
