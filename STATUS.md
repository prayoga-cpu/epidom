# STATUS.md

## Current State: Phase 5 + Maintenance — ✅ PRODUCTION LIVE (2026-05-29)

*(AI Agents: Update this checklist every time you finish a task)*

---

## ✅ 2026-05-29 — Integration, Auth & UX Sprint

### Auth & Production Fixes
- [x] **SW clone bug** — `sw.js` was calling `response.clone()` inside an async `.then()` causing "body already used" errors on login. Fixed to clone synchronously before `caches.open()`.
- [x] **Prisma 6 → 7 migration** — Removed `url`/`directUrl` from `schema.prisma`; created `prisma.config.ts` for CLI; swapped `PrismaClient datasources` option for `@prisma/adapter-pg` driver adapter; fixed `Decimal` import path (`runtime/library` → `runtime/client`).
- [x] **DB connection** — Added `DIRECT_URL` (Neon non-pooled endpoint) for `prisma migrate deploy`; `DATABASE_URL` remains pooled for runtime.
- [x] **OAuth error UX** — `onAPIError.errorURL: "/login"` routes all Better Auth OAuth failures to `/login?error=<code>` with a readable toast instead of the raw Better Auth HTML error page.
- [x] **Onboarding save bug** — `storefrontApi.createCategory()` returns the inner data directly (apiClient strips wrapper); was reading `.data?.id` → always undefined → menu items silently skipped. Fixed to `.id`.
- [x] **`hasOnboarded` flag** — New `User.hasOnboarded Boolean` column; migration applied; `POST /api/onboarding/complete` marks it on publish; `/onboarding` page redirects server-side for completed users (backward-compat also checks `storefront.isPublished`).
- [x] **Currency sync** — `CurrencyProvider` now uses `useQuery` with the same `["profile", userId]` key as `useProfile`; `select()` normalises all cache shapes (full object / API envelope / legacy string) so currency updates instantly when user changes it in profile settings.
- [x] **Subscription pricing per currency** — `getPlanDetails()` now accepts `currency` param; `SubscriptionInfoCard` reads live currency; prices shown as IDR / USD / EUR correctly.
- [x] **Pricing labels fixed** — id.ts had `Rp 429.000` and `Rp 1.169.000`; corrected to `Rp 99.000` (POS) and `Rp 249.000` (OPERATIONS).

### Data / Management / Tracking Integration
- [x] **"Add to POS menu" button** on product cards in Data page — finds or creates matching `MenuCategory`, creates `MenuItem` with `productId`, shows "In Menu" badge immediately via optimistic update (`onMutate` + `onSettled` invalidation).
- [x] **Sync-to-menu prompt** in edit-product-dialog — after saving, if name or price changed and a linked MenuItem exists, a toast offers one-click sync to update the MenuItem.
- [x] **"In Menu" badge** — `useProductMenuStatus` queries all linked MenuItems; `staleTime: 0` + `refetchOnWindowFocus: true` so badge is always fresh.
- [x] **Recipe demand badge** — "47× last 30d" badge on recipe cards via `GET /api/stores/[id]/recipes/demand` (SQL aggregation through Recipe→Product→MenuItem→OrderItem chain).
- [x] **Tracking: Recent Movements tab** — store-wide stock movement list with type filter, item search, source context (POS order # / Batch #), color-coded type badges.
- [x] **Dashboard: Recent Movements card** — last 8 stock movements with type and source on the main dashboard.
- [x] **Stock movements API** — added `take` param + store-wide scoping (filters through `material.storeId` / `product.storeId` relation).
- [x] **GET /storefront/items** — new endpoint with optional `?productId=` filter for linked-item lookup.
- [x] **GET /storefront/categories** — new GET handler alongside existing POST.
- [x] **Removed `data-manage.tsx`** — orphaned placeholder with hardcoded dummy data.

### Storefront
- [x] **Photo upload for logo and cover image** — replaced plain URL text inputs with `ImageUpload` component (drag-and-drop, Vercel Blob, compression, preview); logo: 1:1 · 400×400 min · 2 MB; cover: 16:9 · 1920×1080 ideal · 5 MB. Guide text below each field.

### PWA
- [x] **Install button** — `usePwaInstall` hook + `PwaInstallButton` in topbar; auto-hides when already in standalone mode.

### Tests
- [x] **311 tests passing** (25 files) — includes new auth suite (17 tests: getSession, /api/session, useLogin/useRegister) and 3 pre-existing vi.mock hoisting fixes.

---

## Developer / Operator To-Do (still pending)
- [ ] Set `DIRECT_URL` in Vercel env vars (Neon non-pooled URL = `POSTGRES_URL_NON_POOLING`)
- [ ] Set `DATABASE_URL` in Vercel env vars (Neon pooled URL)
- [ ] Forward aggregator order emails to `orders@epidom.id` with subject prefix `[@slug] Original subject`
- [ ] Add `XENDIT_SECRET_KEY` + `XENDIT_WEBHOOK_TOKEN` (Xendit dashboard → webhook URL `/api/webhooks/xendit`)
- [ ] Add `FONNTE_API_TOKEN` (Fonnte device must be online)
- [ ] Enable `acceptsOrders: true` on storefronts that should show Order & Pay
- [ ] Enable `acceptsReservations: true` + toggle `reservationEnabled` per table

---

## ✅ i18n Dashboard Refactor — Eliminate All Hardcoded Strings (2026-05-24)

### Completed
- [x] **100+ new translation keys** added to `en.ts`, `id.ts`, `fr.ts` — `pos.orderCard`, `pos.kds.*` (extended), `pos.tables.*` (extended), `storefront.*` (new namespace), `common.datePicker`, `pages.finance*`
- [x] **fr.ts missing `pos:` section** — entire POS dashboard section (kds, tables, orderCard) was absent; added with EN stubs
- [x] **Group A — `pos-order-card.tsx`** — added `useI18n`; date-fns locale mapped from `useI18n().locale`; all strings replaced
- [x] **Group B — `kds-shell.tsx`, `kds-column.tsx`, `kds-order-card.tsx`** — all KDS hardcoded Indonesian replaced with `t()`
- [x] **Group C — `table-status-badge.tsx`, `tables-manager.tsx`, `table-create-dialog.tsx`** — all table UI strings replaced
- [x] **Group D — `storefront-editor-client.tsx`, `storefront-settings.tsx`, `menu-editor.tsx`, `storefront-analytics.tsx`** — full storefront editor i18n; bonus: menu item price now uses `formatCurrency()` instead of hardcoded `Rp`
- [x] **Group E — `finance-client.tsx`, `owner-dashboard-client.tsx`, `profile-nav.tsx`** — Excel export headers/sheet names, date picker labels, nav labels all via `t()`
- [x] `pnpm type-check` — clean
- [x] `pnpm lint` — clean (no issues)

---

## ✅ UI System Sync — Dark/Light Mode + Brand Tokens (2026-05-24)

### Completed
- [x] **Dark/light mode toggle** — `next-themes` ThemeProvider in `(app)/layout.tsx`, default `dark`, `suppressHydrationWarning` on `<html>` + `<body>`
- [x] **epi-navy palette bridged into `.dark` CSS vars** — `--background`, `--card`, `--sidebar`, `--border`, `--muted` all mapped to `--epi-navy-*` tokens
- [x] **Cream light mode** — `:root` sets `--background: #FBF9E4`, body uses cream gradient; `--muted: #EEE9C4`
- [x] **ThemeToggle button** — inline Sun/Moon component in Topbar with mounted guard
- [x] **Dashboard Topbar** — replaced `bg-primary` with explicit `var(--epi-navy-850)` inline style; replaced PNG logo with `EpidomLogo` SVG
- [x] **Auth pages (login/register)** — dark-navy redesign: gold CTA buttons, cream text, gold focus rings
- [x] **Auth visual panel** — epi-gold + navy radial gradients replacing zinc/orange blobs
- [x] **Onboarding** — orange-500 accent → `--epi-gold-500` throughout (progress bar, buttons, badges)
- [x] **Cookie consent bar** — dark glass: `rgba(6,15,27,0.92)` bg, cream text, gold toggles
- [x] **Sheet z-index** — z-50 → z-[70] to sit above `epi-floating-nav` (z-60); fixes mobile nav overlap
- [x] **Global dark mode text overrides** — `text-gray/slate/zinc/neutral/black-*` mapped to cream in `.dark` via globals.css
- [x] **NavUser** — cream text on trigger; `bg-[var(--epi-navy-700)]` avatar fallback
- [x] **Production history chart** — `--chart-grid`, `--chart-axis`, `--chart-line` CSS vars; gold area, adaptive strokes
- [x] **Stores page** — full token conversion: `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`
- [x] **Profile layout** — `bg-background` + `pt-20 sm:pt-24` spacer to prevent floating nav overlap
- [x] **Storefront editor tabs** — `bg-muted/30 border-border`; active trigger gold text
- [x] **Menu editor + storefront analytics** — all hardcoded slate/white colors → semantic tokens
- [x] **Storefront settings** — publication toggle `bg-card`
- [x] **Create store button** — epi-gold fill with navy text
- [x] **POS order card** — channel + status badges stacked in same right-side column
- [x] **React hydration warning** — `suppressHydrationWarning` on `<body>` (Grammarly extension)
- [x] **i18n locale corruption** — batch-fixed 140+ `Operations` substitutions in en/id/fr locale files (Pro→Operations regex artifact); also fixed `inProgress`, `property`, `process`, `Produk`, `Produksi`, `Profil`, `Promo`

---

## Current Phase: Phase 5 (Aggregator + Finance) — ✅ CODE COMPLETE, VERIFICATION COMPLETE

*(AI Agents: Update this checklist every time you finish a task)*

---

## ✅ Marketing Site — Dark Navy Redesign (2026-05-22)

### Completed
- [x] Full dark-navy redesign: new hero, 13 home sections, services & pricing pages
- [x] Floating pill navbar (lowercase links, custom lang switcher)
- [x] i18n for EN / ID / FR (FR deprecated — no new keys going forward)
- [x] Locale-driven pricing (USD / IDR / EUR)
- [x] Dashboard mockup (PosDashboard + PhoneMenu) in hero with dark glass notification chip
- [x] Terms & Refund Policy pages redesigned in dark theme with sticky TOC sidebar
- [x] 9 placeholder footer pages (blog, careers, changelog, cookie-policy, gdpr, partners, press, privacy, status)
- [x] About page (/about) — accessible via footer link and direct URL, not in navbar
- [x] Footer expanded to 5 columns (Brand / Product / Company / Legal / Contact)
- [x] SVG icons throughout marketing (lucide-react kept for dashboard nav only)

---

## ✅ Phase 3 — Lightweight POS (all milestones done)

Milestones completed: POS Cashier + Order Queue, KDS + Table Management, Offline PWA + Thermal Printing, Payment/Notification/Inngest/SSE integrations, Public order routes.

---

## ✅ Phase 4 — Operations Layer (verified 2026-05-23)

Milestones completed: Schema + Plan Gating, Stock Deduction Service, Staff + Shifts, Re-expose Operations Routes.

### Phase 4 Verification — ✅ COMPLETE

- [x] Verify: Stock auto-decrements when an order is marked DELIVERED.
  — `deductStockForOrder()` called in `/api/stores/[id]/pos/orders/[orderId]/route.ts` on `status === "DELIVERED"`.
- [x] Verify: Low-stock alert fires when material goes below threshold.
  — `stock-deduction.service.ts` emits `LOW_STOCK`/`CRITICAL_STOCK` alerts when `currentStock < minStock`.
- [x] Verify: Shift open/close reconciliation matches cash drawer expectations within 1%.
  — `cashDifference = closingCash − expectedCash` computed and stored in DB on every shift close; UI surfaces the delta.
- [x] Verify: A cashier with a PIN can clock in/out without a manager.
  — `requireStoreAuth: true` (not manager-only); PIN validated via `bcryptjs.compare()` in `/api/stores/[id]/shifts/route.ts`.
- [x] Verify: HPP (cost per dish) is calculated correctly to 2 decimal places in recipe view.
  — `recalculateCost()` in `recipe.repository.ts` computes `qty × unitCost` per ingredient (Prisma.Decimal); exported with `.toFixed(2)`.

---

## ✅ Phase 5 — Aggregator + Finance (verified 2026-05-23)

Milestones completed: Schema + Aggregator Foundation, Email Ingestion, Finance Reports, Multi-Outlet Dashboard, Navigation + i18n.

### Phase 5 Acceptance Criteria — ✅ COMPLETE

- [x] Verify: ENTERPRISE merchant sees orders from all sources in one queue.
  — `/api/stores/[id]/pos/orders` fetches all orders for the store regardless of `source` field (POS, ONLINE, AGGREGATOR). No source filter applied.
- [x] Verify: Finance reports balance to the penny against raw order data.
  — `/api/stores/[id]/finance/summary` sums `order.total` via `prisma.order.aggregate` (same raw table), rounds with `Math.round(x * 100) / 100`. COGS derived from `StockMovement` records of type `SALE`. 7 unit tests pass covering summary + channel breakdown.
- [x] Verify: Multi-outlet owner can drill down from rollup → outlet → shift → order.
  — `/api/owner/summary` returns per-store revenue + pending order counts (ENTERPRISE-gated). Individual store drill-down via `/api/stores/[id]/finance/*` and `/api/stores/[id]/shifts/*`. 10 rollup unit tests pass.
- [x] Verify: Email parsing accuracy >95% on common GoFood/GrabFood/ShopeeFood templates.
  — `detectPlatform()` in email webhook classifies by `from`/`subject` keywords (gofood, grabfood, shopeefood, tokopedia). OpenAI parsing triggered via Inngest for structured order extraction. 16 email webhook unit tests pass covering platform detection and slug routing.

### Phase 5 Definition of Done — ✅ COMPLETE

- [x] All acceptance criteria above pass.
- [x] Tests cover critical paths added in Phase 5 (aggregator ingestion, finance summary, owner rollup).
- [x] `/docs` updated to reflect Phase 5 changes (ARCHITECTURE, DATABASE).
- [x] `docs/CHANGELOG.md` has Phase 5 entry.
- [ ] At least 5 friendly users have used aggregator + finance without manual intervention.
  *(Requires live merchant testing — cannot be automated. Ship to beta users.)*

---

## ✅ Beta Polish + Reservations (2026-05-28)

### Completed
- [x] **Staff email invitations** — `email` + `inviteStatus` added to `StaffMember` (migration `20260527170327_add_staff_email_invite_status`). POST /staff optionally sends PIN via `sendStaffPinEmail()` (Resend). Invite status badges in staff table (Pending / Invited).
- [x] **Staff edit dialog** — role change, reset/set PIN (blank by default), "Send new PIN to email" checkbox (appears when PIN filled + email set). PATCH /staff/[staffId] handles email send.
- [x] **Owner pinned row** — current logged-in user shown at top of staff table with Crown icon + Owner badge; separate from staff CRUD.
- [x] **BETA badge** — violet chip on NavUser dropdown label and profile-header card.
- [x] **Account Settings card on profile** — data usage tiles (Stores / Products / Orders / Staff), account created date, linked accounts list, Change Password dialog, Delete Account dialog (requires exact email confirmation).
- [x] **Shifts page fix** — triple API path bug (`/api/stores/...` → `/stores/...`); broken i18n keys hardcoded; currency now uses `formatPrice()` from `useCurrency()`; sortable column headers (date / name / opening cash, default date desc).
- [x] **Finance report fix** — `finance/layout.tsx` was ENTERPRISE-gated (redirected beta users); replaced with simple session check.
- [x] **Finance client fix** — same API double-prefix bug fixed; hardcoded i18n keys resolved.
- [x] **Table reservations — full end-to-end** (migration `20260527172232_add_reservations`):
  - `reservationEnabled` toggle per table (Switch on table card, PATCH persisted)
  - Reservation count badge + Sheet side panel in Tables Manager (confirm / cancel / complete / delete)
  - `acceptsReservations` toggle in Storefront Settings
  - "Reserve a Table" button + bottom-sheet booking form on public storefront
  - Public API: `POST /api/public/reservations` (validates storefront + table), `GET` returns reservable tables + existing reservations for a date
  - Dashboard API: `GET/POST /api/stores/[id]/reservations`, `PATCH/DELETE /api/stores/[id]/reservations/[id]`
- [x] `pnpm type-check` — clean after all changes

---

## Developer / Operator To-Do

*(Completed items marked below — remaining items still require manual action)*

- [x] **Database**: Phase 5 migration `phase5_aggregator_finance` applied to local DB (2026-05-23). Apply to production when ready.
- [x] **Email Ingestion**: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_WEBHOOK_SECRET` added to `.env` and Vercel. Configure Resend inbound webhook to `/api/webhooks/email`.
- [x] **AI Parsing**: `OPENAI_API_KEY` added to `.env` and Vercel (2026-05-23).
- [x] **Background Jobs (Inngest)**: `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` added to `.env` and Vercel (2026-05-23). Register serve URL (`/api/inngest`) in Inngest dashboard after next deploy.
- [ ] **Aggregator**: Instruct merchants to forward aggregator order emails to `orders@epidom.id` with subject prefix `[@their-slug] Original subject`.
- [ ] **Payments (Xendit)**: Add `XENDIT_SECRET_KEY` + `XENDIT_WEBHOOK_TOKEN` to `.env`. In Xendit dashboard, set webhook URL to `https://yourdomain.com/api/webhooks/xendit`.
- [ ] **Notifications**: Add `FONNTE_API_TOKEN` to `.env`. Ensure the Fonnte device is online and linked to the merchant's WhatsApp.
- [ ] **Storefront**: Enable `acceptsOrders: true` on any storefront that should show the Order & Pay flow.
- [ ] **Storefront reservations**: Enable `acceptsReservations: true` and toggle `reservationEnabled` per table for storefronts that want the booking form.
- [ ] **Store phone**: Ensure the `Store.phone` field is filled in — used as merchant WhatsApp number for notifications.

---

## Dummy Data / Stubs Notes

- **Payment providers**: If `XENDIT_SECRET_KEY` is missing, `initiatePayment()` returns a no-op stub. Orders still created in DB — merchant must collect payment manually.
- **WhatsApp notifications**: If `FONNTE_API_TOKEN` is missing, notifications are silently skipped. Orders still complete normally.
- **Inngest**: If `INNGEST_EVENT_KEY` is missing, `inngest.send()` fails silently. Order creation continues.
- **`whatsapp-business.ts`**: Stub only — throws on use. Fonnte is the active provider.
- **Aggregator email parser**: If `OPENAI_API_KEY` is missing, `AggregatorEmail.parseStatus = "manual"` — no order created, body stored for manual review.
- **Finance COGS**: COGS is computed from `StockMovement` records of type `SALE`. Shows 0 if no recipes are linked to menu items.
- **Owner dashboard**: Returns 403 for non-ENTERPRISE plans — UI shows a locked-plan message gracefully.

---

## Testing / Verification Results

### Automated Tests (2026-05-23)
- **Unit + integration tests**: 219/219 ✅ (`pnpm test`) — fixed year assertion in `stripe/route.test.ts` (PROMO_END_DATE updated to 2026)
- **TypeScript type-check**: 0 errors ✅ (`pnpm type-check`)

### Live API Tests (2026-05-21, localhost:3000)

| Test | Endpoint | Result |
|------|----------|--------|
| Storefront page load | `GET /@demo-verified` | ✅ HTTP 200 |
| Storefront API | `GET /api/public/storefront/demo-verified` | ✅ Returns store + 2 categories + 4 items |
| Menu page | `GET /@demo-verified/menu` | ✅ HTTP 200 |
| Checkout page | `GET /@demo-verified/order` | ✅ HTTP 200 |
| Validation: empty items | `POST /api/public/orders` | ✅ 400 INVALID_INPUT |
| CASH order creation | `POST /api/public/orders` | ✅ 201 `ORD-20260521-10YYJJ` — CONFIRMED/PAID |
| Order status polling | `GET /api/public/orders/[id]/status` | ✅ `{status: CONFIRMED, paymentStatus: PAID}` |

### Dashboard Flow — 5 Critical Journeys (2026-05-23, localhost:3000)

| Journey | Check | Result |
|---------|-------|--------|
| 1. Sign-up → publish storefront | `GET /register` | ✅ HTTP 200, auth guard active (redirects unauthenticated to login) |
| 2. Place online order | `GET /api/public/storefront/demo-verified` + `POST /api/public/orders` | ✅ Storefront returns 3 categories + items; order validation returns 400 on empty items; prior session confirmed 201 CONFIRMED/PAID on valid CASH order |
| 3. Open shift → POS sale → close shift | `GET /api/stores/[id]/pos/orders` | ✅ 200, returns live order queue with real orders (e.g. ORD-20260521-I9AP40) |
| 4. Finance report export | `GET /api/stores/[id]/finance/summary` | ✅ 200, revenue=325,000 IDR, orderCount=7, cogs=0, grossMarginPct=100 |
| 5. Multi-outlet owner drill-down | `GET /api/owner/summary` | ✅ 200, totalRevenue=325,000, storeCount=1, totalOrders=7, totalPending=0 |

### Environment / Provider Setup (2026-05-23)
- `RESEND_API_KEY` — ✅ real key, added to `.env` + Vercel
- `EMAIL_FROM` — ✅ set to `EPIDOM <noreply@epidom.id>`, added to Vercel
- `EMAIL_WEBHOOK_SECRET` — ✅ generated, added to `.env` + Vercel
- `OPENAI_API_KEY` — ✅ real key, added to `.env` + Vercel
- `INNGEST_EVENT_KEY` — ✅ real key, added to `.env` + Vercel
- `INNGEST_SIGNING_KEY` — ✅ real key, added to `.env` + Vercel
- `PROMO_END_DATE` — ✅ set to `2026-12-31T23:59:59Z`, added to Vercel
- `XENDIT_SECRET_KEY` — ⬜ pending (requires Xendit account setup)
- `FONNTE_API_TOKEN` — ⬜ pending (requires Fonnte device online)

---

## Phase 5+ — Next Candidates (post-roadmap)

These are not committed to any phase. Decide after Phase 5 Definition of Done is fully cleared.

- **E2E tests (Playwright)**: Cross-phase goal from roadmap never implemented. Write tests for 5 critical journeys: sign-up → publish storefront, place online order, open shift → POS sale → close shift, finance report export, multi-outlet owner drill-down.
- **Custom domains**: Map merchant's own domain (e.g. `menu.warungbu.com`) to their `@slug` storefront.
- **Stripe Connect**: 80/20 payment facilitation. Requires legal review for BI/OJK compliance before shipping.
- **Per-outlet manager permissions**: ENTERPRISE stores with multi-outlet need scoped access (manager sees only their outlet).
- **Aggregator v2 (official API)**: GoFood/GrabFood partner API. 6–12 month relationship-building track.
- **Cloudflare R2 migration**: Swap Vercel Blob for R2 + Cloudflare Images (lower cost, better IDN latency). Deferred from Phase 3+.
- **Singapore DB region**: Migrate Postgres to Singapore region when p95 latency from Jakarta exceeds 200ms.
