# Changelog

Major changes to Epidom, in reverse chronological order. Each entry is dated and references the phase if applicable.

For the active task list and roadmap, see `/docs/roadmap.md` and `/docs/PHASE_0_CLEANUP.md`.

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
