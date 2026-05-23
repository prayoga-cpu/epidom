# Changelog

Major changes to Epidom, in reverse chronological order. Each entry is dated and references the phase if applicable.

For the active task list and roadmap, see `/docs/roadmap.md` and `/docs/PHASE_0_CLEANUP.md`.

---

## 2026-05-24 — UI System Sync (Dark/Light Mode + Brand Tokens)

### Codebase
- Added `next-themes` ThemeProvider to `(app)/layout.tsx` with `defaultTheme="dark"`, `suppressHydrationWarning` on `<html>` and `<body>`
- Bridged `--epi-navy-*` tokens into shadcn `.dark` CSS block (`--background`, `--card`, `--sidebar`, `--border`, `--muted`, `--primary: epi-gold-400`)
- Light mode `:root` updated to cream palette (`--background: #FBF9E4`, body gradient)
- Added `--chart-grid`, `--chart-axis`, `--chart-line` CSS vars; production history chart now adapts to both modes
- Dashboard topbar: `bg-primary` → explicit `var(--epi-navy-850)` inline style; PNG logo → `EpidomLogo` SVG component; inline `ThemeToggle` (Sun/Moon)
- Auth pages redesigned to epi dark-navy: gold CTA buttons, cream text, gold focus rings on inputs, navy-900 background
- Auth visual right panel: replaced zinc/orange blobs with epi-gold + navy radial gradients
- Onboarding: orange-500 accent → `--epi-gold-500` (progress bar, buttons, step badges)
- Cookie consent bar: dark glass style matching marketing site
- Sheet z-index: z-50 → z-[70] to fix mobile sheet/floating-nav overlap ("EPIDOMDOM" bug)
- Global `.dark` CSS overrides: `text-gray/slate/zinc/neutral/black-*` all resolve to `--epi-cream-50`
- NavUser, StoreSwitcher, ProfileNav, Profile layout, Stores page, StoreCard — comprehensive semantic token pass
- Storefront editor tabs, menu editor, analytics, publication toggle card — slate/white → semantic tokens
- Create store button: `--color-brand-primary` → `--epi-gold-500` fill
- POS order card: channel + status badges moved to shared right-side `flex-col`

### Bugs
- Fixed React hydration mismatch caused by Grammarly browser extension injecting `data-gr-*` onto `<body>`
- Fixed 140+ `Operations` text corruptions across `en.ts`, `id.ts`, `fr.ts` (a prior regex replaced "Pro" → "Operations", breaking "Profile", "Product", "Production", "Progress", "Processing", "Proceed", "Provide", "Property", "Proof", "Produk", "Produksi", "Profil", "Promo")
- Added missing translation keys to `id.ts` (18 keys) and `fr.ts` (162 keys)

---

## 2026-05, Phase 5 — Aggregator + Finance

### Schema
- Added `AggregatorPlatform` enum: `GOFOOD | GRABFOOD | SHOPEEFOOD | TOKOPEDIA`
- Added `AggregatorConnection` model — tracks which aggregator channels a store has connected
- Added `AggregatorEmail` model — raw audit log of all inbound emails with `parseStatus` lifecycle (`pending → success | failed | manual`)
- Extended `Order.source` enum with `GOFOOD | GRABFOOD | SHOPEEFOOD | TOKOPEDIA`
- Migration: `phase5_aggregator_finance`

### Codebase
- `POST /api/webhooks/email` — Resend inbound email webhook; extracts `[@slug]` from subject, detects platform, stores `AggregatorEmail`, fires Inngest job
- `src/lib/inngest/functions/parse-aggregator-email.ts` — parses email body with OpenAI gpt-4o (structured Zod schema), creates `Order + OrderItems`; falls back to `parseStatus="manual"` when `OPENAI_API_KEY` is absent
- `src/config/aggregator.config.ts` — commission rates (20% GoFood/GrabFood/ShopeeFood, 15% Tokopedia), platform labels, OrderSource mappings
- `GET /api/stores/[id]/finance/summary` — revenue, COGS (via `StockMovement.SALE`), gross profit, gross margin %, daily buckets
- `GET /api/stores/[id]/finance/channels` — per-channel P&L with commission deductions, sorted by revenue
- `GET /api/stores/[id]/finance/top-items` — top N items by revenue with order count and qty sold
- `GET /api/owner/summary` — cross-store rollup (ENTERPRISE only); revenue + order + pending counts per store, sorted descending
- Finance UI (`src/features/dashboard/finance/`) — date range picker, KPI cards, 3 tabs (channel / top-items / daily), Excel export via `XLSX`
- Owner dashboard UI (`src/features/dashboard/owner/`) — KPI cards + per-store table; shows plan-locked card for non-ENTERPRISE
- All finance/owner routes gated to ENTERPRISE plan via `requirePlan()` or inline plan check

### Docs
- `docs/DATABASE.md` — updated Phase 5 section with correct `AggregatorEmail` and `AggregatorConnection` schemas
- `docs/ARCHITECTURE.md` — added aggregator email pipeline diagram and commission rate table

---

## 2026-05, Phase 0 — Cleanup & Re-alignment

The codebase moves from "cookie-bar inventory app for France" to "storefront-first F&B platform for Indonesia."

### Strategy
- New positioning documented in `/docs/STRATEGY.md`
- Target market shifted to Indonesia
- French market paused, `fr` locale frozen
- Cookie-bar positioning removed from all user-facing surfaces

### Schema
- Renamed `SubscriptionPlan` enum: `STARTER`/`PRO`/`ENTERPRISE` → `FREE`/`POS`/`OPERATIONS`/`ENTERPRISE`
- Migration manually scripted to preserve existing subscriber data
- Storefront-related models (`Storefront`, `MenuCategory`, `MenuItem`) added as commented scaffolding for Phase 1

### Codebase
- Removed packages: `leaflet`, `react-leaflet`, `maplibre-gl`, `@types/leaflet`, `mathjs`
- Hidden behind feature flags: `management/`, `data/`, `tracking/`, `alerts/` dashboard sections (return in Phase 4)
- Archived: `/marketing/` (old strategy docs) → `_archive/marketing-old/`
- Archived: outdated marketing pages (`services`, etc.)

### Docs
- New: `AGENTS.md` at root for AI coding tools
- New: `docs/STRATEGY.md`, `docs/roadmap.md`, `docs/PHASE_0_CLEANUP.md`
- Updated: `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/FEATURES.md`, `docs/BILLING.md`, `docs/ENVIRONMENT.md`, `docs/DATABASE.md`
- Removed/redirected: `CLAUDE.md` (superseded by `AGENTS.md`)

### Pricing
- Indonesia primary pricing: Rp 0 / Rp 99,000 / Rp 249,000 / Rp 499,000+
- Annual discount: 20%
- 14-day trial on paid tiers
- Stripe products renamed in dashboard

---

## 2026-Q1, original codebase

Project existed as a SaaS ERP positioned for cookie bars in France with €29/€79/Custom tiers. Built features included:

- Better Auth integration with Google OAuth
- Multi-tenant Business → Store hierarchy
- Materials, Recipes, Production Batches, Stock Movements
- Suppliers, Supplier Orders
- Stripe subscriptions + Stripe Connect 80/20 scaffolding
- AI-powered CSV import via OpenAI and Google AI
- Trilingual UI (EN, FR, ID)
- shadcn/ui design system
- Vercel-hosted with Vercel Blob for images

This was the launching point for Phase 0 cleanup. The features above are not deleted — they are paused and return in Phase 4 (operations) and Phase 5 (enterprise).

---

## How to update this file

- Append to the top under the current month's heading
- Group by `### Strategy / Schema / Codebase / Docs / Pricing / Bugs`
- One bullet per change, present tense, action-first
- Link to the PR or commit if helpful
- Don't rewrite history. Add corrections as new entries.
