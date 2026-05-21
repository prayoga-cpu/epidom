# Roadmap

The phased migration from the original cookie-bar inventory codebase to the new Indonesian F&B storefront-first platform. Each phase is independently shippable.

Always check `/docs/PHASE_0_CLEANUP.md` for the immediately active task list.

---

## Phase summary

| Phase | Duration | Cumulative | Outcome |
|---|---|---|---|
| **0. Cleanup** | 1 week | 1 wk | Codebase de-Cookied, plans renamed, marketing aligned |
| **1. Public storefront** | 4-6 weeks | 5-7 wk | Free-tier shippable: Linktree replacement + menu |
| **2. Direct ordering + QRIS** | 4-6 weeks | 9-13 wk | Free-tier MVP complete, anonymous orders work |
| **3. Lightweight POS** | 6-8 weeks | 15-21 wk | Competitive against Loyverse for small operators |
| **4. Operations layer** | 4-6 weeks | 19-27 wk | First paid tier (shift, KDS, inventory, recipe cost) |
| **5. Aggregator + finance** | 8-12 weeks | 27-39 wk | Defensible in Indonesia; multi-outlet ready |

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

| Risk | Mitigation |
|---|---|
| Owner.com expands to Asia | Build local depth (QRIS, GoFood integration, IDN language) faster than they can localize |
| WhatsApp Business Catalog improves | Add ordering + payment + analytics that catalog can't match |
| GoFood/GrabFood ban third-party email parsing | Move to scraping or partner API; have a fallback ready |
| Xendit pricing changes | Keep payment provider abstracted; Midtrans is the backup |
| Fonnte (unofficial WhatsApp) gets banned by Meta | Migration to official WhatsApp Business API already designed |
| Team can't ship Phase 1 in 6 weeks | Cut scope: drop AI logo generation and analytics; keep core editor and public page |

---

## Definition of Phase Done

A phase is "done" when:
1. All listed acceptance criteria pass
2. Tests cover the critical paths added in the phase
3. Docs in `/docs` reflect the changes
4. The Changelog (`docs/CHANGELOG.md`) has an entry
5. At least 5 friendly users have used the new functionality without manual intervention

No phase ships without all five.
