# Roadmap

The phased migration from the original cookie-bar inventory codebase to the new Indonesian F&B storefront-first platform. Each phase is independently shippable.

Always check `/docs/PHASE_0_CLEANUP.md` for the immediately active task list.

---

## Phase summary

| Phase                         | Duration   | Cumulative | Outcome                                               |
| ----------------------------- | ---------- | ---------- | ----------------------------------------------------- |
| **0. Cleanup**                | 1 week     | 1 wk       | Codebase de-Cookied, plans renamed, marketing aligned |
| **1. Public storefront**      | 4-6 weeks  | 5-7 wk     | Free-tier shippable: Linktree replacement + menu      |
| **2. Direct ordering + QRIS** | 4-6 weeks  | 9-13 wk    | Free-tier MVP complete, anonymous orders work         |
| **3. Lightweight POS**        | 6-8 weeks  | 15-21 wk   | Competitive against Loyverse for small operators      |
| **4. Operations layer**       | 4-6 weeks  | 19-27 wk   | First paid tier (shift, KDS, inventory, recipe cost)  |
| **5. Aggregator + finance**   | 8-12 weeks | 27-39 wk   | Defensible in Indonesia; multi-outlet ready           |

So: ~3 months to public free launch, ~6 months to a full ladder.

---

## Phase 0, Cleanup & Re-alignment

**Goal:** the codebase reflects the new positioning. No new features.

**Deliverables:**

- `SubscriptionPlan` enum renamed: `FREE`, `POS`, `OPERATIONS`, `ENTERPRISE`
- Cookie-bar references removed from all marketing copy
- Dead packages removed from `package.json`
- `fr` locale frozen, no new strings added
- `/docs` set updated to reflect the new direction

**Files affected:**

- `prisma/schema.prisma`
- `src/locales/{en,id}.ts`
- `src/app/(marketing)/*`
- `src/lib/seo.ts`
- `package.json`

See `/docs/PHASE_0_CLEANUP.md` for the day-by-day task list.

**Done when:** a new developer reading the repo cannot tell it was ever a cookie-bar app.

---

## Phase 1, Public Storefront

**Goal:** any merchant can publish a public ordering-ready storefront in 5 minutes.

**New schema:**

- `Storefront` (1:1 with `Store`)
- `MenuCategory`
- `MenuItem` (loosely linked to `Product` via optional `productId`)

**New routes:**

- `src/app/(public)/@[slug]/page.tsx` (storefront)
- `src/app/(public)/@[slug]/menu/page.tsx`
- `src/app/(public)/@[slug]/menu/[itemId]/page.tsx`
- `src/app/api/public/storefront/[slug]/route.ts`

**New features:**

- `src/features/storefront/editor/` (in-app editor)
- `src/features/storefront/analytics/` (basic view count)

**Onboarding rewrite:**

- 5-step onboarding (name → logo → 3 menu items → theme → publish)
- AI-generated logo if user skips upload (reuse existing `@ai-sdk/google`)
- AI menu item suggestions by cuisine (reuse existing AI import pipeline)

**Acceptance criteria:**

- A user can sign up, publish a storefront, and share the link in <10 minutes
- The storefront loads in <2 seconds on 4G in Jakarta
- The slug is unique, validated, and slug-safe
- The merchant can edit the menu and see changes live
- WhatsApp, Instagram, TikTok, GoFood, GrabFood links work as outbound buttons

**Not in scope:**

- No order intake on the public side (Phase 2)
- No POS, no inventory, no payment (Phase 2-3)
- No custom domains (Phase 5+)

---

## Phase 2, Direct Ordering + QRIS

**Goal:** customers can place a paid order through the storefront; merchant gets a real-time notification.

**Schema extensions:**

- `Order`: add `storefrontId`, `orderType`, `tableNumber`, `customerName`, `customerPhone`, `paymentMethod`, `paymentStatus`, `paymentProviderRef`, `source`
- New enums: `OrderType`, `PaymentMethod`, `PaymentStatus`, `OrderSource`

**New integrations:**

- Xendit for QRIS, GoPay, OVO, DANA, ShopeePay, bank transfer
- Fonnte for WhatsApp notifications (v1)
- Inngest for background jobs (order routing, notification retries)
- SSE for real-time dashboard updates

**New abstractions:**

- `src/lib/payments/providers/{stripe,xendit}.ts` + selector by region
- `src/lib/notifications/providers/{fonnte,whatsapp-business}.ts` + selector

**New routes:**

- `src/app/(public)/@[slug]/order/page.tsx` (cart + checkout)
- `src/app/(public)/@[slug]/order/[orderId]/page.tsx` (status)
- `src/app/api/public/orders/route.ts`
- `src/app/api/webhooks/xendit/route.ts`
- `src/app/api/stores/[id]/orders/stream/route.ts` (SSE)

**Acceptance criteria:**

- A customer can complete a QRIS payment end-to-end
- The merchant receives a WhatsApp notification within 10 seconds of order placement
- The dashboard updates in real-time without a page refresh
- Webhook retries are idempotent
- A failed payment leaves the order in a recoverable state

**Not in scope:**

- POS / cashier mode (Phase 3)
- Kitchen display (Phase 3)
- Stock deduction (Phase 4)

---

## Phase 3, Lightweight POS

**Goal:** the merchant can run their service entirely on Epidom: take orders in person, manage queues, print receipts.

**Critical architectural choice:** offline-first PWA. Indonesian internet is unreliable; a POS that fails in a brownout loses the deal. Use:

- `next-pwa` + service worker
- `idb-keyval` for the offline queue
- TanStack Query mutations with IndexedDB persistence
- Sync on reconnect with conflict resolution

**New schema:**

- `Table` (tables in the restaurant)
- `OrderItem.status` for KDS workflow
- `OrderItem.preparedAt`, `OrderItem.servedAt`

**New routes:**

- `src/app/(app)/store/[storeId]/(dashboard)/pos/page.tsx`
- `src/app/(app)/store/[storeId]/(dashboard)/pos/orders/page.tsx`
- `src/app/(app)/store/[storeId]/(dashboard)/pos/kds/page.tsx`
- `src/app/(app)/store/[storeId]/(dashboard)/tables/page.tsx`

**New integrations:**

- Web Bluetooth for ESC/POS thermal printers (`esc-pos-encoder`)
- PDF receipt fallback for unsupported printers

**Acceptance criteria:**

- The POS continues to function with no internet for 30+ minutes, then syncs on reconnect
- Receipts print to common 58mm and 80mm Bluetooth thermal printers used in Indonesia
- A walk-in order and an online order appear in the same queue with different badges
- The KDS shows items in real-time as orders come in

**Decision point at end of Phase 3:** is POS gated behind paid tier, or kept free with monetization starting at Phase 4? Decide based on activation data from Phase 1-2.

---

## Phase 4, Operations Layer (first paid tier)

**Goal:** merchants who hire staff and care about ingredient costs have a reason to pay.

**New schema:**

- `StaffMember` (staff with PIN-based clock-in)
- `Shift` (open/close shift, cash reconciliation)
- `StaffRole` enum
- `Order.shiftId` (every sale attributed to a shift)

**Resurrected schema (from original cookie-bar code):**

- `Material` (was archived in Phase 0, now re-exposed)
- `Recipe`, `RecipeIngredient`
- `StockMovement`
- `Alert`

These were not deleted in Phase 0; just hidden. They come back behind plan gating.

**New service:**

- `src/lib/services/stock-deduction.service.ts`: when an order is marked complete, deduct ingredients via the linked recipe automatically

**New routes (re-exposed with plan gate):**

- `data/materials`, `data/recipes` (now plan-gated to `OPERATIONS`)
- `alerts`, `tracking` (low stock + audit history)
- `staff`, `shifts` (new)

**Plan-gating middleware:**

- `src/lib/auth/require-plan.ts` enforces `subscription.plan >= "OPERATIONS"` in route layouts

**Acceptance criteria:**

- Stock auto-decrements when an order is marked complete
- Low-stock alerts fire when a material goes below threshold
- Shift open/close reconciliation matches cash drawer expectations within 1%
- A cashier with a PIN can clock in/out without a manager
- HPP (cost per dish) is calculated correctly to 2 decimal places

---

## Phase 5, Aggregator + Finance (the moat)

**Goal:** consolidated view across all sales channels and outlets. The reason a multi-outlet chain pays for ENTERPRISE.

**New schema:**

- `Order.source` enum: `DIRECT`, `GOFOOD`, `GRABFOOD`, `SHOPEEFOOD`, `TOKOPEDIA`
- `AggregatorConnection` (linking merchant accounts to their delivery platform accounts)

**Aggregator ingestion (realistic approach):**

- v1: email forwarding parser. Merchants forward order confirmation emails from GoFood/GrabFood/ShopeeFood to `orders@epidom.id`. Inngest worker parses via the existing AI SDK and creates `Order` records.
- v2: pursue official partner API access. This takes 6-12 months of relationship-building. Not a v1 problem.

**Finance reports:**

- Daily / weekly / monthly revenue, COGS, gross margin
- Per-channel P&L (with hardcoded commission rates for each aggregator)
- Top-selling items by revenue and quantity
- Shift-level cash reconciliation
- Exportable PDF and Excel (jsPDF and xlsx already in stack)

**Multi-outlet:**

- Owner-level dashboard rolling up multiple `Store` records
- Per-outlet permissions for managers
- Consolidated reporting

**Optional, deferred to Phase 5+:** Stripe Connect 80/20 payment facilitation (from the original codebase). Requires legal review for Indonesian payment regulations (BI / OJK). Don't ship without it.

**Acceptance criteria:**

- An ENTERPRISE merchant sees orders from all sources in one queue
- Finance reports balance to the penny against raw order data
- A multi-outlet owner can drill down from rollup to outlet to shift to order
- Email parsing accuracy >95% on common templates

---

## Staff Scheduling, Hours & Selfie Attendance

**Status:** Shipped 2026-08-05 (see `STATUS.md`). Originally documented here as a "proposed addition, pending approval" beyond the committed Phase 5 roadmap (AGENTS.md §2) — the operator approved and it was built across all 3 phases below in one pass. Kept as its own section (not folded into Phase 4 or 5's write-ups above) since it postdates both. See `docs/FEATURES.md`'s "Shift management" / "Staff and roles" bullets (OPERATIONS tier) for the corresponding tier-facing entries.

**Goal:** managers can build and publish work rosters, staff clock in/out with a selfie + geolocation for an auditable attendance trail, hours/overtime are calculated automatically, and end-of-day transactions can be sliced per named shift-block and per staff member.

**Why a new domain instead of extending the existing `Shift` model:** `Shift` (Phase 4) is a POS cash-drawer till session — `openingCash` is required, so in practice only cashier-role staff ever get one. Kitchen/bar/waiter staff have no clock-in mechanism today. This proposal adds a parallel, general-purpose domain rather than overloading the append-only, financially-critical `Shift` table.

**New schema:**

- `ScheduleShift` — reusable named time-block templates per store (e.g. "Shift 1" 08:00–16:00), matching how merchants already run rosters in spreadsheets (named, colored, sometimes-overlapping blocks for handover coverage).
- `StaffSchedule` — one roster assignment: staff × date × block (or a custom one-off time range), department, `DRAFT`/`PUBLISHED` status, `publishedAt`.
- `AttendanceRecord` — one clock event: `CLOCK_IN` / `CLOCK_OUT` / `ABSENCE`, timestamp, selfie URL (via the existing `StorageAdapter`/`POST /api/upload`), best-effort latitude/longitude + reverse-geocoded label, optional link back to the `StaffSchedule` row being clocked into.
- `Store.standardWorkMinutesPerDay` (default 480) — single scalar, same pattern as the existing `payLaterEnabled`/`kitchenDisplayEnabled` toggles, used as the overtime threshold.

**Working hours / overtime:** computed on read, not stored — pairs `CLOCK_IN`/`CLOCK_OUT` records per staff per day (business timezone), attributes a completed pair to the day it started (so a 20:00→04:00 shift is one entry, no special-casing for crossing midnight), flags missing clock-outs instead of estimating them, and compares total minutes/day against `standardWorkMinutesPerDay` for the regular/overtime split. No payroll amount computation — hours only.

**Shift reports:** because named blocks can overlap by design (a merchant's "Shift 2 Middle" deliberately overlaps "Shift 1" and "Shift 3" for handover), a per-block revenue report is a set of independent coverage-window sums, not a mutually-exclusive partition — totals across blocks are not expected to sum to the grand total, and the UI must say so explicitly. "Per staff member" can only mean true order-level revenue attribution for cashiers (via the existing `Shift.staffMemberId`) unless `Order` gains a `servedByStaffMemberId` field (an explicit, separate scope decision, not included by default) — for every other role it means "who was rostered on," shown as a separate informational cut.

**Selfie + geolocation:** browser-native `getUserMedia` (with a plain `<input type="file" capture="user">` fallback) and `navigator.geolocation`, both best-effort — permission denial must never block a clock-in/out. Reverse geocoding happens server-side against a free/keyless provider and fails silently to `null`. No map-rendering library (per AGENTS.md §7) — the audit view shows raw coordinates/label plus an external "view on Google Maps" link only.

**Suggested phasing:**

1. Attendance capture (schema + clock-in/out/absence/status/audit routes, topbar clock-in dialog, selfie+geo UI) — usable standalone as a manager audit tool.
2. Scheduling + hours/overtime (roster CRUD/publish, week-grid builder, the overtime algorithm).
3. Shift reports (Finance tab extension, coverage-window bucketing, XLSX export).

**Acceptance criteria:**

- A manager can publish a week's roster and every affected staff member sees only their own published shifts in-app.
- Every clock-in/out is backed by a selfie + timestamp + best-effort location, filterable by staff and date range in the audit view.
- Overtime hours reconcile against a manual spot-check of raw clock-in/out timestamps for at least one cross-midnight shift.
- The shift-block revenue report visibly discloses when blocks overlap rather than silently double-counting.

---

## Cross-phase technical decisions

These apply across phases. Listed once here so we don't re-debate them.

**Hosting**

- Phase 1-2: stay on Vercel
- Phase 3+: evaluate Singapore-hosted alternatives (Fly.io, Railway, or self-hosted Jakarta)

**Database**

- Always Postgres + Prisma
- Migrate from Vercel Postgres / Neon US to Singapore region when latency becomes an issue (>200ms p95 from Jakarta)

**Image hosting**

- Phase 1-2: Vercel Blob
- Phase 3+: Cloudflare R2 + Images for cost and IDN latency

**Background jobs**

- Inngest from Phase 2 onwards
- BullMQ if Inngest pricing becomes an issue at scale

**Testing**

- Phase 0: write E2E (Playwright) for the 5 critical paths
- Every phase: maintain those tests
- Don't aim for 90% coverage. Aim for "the journeys that, if broken, kill the business"

**Locale strategy**

- `id` is primary
- `en` is secondary, must stay in sync with `id`
- `fr` is frozen as of Phase 0. Not deleted, not updated.

---

## Risks tracked across the roadmap

| Risk                                             | Mitigation                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Owner.com expands to Asia                        | Build local depth (QRIS, GoFood integration, IDN language) faster than they can localize |
| WhatsApp Business Catalog improves               | Add ordering + payment + analytics that catalog can't match                              |
| GoFood/GrabFood ban third-party email parsing    | Move to scraping or partner API; have a fallback ready                                   |
| Xendit pricing changes                           | Keep payment provider abstracted; Midtrans is the backup                                 |
| Fonnte (unofficial WhatsApp) gets banned by Meta | Migration to official WhatsApp Business API already designed                             |
| Team can't ship Phase 1 in 6 weeks               | Cut scope: drop AI logo generation and analytics; keep core editor and public page       |

---

## Definition of Phase Done

A phase is "done" when:

1. All listed acceptance criteria pass
2. Tests cover the critical paths added in the phase
3. Docs in `/docs` reflect the changes
4. The Changelog (`docs/CHANGELOG.md`) has an entry
5. At least 5 friendly users have used the new functionality without manual intervention

No phase ships without all five.
