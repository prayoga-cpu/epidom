# EPIDOM

**EPIDOM** is a free, all-in-one operating system for small Indonesian food & beverage businesses — warung, café, restaurant, cookie bar, home kitchen. The wedge is a customizable public storefront page (replaces Linktree + Google Drive menu + WhatsApp ordering). The ladder upsells to POS, operations (shift, KDS, inventory), and finance reports.

---

## Tech Stack

| Layer           | Technology                                             |
| --------------- | ------------------------------------------------------ |
| Framework       | Next.js 16 (App Router, Turbopack), React 19           |
| Language        | TypeScript 5                                           |
| Database        | PostgreSQL 16 + Prisma ORM 7 (pg driver adapter)       |
| Auth            | Better Auth (email/password + Google OAuth)            |
| Payments        | Stripe (SaaS billing) · Xendit (QRIS/GoPay/OVO/DANA)   |
| State           | TanStack Query v5                                      |
| UI              | shadcn/ui (New York) · Tailwind CSS 4 · Radix · Lucide |
| Theme           | next-themes · epi-navy dark tokens · epi-cream light   |
| i18n            | Custom provider — `id` primary, `en` secondary         |
| Email           | Resend                                                 |
| Storage         | Vercel Blob                                            |
| Background jobs | Inngest                                                |
| Hosting         | Vercel                                                 |

---

## Developer Setup

### Prerequisites

- Node.js 20 LTS
- pnpm ≥ 9
- PostgreSQL 14+ (local) **or** a Neon/Vercel Postgres database

### 1. Install

```bash
pnpm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in values. The two most critical for database:

```env
# Pooled endpoint — used by the app at runtime
DATABASE_URL="postgresql://user:pass@host-pooler.region.neon.tech/db?sslmode=require"
# Direct endpoint — used by Prisma CLI for migrations
DIRECT_URL="postgresql://user:pass@host.region.neon.tech/db?sslmode=require"
```

See `.env.example` for the complete reference.

### 3. Database

```bash
pnpm prisma migrate deploy   # apply all migrations
pnpm tsx seed-dummy.ts       # seed demo@epidom.com / password123
```

### 4. Run

```bash
pnpm dev        # Turbopack dev server → http://localhost:3000
pnpm build      # production build (runs migrate deploy first)
pnpm start      # serve production build
```

### 5. Other Scripts

```bash
pnpm type-check            # tsc --noEmit
pnpm lint                  # ESLint
pnpm test                  # Vitest (~340 tests)
pnpm prisma studio         # DB GUI
pnpm prisma migrate reset  # ⚠️ wipes local DB — dev only
```

---

## Project Structure

```
src/
├── app/
│   ├── (app)/             # Authenticated app surface
│   │   ├── (auth)/        # Login, register, password reset, onboarding
│   │   ├── admin/         # Admin panel (master accounts only)
│   │   ├── owner/         # Multi-outlet owner dashboard
│   │   ├── profile/       # User profile & subscription
│   │   ├── stores/        # Store selector
│   │   └── store/[storeId]/(dashboard)/
│   │       ├── dashboard/ # Stock overview, alerts, production chart
│   │       ├── data/      # Products · Materials · Recipes · Suppliers
│   │       ├── management/# Deliveries · Production · History · Stock
│   │       ├── tracking/  # Stock levels + Recent movements
│   │       ├── alerts/    # Low-stock & critical alerts
│   │       ├── storefront/# Storefront editor + analytics
│   │       ├── pos/       # POS cashier
│   │       ├── pos/orders/# Order queue
│   │       ├── pos/kds/   # Kitchen Display System
│   │       ├── pos/tables/# Table management + reservations
│   │       ├── staff/     # Staff management
│   │       ├── shifts/    # Shift management
│   │       └── finance/   # Finance reports
│   ├── (marketing)/       # Public marketing site
│   ├── (public)/          # Public storefronts /@slug
│   └── api/               # REST API routes
├── features/              # Feature modules (one folder per domain)
├── components/            # Shared UI (shadcn primitives, providers)
├── hooks/                 # Shared custom hooks
├── lib/                   # Auth, Prisma, services, validation, utils
├── locales/               # id.ts (primary) · en.ts
└── types/                 # TypeScript DTOs
```

---

## Product Overview

### Goal, in one layer per row

| Layer                      | Who it serves                      | The job it does                                                                    |
| -------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| **Storefront** (the wedge) | Any merchant, day 1                | Replace Linktree + a Google Drive PDF menu + WhatsApp ordering chaos with one link |
| **POS**                    | Merchants who serve in person      | Take the order, take the money, feed the kitchen — on the phone or tablet they own |
| **Operations**             | Merchants with staff and recipes   | Know the cost of a dish, who worked when, and what is about to run out             |
| **Finance / Enterprise**   | Multi-outlet brands, manufacturers | Consolidate margin across outlets and channels, and pay per channel honestly       |

Market priority: **France primary**, **Indonesia secondary**, worldwide via `en` + USD (see [docs/STRATEGY.md](docs/STRATEGY.md) §3). Money is stored and reasoned about in a base currency and rendered in any of **156 ISO-4217 currencies** through `useCurrency()`.

---

### Plans & pricing

| Plan           | Monthly              | Yearly (save 16%) | Trial                  | Who it is for                          | Upgrade trigger                                    |
| -------------- | -------------------- | ----------------- | ---------------------- | -------------------------------------- | -------------------------------------------------- |
| **FREE**       | Rp 0 / $0            | —                 | n/a, no card           | Solo warung, home baker, food truck    | Customers start asking to order online             |
| **POS**        | Rp 229,000 / $14.99  | $12.49/mo         | 14 days, card required | Café or warung with a cashier          | They hire a cashier and can't track orders by hand |
| **OPERATIONS** | Rp 459,000 / $29.99  | $24.99/mo         | 14 days, card required | Multi-staff café or restaurant         | Second shift hired; ingredient cost starts to hurt |
| **ENTERPRISE** | Custom, admin-quoted | Custom            | Sales-led              | Multi-outlet brand, small manufacturer | Second outlet opens; needs consolidated finance    |

- **IDR is the pricing base.** Every other display currency is derived live from it, not hardcoded — so all 156 currencies work, not a chosen few.
- **Trial** is a real Stripe `trial_period_days: 14` on POS and OPERATIONS checkout. `/pricing?trial=true#plans` auto-opens the POS trial confirm.
- **Enterprise pricing is an offer, not a catalog price.** An admin sets `Subscription.customPrice*`; the old subscription is canceled, access suspends (`customPricePendingAt`), and `requirePlan` routes the user to **Billing**, not `/pricing`, because `/pricing` cannot sell them the quoted price.
- **Beta / admin-granted accounts** (`admin_`/`free_`-prefixed Stripe customer ids) switch plans instantly with no payment method, via `POST /api/subscriptions/beta-plan`.

> ⚠️ `docs/BILLING.md` (Rp 99k/249k) and `STRIPE_CONFIG.PLAN_LIMITS` in [src/config/stripe.config.ts](src/config/stripe.config.ts) (EUR 29/79, "Starter"/"Pro") both predate a price rise. `PLAN_LIMITS` is **dead config — nothing reads it.** The live numbers are `PLAN_PRICE_IDR` + the `/pricing` copy.

#### How a plan is actually enforced — three independent layers

| Layer               | Where                                                                             | What it does                                                   |
| ------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Entitlement map** | [src/lib/plans/entitlements.ts](src/lib/plans/entitlements.ts) `FEATURE_MIN_PLAN` | The single source of truth: feature → minimum tier             |
| **Server gate**     | `requirePlan(storeId, "OPERATIONS")` in the page/layout                           | Redirects to the right upgrade URL before anything renders     |
| **Nav gate**        | [src/config/navigation.config.ts](src/config/navigation.config.ts) `requiredPlan` | Sidebar shows the item in a locked state rather than hiding it |

Public endpoints re-check the **owner's** plan (`api/public/orders`, `api/public/reservations`) so a stale `acceptsOrders` flag on a downgraded account can't leak a paid feature to customers.

---

### Feature catalog

**Status legend** — ✅ Live · 🔸 Live, opt-in (off by default behind a store/device toggle) · 🟡 Partial (narrower than the docs claim) · ⚪ Planned

#### Public storefront & customer ordering

| Feature                    | What it does                                                                                                                        | Goal                                                | Plan    | Status |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------- | ------ |
| Storefront page `/@slug`   | Logo, hero, theme colour, font, tagline, description, opening hours                                                                 | Give the merchant a shareable identity in 5 minutes | FREE    | ✅     |
| Link hub                   | Instagram, TikTok, WhatsApp, GoFood, GrabFood, ShopeeFood, Google Maps, arbitrary custom links                                      | Replace Linktree outright                           | FREE    | ✅     |
| Public menu `/[slug]/menu` | Categories, photos, prices, descriptions, modifiers, featured, sold-out toggle                                                      | Replace the Google Drive PDF                        | FREE    | ✅     |
| QR code download           | Printable asset pointing at the storefront                                                                                          | Table tents, packaging, shopfront stickers          | FREE    | ✅     |
| Storefront analytics       | `VIEW` / `MENU_VIEW` / `ITEM_VIEW` / `WHATSAPP_CLICK`, unique visitors, trend vs. previous period, top items by orders and by views | Prove day-1 value so the merchant keeps the link up | FREE    | ✅     |
| Direct ordering + tracking | Cart, checkout, dine-in/takeaway/delivery, `/[slug]/order/[orderId]`, order lookup, public receipt `/r/[orderId]`                   | Take the order without a WhatsApp thread            | **POS** | ✅     |
| Table reservations         | Public booking form → reservations dashboard                                                                                        | Stop losing bookings in DMs                         | **POS** | ✅     |

> Privacy note: analytics uses a **daily-rotating** `sha256(ip:userAgent:date:storefrontId)` fingerprint. No raw IP is stored and no cookie is set, so no consent banner is required — the trade-off is that "unique visitors" over a range is a sum of daily-uniques, not a lifetime-unique count.

> `docs/FEATURES.md` lists direct ordering and reservations as FREE-tier (Phase 2). **The code gates both at POS.** The code is the behaviour that ships.

#### Point of sale & service

| Feature                 | What it does                                                                                                                                                                                                        | Goal                                               | Plan | Status                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------- |
| Cashier                 | Item grid by category and department, cart, guest count, holds, notes                                                                                                                                               | Ring up an order faster than a notebook            | POS  | ✅                                                                                                                    |
| Checkout                | Discounts (% or fixed), service charge and tax presets, split/multi-tender, refunds, line edits                                                                                                                     | Handle the money exactly as the shop already does  | POS  | ✅                                                                                                                    |
| Payment methods         | CASH, QRIS, GOPAY, OVO, DANA, SHOPEEPAY, LINKAJA, BANK_TRANSFER, STRIPE_CARD, CHEQUE, TITRE_RESTAURANT, PAYPAL, APPLE_PAY, GOOGLE_PAY, PAY_LATER — bucketed by `PaymentMarket` (INDONESIA / FRANCE / INTERNATIONAL) | One POS for three markets                          | POS  | ✅                                                                                                                    |
| Pay Later (tabs)        | Serve now, settle after delivery                                                                                                                                                                                    | Warungs that run tabs for regulars                 | POS  | 🔸 `Store.payLaterEnabled`                                                                                            |
| Order queue             | Unified walk-in + online + aggregator queue over SSE; `CONFIRMED → IN_PRODUCTION → READY → DELIVERED`, plus `HELD` / `CANCELLED`                                                                                    | One screen that is always the truth                | POS  | ✅                                                                                                                    |
| Kitchen Display (KDS)   | Live tickets, Kitchen/Bar department routing, per-station settings                                                                                                                                                  | Stop shouting orders across the pass               | POS  | 🔸 `Store.kitchenDisplayEnabled` (on by default; off ⇒ paid orders go straight to DELIVERED, for counter-only stands) |
| Customer-facing display | Second screen at the counter showing the line just rung up, running receipt, total, and a thank-you on settle                                                                                                       | Let the customer verify the order as it is entered | POS  | 🔸 per-device toggle (`/pos/display`)                                                                                 |
| Receipts                | ESC/POS thermal (58 mm / 80 mm), PDF/print views, email receipt, WhatsApp receipt                                                                                                                                   | Every shop's receipt habit, unchanged              | POS  | ✅                                                                                                                    |
| Offline mode            | Orders queue locally and sync on reconnect; PWA + service worker                                                                                                                                                    | Indonesian tills lose the network constantly       | POS  | ✅                                                                                                                    |
| Tables                  | Zones, table states, assign/move orders, reservations dashboard                                                                                                                                                     | Dine-in floor control                              | POS  | ✅                                                                                                                    |
| Menu management         | The sellable list behind both the storefront and the cashier grid                                                                                                                                                   | One menu, two surfaces                             | POS  | ✅                                                                                                                    |
| Daily & shift reports   | Printable end-of-day and per-shift transaction reports                                                                                                                                                              | Close the day on paper, as the owner expects       | POS  | ✅                                                                                                                    |
| Web push                | Per-store push subscriptions for new-order alerts                                                                                                                                                                   | Alert the owner when the tab is closed             | POS  | ✅                                                                                                                    |

#### Operations — stock, recipes, people

| Feature                               | What it does                                                                                                                                                                                             | Goal                                                                                     | Plan                                         | Status                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| Data catalogue                        | Products, Materials, Recipes, Suppliers — CRUD, bulk actions, CSV export, SKU collision check, category management                                                                                       | The reference data everything else costs against                                         | OPERATIONS                                   | ✅                                                                       |
| AI Smart Import                       | Analyse a CSV/spreadsheet, propose a mapping, execute, and remember the merchant's corrections (`AIImportMemory`)                                                                                        | Onboard a real shop's messy spreadsheet in minutes                                       | OPERATIONS (POS for the onboarding CSV step) | ✅                                                                       |
| Two-tier stock                        | `Product.stockMode` — `BATCH_PRODUCED` draws a counted finished-goods balance; `MADE_TO_ORDER` explodes its recipe into raw materials on every sale; `UNTRACKED` does neither                            | A croissant and a latte are not the same inventory problem                               | OPERATIONS                                   | ✅                                                                       |
| Recipes & HPP/COGS                    | Recipe builder, ingredient quantities, automatic cost per dish, 30-day POS demand badge                                                                                                                  | Know the margin on the thing you just sold                                               | OPERATIONS                                   | ✅                                                                       |
| Automatic deduction                   | Stock is drawn on `order → DELIVERED` inside a serializable transaction                                                                                                                                  | Stock that matches reality without data entry                                            | OPERATIONS                                   | ✅                                                                       |
| Movements ledger                      | Polymorphic `StockMovement` across material and product: `PURCHASE`, `PRODUCTION_IN/OUT`, `SALE`, `ADJUSTMENT`, `WASTE`, `RETURN`, source-tagged with the POS order # or batch #                         | An audit trail for every unit                                                            | OPERATIONS                                   | ✅                                                                       |
| Waste & loss                          | `EXPIRED`, `DAMAGED`, `SPOILED`, `OVERPRODUCTION`, `QUALITY_CONTROL`, `OTHER`                                                                                                                            | The only way shrinkage gets expensed under sale-recognised COGS                          | OPERATIONS                                   | ✅                                                                       |
| Prep list & count sheet               | Suggests `minStock − currentStock` netted against outstanding shortfall debt; one-tap start/complete; a count sheet to reconcile                                                                         | Batch-produced stock only exists if somebody prepares it                                 | OPERATIONS                                   | ✅                                                                       |
| Production batches                    | Plan a run from a recipe, consume materials, produce finished goods; `MANUAL` or `ORDER_SHORTFALL` triggered; planned vs actual yield and cost per batch                                                 | For merchants who genuinely manufacture                                                  | OPERATIONS                                   | 🔸 `Store.productionEnabled` (off by default — most shops cook to order) |
| Alerts                                | `LOW_STOCK`, `CRITICAL_STOCK`, `ORDER_DUE`, `PRODUCTION_DUE`, `SYSTEM` at `INFO`/`WARNING`/`CRITICAL`, with a sidebar badge                                                                              | Catch a stockout before service does                                                     | OPERATIONS                                   | ✅                                                                       |
| Suppliers & purchase orders           | Supplier directory, per-material price tracking, orders `PENDING → PLACED → RECEIVED`, printable quote, DLC, send by WhatsApp/email; receipt updates stock                                               | Close the loop from "we're out" to "it arrived"                                          | OPERATIONS                                   | ✅                                                                       |
| Staff management                      | Invite by email, PIN login, role + optional custom label, per-page access override, `payType`/`payRate` for labour cost                                                                                  | Give people access without giving them the account                                       | OPERATIONS                                   | ✅                                                                       |
| Schedule (roster + attendance + till) | One page: shift blocks, draft→published rosters, clock in/out with **selfie + geolocation**, absences, hours & overtime against `standardWorkMinutesPerDay`, cash in/out, and a filterable Log & History | Rosters, attendance and the cash drawer were three pages telling three different stories | OPERATIONS                                   | ✅ (`/shifts` and `/attendance` redirect here)                           |
| Custom Products                       | An owner-named second product line (e.g. "Hair Salon") that skips KDS routing and recipe deduction, with independent "Show on Menu" / "Show on Cashier" switches                                         | Sell the thing that isn't food without Epidom building a vertical                        | OPERATIONS                                   | 🔸 `Store.customProductsEnabled`                                         |
| Stock integrity sweep                 | Nightly Inngest job reconciling balances                                                                                                                                                                 | Catch drift before the merchant does                                                     | OPERATIONS                                   | ✅                                                                       |

#### Finance & multi-outlet

| Feature                     | What it does                                                                                                                                          | Goal                                                  | Plan       | Status                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------- | --------------------------------------------------------- |
| P&L summary                 | Revenue, COGS, gross margin % over any date range, daily/weekly/monthly                                                                               | The number the owner actually wants                   | ENTERPRISE | ✅                                                        |
| Report cuts                 | By category, by department, by item margin, by payment method, by staff shift, by roster shift-block, by waste reason, cash reconciliation, top items | Find _where_ the margin went, not just that it went   | ENTERPRISE | ✅                                                        |
| Channel margin              | Per-channel revenue across `MANUAL`, `STOREFRONT`, `POS`, `GOFOOD`, `GRABFOOD`, `SHOPEEFOOD`, `TOKOPEDIA`, with commission and net                    | Aggregator commission is invisible until you price it | ENTERPRISE | ✅                                                        |
| Aggregator ingestion        | Inngest + OpenAI parse aggregator order emails into source-tagged orders (`AggregatorConnection`, `AggregatorEmail`)                                  | One queue instead of four tablets                     | ENTERPRISE | 🟡 email parsing (v1) live; direct partner APIs not built |
| Owner roll-up `/owner`      | All outlets under one business, consolidated                                                                                                          | Multi-outlet owners stop opening five dashboards      | ENTERPRISE | ✅                                                        |
| Export & print              | CSV / Excel export and a dedicated print view for every report                                                                                        | Accountants want a file, not a screenshot             | ENTERPRISE | ✅                                                        |
| Custom development requests | `NEW → IN_REVIEW → QUOTED → IN_PROGRESS → COMPLETED / DECLINED`, with admin triage                                                                    | Sell bespoke work without leaving the product         | ENTERPRISE | ✅                                                        |
| Customer analytics          | Repeat/behaviour analytics per store                                                                                                                  | Know who comes back                                   | ENTERPRISE | ✅                                                        |

#### Account, platform & cross-tier

| Feature                      | What it does                                                                                                                                                          | Plan                | Status                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| Auth                         | Better Auth — email/password + Google OAuth, email verification with resend, password reset; OAuth failures land on `/login` with a readable toast                    | All                 | ✅                                                                                                       |
| Guided onboarding            | 5 steps (business → logo → menu → theme → publish), AI-assisted profile analysis, menu suggestion, and logo generation; `hasOnboarded` makes the redirect server-side | All                 | ✅                                                                                                       |
| Multi-store                  | Store selector; multiple outlets under one `Business`                                                                                                                 | OPERATIONS          | ✅                                                                                                       |
| Profile & preferences        | Contact, business details, timezone (browser-detected, `timezoneUpdatedAt` records that it was really set), locale, currency, "resume where I left off"               | All                 | ✅                                                                                                       |
| Owner PIN                    | `Business.ownerPin` + OTP reset — how the real owner steps back out of a staff persona                                                                                | All                 | ✅                                                                                                       |
| Account deactivation         | Soft delete → 30-day self-service reactivation → up to 1 year support-quoted recovery → nightly purge job                                                             | All                 | ✅                                                                                                       |
| Billing surface              | Stripe Checkout + Customer Portal, plan switch, trial state, custom-price offers; Xendit handles **customer** payments and is kept in a separate module by rule       | All                 | ✅                                                                                                       |
| Stripe Connect               | Merchant onboarding, status and express dashboard links from Profile                                                                                                  | All                 | 🟡 plumbing live; the 80/20 revenue split is not switched on                                             |
| i18n                         | `id`, `en`, `fr` — code-split per locale (2.79.0); marketing renders its locale server-side for crawlers                                                              | All                 | ✅                                                                                                       |
| PWA + install prompt         | Service worker (cache-first static, network-first navigation, never intercepts `/api/`), topbar install button that hides when already installed                      | All                 | ✅                                                                                                       |
| Feedback & changelog         | In-app `BUG` / `FEATURE_SUGGESTION` / `GENERAL_FEEDBACK` with admin triage; in-app "what's new" from CHANGELOG                                                        | All                 | ✅                                                                                                       |
| Admin panel                  | Users & subscriptions, revenue, capacity, Neon platform usage, backup freshness, feedback and custom-dev triage, demo seeding                                         | Platform admin only | ✅                                                                                                       |
| Nightly backup               | Inngest database backup + a freshness check that alerts if it goes stale                                                                                              | Platform            | ✅                                                                                                       |
| Audit log                    | Recording of sensitive admin/owner actions                                                                                                                            | —                   | ⚪ Planned — designed in [docs/AUDIT_LOG_PLAN.md](docs/AUDIT_LOG_PLAN.md); **nothing is recorded today** |
| Custom domains / white-label | Own domain instead of `/@slug`; remove "Powered by Epidom"                                                                                                            | ENTERPRISE          | ⚪ Not built                                                                                             |

---

### Roles & access

Four **independent** authorities. They are not one ladder — a platform admin is not a store owner, and a staff persona is a _restriction layered on top of_ the owner's own session, not a separate login.

| Role                | How it is established                                                                                          | Scope                                           | Can reach                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Platform admin**  | `User.isAdmin`, or an address in `HARDCODED_ADMIN_EMAILS` ([src/lib/admin.ts](src/lib/admin.ts))               | The whole platform                              | `/admin` — users, subscriptions, revenue, capacity, platform usage, backups, feedback, custom-development, demo seed |
| **Account owner**   | The `User` that owns the `Business` → `Store`s. Any authenticated session with **no active staff PIN session** | Every store they own                            | Everything, including the three owner-only pages below                                                               |
| **Staff persona**   | A `StaffMember` row + verified PIN → a server-side `StaffSession` cookie on **this browser**                   | One store, and only the pages resolved for them | Their `allowedPages` override, or their role's default template                                                      |
| **Public customer** | Anonymous — no account, ever                                                                                   | One published storefront                        | `/@slug`, the menu, checkout, order tracking, the public receipt, and the reservation form                           |

#### Staff roles and their default page access

`StaffRole` has four values. The role sets a **default template**; the owner can then override any individual's access per page (`StaffMember.allowedPages`), and rename their title for display (`customRoleLabel`, e.g. "Assistant Manager") without changing what the role grants.

| Role        | Default pages                                                                                                                          | Intended job                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **OWNER**   | All staff pages                                                                                                                        | A `StaffMember` row that _is_ the owner — functionally unrestricted      |
| **MANAGER** | `/dashboard` `/storefront` `/pos` `/pos/orders` `/pos/kds` `/tables` `/menu` `/management` `/production` `/data` `/alerts` `/schedule` | Runs the floor and the stockroom; publishes rosters; corrects attendance |
| **CASHIER** | `/pos` `/pos/orders` `/tables` `/schedule`                                                                                             | Rings up orders, runs the till, clocks in                                |
| **KITCHEN** | `/pos/kds` `/schedule`                                                                                                                 | Works tickets and clocks in — nothing else                               |

**Never grantable to any staff persona:** `/profile`, `/billing`, `/staff`. These are enforced separately by `requireOwnerOnly` / `requireNoActiveStaffPersona`, not by the page checklist — so no override can hand a cashier the subscription or the staff roster. A blocked persona is redirected to the **first page they can actually see**, not to a fixed fallback that would just bounce them again.

#### Where each gate lives

| Gate                       | File                                                                                   | Answers                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `requirePlan`              | [src/lib/auth/require-plan.ts](src/lib/auth/require-plan.ts)                           | Does this account's tier include this surface?                              |
| `requireStaffPageAccess`   | [src/lib/auth/require-staff-page-access.ts](src/lib/auth/require-staff-page-access.ts) | Is this page in this persona's resolved page list?                          |
| `requireOwnerOnly`         | [src/lib/auth/require-owner-only.ts](src/lib/auth/require-owner-only.ts)               | Is this the real owner, with no staff persona active?                       |
| `requireManagerOrOwnerApi` | [src/lib/auth/require-manager-or-owner.ts](src/lib/auth/require-manager-or-owner.ts)   | Roster publishing, attendance corrections, overtime threshold, KDS settings |
| `verifyStoreOwnership`     | [src/lib/utils/store-verification.ts](src/lib/utils/store-verification.ts)             | Does this `storeId` belong to this user at all?                             |

Order matters: a chrome-free route outside the `(dashboard)` group applies them itself — `getSession` → `verifyStoreOwnership` → `requirePlan` → `requireStaffPageAccess`.

#### Role → feature matrix

✅ full · 🔹 own records only · ⚙️ default-off, owner enables · — no access

The matrix covers **role-granted access inside the app**. The public storefront is open to anyone with the link, by design — that is the wedge.

| Surface                                                                | Platform admin | Owner | Manager | Cashier | Kitchen |     Customer      |
| ---------------------------------------------------------------------- | :------------: | :---: | :-----: | :-----: | :-----: | :---------------: |
| Storefront editor & analytics                                          |       —        |  ✅   |   ✅    |    —    |    —    |         —         |
| Public storefront, checkout, order tracking, receipt, reservation form |       —        |   —   |    —    |    —    |    —    |        ✅         |
| POS cashier & checkout                                                 |       —        |  ✅   |   ✅    |   ✅    |    —    |         —         |
| Order queue                                                            |       —        |  ✅   |   ✅    |   ✅    |    —    |         —         |
| KDS                                                                    |       —        |  ✅   |   ✅    |    —    |   ✅    |         —         |
| Tables & reservations                                                  |       —        |  ✅   |   ✅    |   ✅    |    —    | booking form only |
| Menu editing                                                           |       —        |  ✅   |   ✅    |    —    |    —    |         —         |
| Data (products, materials, recipes, suppliers)                         |       —        |  ✅   |   ✅    |    —    |    —    |         —         |
| Management & stock movements                                           |       —        |  ✅   |   ✅    |    —    |    —    |         —         |
| Production batches                                                     |       —        |  ⚙️   |   ⚙️    |    —    |    —    |         —         |
| Alerts                                                                 |       —        |  ✅   |   ✅    |    —    |    —    |         —         |
| Schedule — roster setup & publish                                      |       —        |  ✅   |   ✅    |    —    |    —    |         —         |
| Schedule — own shifts, clock in/out                                    |       —        |  ✅   |   ✅    |   ✅    |   ✅    |         —         |
| Cash in / out                                                          |       —        |  ✅   |   ✅    |   ✅    |    —    |         —         |
| Attendance corrections, overtime threshold                             |       —        |  ✅   |   ✅    |    —    |    —    |         —         |
| Staff management                                                       |       —        |  ✅   |    —    |    —    |    —    |         —         |
| Finance reports                                                        |       —        |  ✅   |    —    |    —    |    —    |         —         |
| Owner roll-up `/owner`                                                 |       —        |  ✅   |    —    |    —    |    —    |         —         |
| Billing & subscription                                                 |       —        |  ✅   |    —    |    —    |    —    |         —         |
| Account profile                                                        |       —        |  ✅   |   🔹    |   🔹    |   🔹    |         —         |
| Admin panel                                                            |       ✅       |   —   |    —    |    —    |    —    |         —         |

---

### Owner-only store toggles

Independent of the subscription tier — the plan sets the ceiling, these set the intent. Both must be true for the workflow to appear.

| Toggle                           | Default | Effect when off                                                                              |
| -------------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `kitchenDisplayEnabled`          | **on**  | Paid orders skip the kitchen stages and go straight to `DELIVERED` — for counter-only stands |
| `productionEnabled`              | off     | `/production` shows an explainer instead of the batch workflow                               |
| `customProductsEnabled`          | off     | The Data page's Custom Products tab shows a "name it and enable" form                        |
| `customProductsShowOnStorefront` | off     | The custom line reaches the cashier but not the public menu                                  |
| `payLaterEnabled`                | off     | `PAY_LATER` is not offered at checkout                                                       |
| `syncFinanceWithBusiness`        | off     | The store keeps its own fees/taxes rather than inheriting the business-wide config           |
| `standardWorkMinutesPerDay`      | 480     | Daily minutes beyond this count as overtime                                                  |

---

### Known gaps — documented but not shipped

Recorded here so they are not mistaken for working behaviour.

| Claim                                                                                                          | Reality                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-tier resource limits (50 menu items, 200 orders/mo, storage and notification quotas) in `docs/FEATURES.md` | **Not enforced anywhere.** `STRIPE_CONFIG.PLAN_LIMITS` has no readers; no quota check exists in any route                                                     |
| "WhatsApp notifications", "WhatsApp receipt", "low-stock alerts via WhatsApp"                                  | Every WhatsApp path is a **`wa.me` deep link the user taps** — there is no automated Business API. Merchant new-order alerts go out through MagicBell + email |
| Direct ordering and reservations on FREE                                                                       | Gated at **POS** in code                                                                                                                                      |
| Aggregator dashboard                                                                                           | Email parsing (v1) only; no direct GoFood/GrabFood/ShopeeFood API integration                                                                                 |
| Audit logs on sensitive operations                                                                             | Planned only — see [docs/AUDIT_LOG_PLAN.md](docs/AUDIT_LOG_PLAN.md)                                                                                           |
| Stripe Connect 80/20 revenue split                                                                             | Onboarding and status plumbing exist; the split is not switched on and needs legal review                                                                     |
| Custom domains, white-label                                                                                    | Not built                                                                                                                                                     |

**Source-of-truth files**, when this section and the code disagree — the code wins:

- Tier → feature: [src/lib/plans/entitlements.ts](src/lib/plans/entitlements.ts)
- Nav → required plan: [src/config/navigation.config.ts](src/config/navigation.config.ts)
- Role → default pages: [src/config/staff-permissions.config.ts](src/config/staff-permissions.config.ts)
- Live prices: `PLAN_PRICE_IDR` in [src/lib/utils/subscription-helpers.ts](src/lib/utils/subscription-helpers.ts) and the `/pricing` copy in [src/locales/en.ts](src/locales/en.ts)
- Roles, statuses, enums: [prisma/schema.prisma](prisma/schema.prisma)

---

## Database Schema (key relationships)

```
User → Business → Store → Storefront → MenuItem → MenuCategory
                         → Product ← RecipeProduct → Recipe → RecipeIngredient → Material
                         → Order → OrderItem
                         → StockMovement
                         → ProductionBatch
                         → Staff · Shift · Table · Reservation
                         → Alert · Subscription
```

All queries scope to `storeId`. Money uses `Prisma.Decimal` (never Float).

---

## Key Patterns

- **API handler** — `withApiHandler()` in `src/lib/api-handler.ts` — auth, rate-limiting, store ownership, error serialization
- **Plan gating** — `requirePlan(storeId, "OPERATIONS")` in layout; sidebar shows locked state gracefully
- **Currency** — `CurrencyProvider` shares React Query cache with `useProfile`; `formatPrice()` auto-converts; propagates instantly on profile update
- **i18n** — `useI18n()` everywhere; `id.ts` primary, `en.ts` secondary

---

## Deployment (Vercel)

1. Add `DATABASE_URL` + `DIRECT_URL` (Neon pooled vs direct endpoints) in Vercel env vars
2. `pnpm build` runs `prisma migrate deploy && next build` automatically
3. Service worker at `/public/sw.js` — cache-first static, network-first navigation, never intercepts `/api/`
