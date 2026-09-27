# Features

What Epidom offers, organized by subscription tier. Aligned with `/docs/STRATEGY.md` section 6 and `/docs/roadmap.md`.

If you add a feature, update this doc in the same PR. If a feature is in development, mark it with the phase it lands in.

---

## Tier overview

| Tier           | Price (IDR/mo) | Who it's for                                          | Phase delivered |
| -------------- | -------------- | ----------------------------------------------------- | --------------- |
| **FREE**       | Rp 0           | Any merchant who wants a public storefront            | Phase 1-2       |
| **POS**        | Rp 229,000     | Merchant with a cashier and >50 orders/day            | Phase 3         |
| **OPERATIONS** | Rp 459,000     | Multi-staff café or restaurant, up to 3 outlets       | Phase 4-5       |
| **ENTERPRISE** | Custom         | A group of 4+ outlets, or a custom build with us      | Service tier    |

Each tier includes everything in the tier below. The upgrade always preserves data.

Since 2026-09-26, ENTERPRISE is a consultation / custom-build service, not a feature tier: no self-serve feature is gated to it. Finance and the All outlets roll-up moved to OPERATIONS, and Custom Development requests opened to every paid plan. See the decision log at the end.

Since 2026-09-27, outlets are capped per plan: FREE 1, POS 1, OPERATIONS up to 3, ENTERPRISE unlimited. A 4th outlet needs ENTERPRISE, which stays sales-led. See Multi-outlet management below.

---

## FREE tier

The wedge. Forever free. Replaces Linktree + Google Drive menu + WhatsApp ordering.

### Public storefront _(Phase 1)_

- Branded landing page at `epidom.fr/@your-slug`
- Logo and theme color customization
- Hero image
- Business name, tagline, description
- Opening hours display
- Social links: Instagram, TikTok, WhatsApp
- Outbound links: GoFood, GrabFood, ShopeeFood, Google Maps
- Google Reviews: a "Review us on Google" button on the storefront and on a delivered order's page, a printable review QR, and a Maps link derived automatically from the connected Place ID. Deep link into Google's own review form (no API can post a review for a customer), so Epidom counts taps, not completed reviews
- Custom link buttons (Linktree-style)
- QR code download for printable assets

### Menu listing _(Phase 1)_

- Unlimited menu categories
- Up to 50 menu items on FREE tier
- Item photos, names, prices, descriptions
- "Sold out" toggle per item
- Featured items
- Modifier options (size, spice level, add-ons)

### Direct ordering _(Phase 2)_

- Customer cart and checkout
- Dine-in (with table number), takeaway, or self-delivery
- Customer phone number capture
- Order notes

### Indonesian payments _(Phase 2)_

- QRIS payment integration
- GoPay, OVO, DANA, ShopeePay
- Bank transfer
- Cash (mark as paid manually)

### Notifications _(Phase 2)_

- WhatsApp notification to merchant on new order
- Real-time dashboard updates via SSE
- WhatsApp order confirmation to customer

### Basic analytics _(Phase 2)_

- Storefront view count (unique visitors, date-range driven, with trend vs. previous period)
- Menu views and item views
- WhatsApp chat-click conversion rate
- Total orders today / this week / this month, storefront-attributed revenue
- Top 5 menu items by orders, top 5 by views

### Free tier limits

| Resource               | Limit     |
| ---------------------- | --------- |
| Storefronts            | 1         |
| Menu items             | 50        |
| Orders per month       | 200       |
| Storage (images)       | 500 MB    |
| WhatsApp notifications | 100/month |

Hitting any of these prompts an upgrade to POS tier.

---

## POS tier (Rp 229,000/mo)

For merchants who run service in-person. Everything in FREE, plus:

### Cashier mode _(Phase 3)_

- Tablet and phone optimized POS
- Quick-add items by category or search
- Apply discounts (percentage or fixed)
- Service charge and tax presets
- Multiple payment methods per order (split tender)
- Order modifications and refunds

### Receipts _(Phase 3)_

- Bluetooth thermal printer support (58mm, 80mm)
- Multiple printers per till, each paired on its own: receipt (main), kitchen and bar order tickets (items and quantities, no prices, routed by the item's Kitchen/Bar area), and item labels (ESC/POS or TSPL)
- ESC/POS commands
- PDF receipt fallback
- Email receipt to customer
- WhatsApp receipt to customer

### Order queue _(Phase 3)_

- Unified queue: walk-in + online orders
- Status flow: New → Preparing → Ready → Served
- Per-order timer
- Quick mark-ready actions

### Basic Kitchen Display _(Phase 3)_

- Order tickets in real-time
- Item-level status (preparing, ready)
- Audio alert on new order
- Configurable for one screen

### Table management _(Phase 3)_

- Define your tables and zones
- Assign orders to tables
- Table state: empty, seated, ordered, billed
- Move and merge tables

### Offline mode _(Phase 3)_

- POS continues working without internet
- Orders queue locally and sync on reconnect
- Conflict resolution on sync

### Custom Development requests

- Describe a custom build from `/custom-development`; requests reach the Prionation team by email and the admin triage page
- Open to every paid plan (POS and up). It is how an ENTERPRISE engagement starts

### POS tier limits

| Resource               | Limit       |
| ---------------------- | ----------- |
| Storefronts            | 1           |
| Menu items             | 500         |
| Orders per month       | Unlimited   |
| Storage                | 5 GB        |
| WhatsApp notifications | 1,000/month |
| POS terminals          | 2           |

---

## OPERATIONS tier (Rp 459,000/mo)

For merchants with staff, ingredient cost concerns, or a second or third outlet. Everything in POS, plus:

### Shift management _(Phase 4)_

- Clock-in / clock-out with PIN
- Opening and closing cash counts
- Cash drawer reconciliation
- **Cash on hand** — the expected balance in the register, broken down by category (opening float, cash sales, refunds paid out, tips, cash in, paid-outs, safe drops, tips reversed). Computed live rather than only at close, so a mid-shift report shows the current position (labelled provisional) instead of just the opening float. A date-ranged report gives the store-wide figure across every till, including counter cash tied to none of them
- **Cash In / Out at the till** — record a tip, float top-up, supplier paid in cash, or safe drop; outbound movements require a reason, and every one lands on the staff log and in the drawer maths immediately
- Discrepancy alerts
- Shift handover notes
- Staff roster/scheduling, selfie + geolocation attendance, and till cash reconciliation are unified on one page (`/schedule`, merged 2026-08-07 — `/shifts` and `/attendance` now redirect here): managers get roster setup/publish plus a filterable Log & History (clock events and cash in/out on one timeline); staff get their own upcoming shifts with Clock In/Out and (Cashier/Owner/Manager) Cash In/Out actions, and their own history. Automatic overtime calculation — see `docs/roadmap.md`

### Staff and roles _(Phase 4)_

- Add staff members with roles (Manager, Cashier, Kitchen, Waiter)
- Per-role permissions
- Hours tracking per shift
- End-of-day transaction reports per named shift-block (Finance → By Shift Block) and per staff member (existing `/finance/by-shift?staffId=`) — see `docs/roadmap.md`

### Full Kitchen Display _(Phase 4)_

- Multiple KDS screens (prep, line, expo)
- Item routing by station
- Course pacing
- Bump-bar friendly

### Inventory and recipes _(Phase 4)_

- Ingredient (material) catalog
- Recipe builder with ingredient quantities
- Automatic HPP (cost per dish) calculation
- Auto stock deduction on order completion
- Low stock alerts via WhatsApp
- Stock movement audit trail

### Supplier management _(Phase 4)_

- Supplier directory with contact info
- Material-supplier price tracking
- Manual supplier order creation
- Order receipt updates stock

### Multi-outlet management _(Phase 5)_

- Multiple stores under one business: up to 3 outlets on OPERATIONS, unlimited on ENTERPRISE (FREE and POS are capped at one store). Source of truth: `PLAN_MAX_STORES` and `minPlanForStores(count)` in `src/lib/plans/entitlements.ts`, read by `getStoreLimit` / `canCreateStore` in `src/config/stripe.config.ts`
- The limit is checked when a store is created (under a row lock) and when a store ownership transfer is accepted: a recipient already at their limit is refused with `SUBSCRIPTION_LIMIT_EXCEEDED` and `details.requiredPlan`, and the invite stays usable. Transferred stores are no longer grandfathered past the limit (2026-09-27)
- A downgrade never removes or locks a store. A business above its new plan's limit keeps every store working but cannot create or receive another; the Billing page shows "Over your plan's limit" and which plan allows more stores
- Per-outlet permissions for managers
- Not built yet: centralized menu management with per-outlet overrides, cross-outlet inventory transfers

### Finance reports _(Phase 5; OPERATIONS since 2026-09-26)_

- Daily, weekly, monthly P&L
- Revenue, COGS, gross margin, item margin
- Per-channel and per-payment-method breakdowns
- By shift, by roster shift-block, waste by reason
- Per-shift cash reconciliation
- **All outlets** scope: a "This outlet / All outlets" switch in the Finance header, shown only to the business owner (not staff personas) when the business has more than one store. Shows revenue, gross profit and margin, waste loss, net profit, outlet count and orders awaiting payment, plus a sortable By outlet table with a totals row and a link into each outlet's own report for the same dates. Each outlet uses the same calculation as its single-outlet report (net profit subtracts refunds, tax, processing fees, COGS and waste). Outlets in different currencies are shown in their own currency and never added together. Replaces the separate Owner dashboard: `/store/{id}/owner` now redirects to `/finance?scope=all`
- PDF and Excel export (the All outlets view exports Excel)
- Customizable date ranges
- Enforced server-side too: the Finance report routes check the store owner's plan (`requireStoreFeatureApi(storeId, "finance")`). Top items, by department and finance settings stay open, because the main dashboard, storefront editor and POS use them on every plan

### Aggregator channels _(Phase 5)_

- Per-channel revenue, commission and net margin are Finance tabs (OPERATIONS)
- Ingestion itself is **not plan-gated**: email parsing (v1, `src/app/api/webhooks/email/route.ts`) matches any storefront slug, and the source-tagged orders (GoFood, GrabFood, ShopeeFood, direct) land in the same order queue as every other order, on every plan
- Direct API integrations (v2, partner-dependent, not built)

### Production batches _(Phase 5)_

- Resurrected from the original schema for small manufacturers
- Off by default per store (`Store.productionEnabled`); the plan sets the ceiling, the toggle the intent
- Plan production runs
- Track planned vs actual yield
- Cost per batch

### Custom Products — optional second product line _(Phase 5+, optional)_

- Off by default, per-store; the owner names it (e.g. "Hair Salon", "Spa Services") when enabling it from a new tab on the Data page
- For a product or service unrelated to the store's Kitchen/Bar menu — e.g. a café that also runs a small hair-salon counter — without Epidom building anything vertical-specific
- Skips the Kitchen/Bar KDS workflow and material stock/recipe deduction entirely
- Each item has two independent visibility switches — "Show on Menu" (the public Storefront) and "Show on Cashier" (the POS Cashier sell grid) — instead of the single shared toggle regular menu items use
- Revenue rolls into the same integrated Finance Reports as every other sale

### Operations tier limits

| Resource               | Limit                      |
| ---------------------- | -------------------------- |
| Storefronts            | Up to 3 (one per outlet)   |
| Outlets                | Up to 3                    |
| Menu items             | Unlimited                  |
| Orders per month       | Unlimited                  |
| Storage                | 25 GB                      |
| WhatsApp notifications | 5,000/month                |
| POS terminals          | 5                          |
| Staff accounts         | 15                         |

A 4th outlet needs ENTERPRISE (since 2026-09-27; before that, one Operations subscription covered unlimited outlets). Prices are unchanged. Whether to publish an ENTERPRISE "from" price for that step is an open decision, not implemented.

---

## ENTERPRISE tier (custom pricing)

Unlimited outlets plus a consultation and custom-build service; no self-serve feature is gated to it. Sales-led: "Talk to us" (WhatsApp) on `/pricing`, priced per engagement. Everything in OPERATIONS, plus:

### Unlimited outlets

- 4 or more outlets under one business (OPERATIONS stops at 3)

### Your own system, built with us

- Your own internal system or website, scoped and built with the Prionation team (the company behind Epidom; `/build-with-us` is its public custom-build page)
- Built and hosted on Prionation infrastructure
- Custom integrations (accounting, delivery apps, payments)
- Priority support, onboarding and data migration
- A dedicated account manager
- Custom SLAs

The way in is a Custom Development request (any paid plan) or a WhatsApp conversation. The items below are custom-build work of this kind, not self-serve switches.

### Stripe Connect 80/20 _(Phase 5+, optional)_

- Accept payments through Epidom's Stripe Connect account
- 80% to merchant, 20% to Epidom
- For merchants who want a single financial relationship
- Requires legal review for Indonesian payment regulations

### Custom domains _(Phase 5+)_

- Use your own domain instead of `epidom.fr/@slug`
- TLS certificates auto-provisioned

### White-label option _(Phase 5+)_

- Remove "Powered by Epidom" footer
- Custom email sender domain
- Custom WhatsApp business profile

### Enterprise tier limits

Starting defaults; an engagement can set its own terms.

| Resource               | Limit                                     |
| ---------------------- | ----------------------------------------- |
| Storefronts            | Unlimited (one per outlet)                |
| Outlets                | Unlimited (4 and up)                      |
| Menu items             | Unlimited                                 |
| Orders                 | Unlimited                                 |
| Storage                | 250 GB                                    |
| WhatsApp notifications | 25,000/month                              |
| POS terminals          | Unlimited                                 |
| Staff accounts         | Unlimited                                 |
| Support                | Priority WhatsApp, email, scheduled calls |

---

## Cross-tier features

These ship across all tiers, from FREE upward.

### Internationalization _(always)_

- Bahasa Indonesia (`id`), primary
- English (`en`), secondary
- French (`fr`), frozen — legacy only

### Mobile-first design _(always)_

- All surfaces designed for phones first
- Tablet-optimized POS in Phase 3+
- No desktop-only flows

### Security _(always)_

- Better Auth session management
- Email/password and Google OAuth
- HMAC-signed cookies
- Per-tenant data isolation
- Audit logs on sensitive operations

### Help and onboarding _(always)_

- In-app guided tour for first session
- WhatsApp support channel
- Video tutorials in Bahasa Indonesia

---

## Deprecated and archived features

These existed in the original codebase. They are not deleted — they're paused or archived.

| Feature                         | Status                                | Future                                             |
| ------------------------------- | ------------------------------------- | -------------------------------------------------- |
| Cookie-bar-specific copy        | Removed in Phase 0                    | Will not return                                    |
| Stripe Connect 80/20 (original) | Paused                                | Returns in Phase 5+ ENTERPRISE tier, pending legal |
| French market positioning       | Paused                                | Re-evaluate after 5,000 paying IDN merchants       |
| Production batch UI             | Hidden behind feature flag in Phase 0 | Back on OPERATIONS, opt-in per store               |
| AI CSV import for inventory     | Code retained, UI hidden              | Returns in Phase 4 OPERATIONS tier                 |
| Maps (Leaflet, MapLibre)        | Removed in Phase 0                    | Not returning unless a clear use case emerges      |

---

## Feature decision log

Decisions about what to ship, when, and why. Append-only.

### 2026-05, Phase 0 cleanup

- Renamed plans from `STARTER / PRO / ENTERPRISE` to `FREE / POS / OPERATIONS / ENTERPRISE` to reflect tier wedge strategy
- Paused all French market features
- Archived cookie-bar copy
- Hidden production / inventory / alerts behind feature flag, to be re-exposed in Phase 4

### 2026-08-14, two-tier stock (2.70.0)

**Shipped.** `Product.stockMode` (`BATCH_PRODUCED | MADE_TO_ORDER | UNTRACKED`) decides what a sale consumes. Batch-produced items draw a counted finished-goods balance and stop there; made-to-order items explode their primary recipe into raw materials on every sale. See STATUS.md for the defect this fixed.

**Hybrid IS supported**, via `ProductOption.materialId` / `materialQty`: a batch-prepped base plus per-order finishing ingredients is a `BATCH_PRODUCED` product whose finishing ingredients are an option group. Zero new tables, and it already worked — it just never fired, because sale-time material deduction was dead.

**Explicit non-goals** — recorded so they are not re-litigated:

- **Multi-level BOM / semi-finished goods** (a recipe consuming another recipe's output, e.g. a sauce base). Refused on four hard grounds: `RecipeIngredient.materialId` is a required FK to `Material` with a `@@unique([recipeId, materialId])`, so a polymorphic version needs a nullable pair, a CHECK, two partial unique indexes and branching in every consumer that assumes `ing.material`; a `Material` can never be *produced* (`completeProduction` only ever writes `Product`); a `Product` force-publishes itself to the POS grid and public menu via `autoLinkProductToMenu`, so an internal sauce base needs a new "not for sale" concept; and it closes a cost cycle needing a topological rollup with link-time cycle detection, on top of a unit-conversion layer that is currently a silent no-op across dimensions. If it is ever picked up, the shape is `componentProductId` + `Product.isInternal` + "explosion terminates at a counted balance" — the deduction algorithm is already written to accommodate that.
- **A separate `finished_goods_stock` table** (as the client spec proposed). `Product.currentStock` already is it, `StockMovement` is already polymorphic across material and product, and `stock-item.helpers.ts` is already the shared abstraction. What the spec actually wanted was *visibility*, which is delivered as a view.
- **Blocking a sale on stock.** A blocking modal on an iPad with six people queueing is a lie — the croissant is physically on the counter. It would be worked around by the end of the first shift, and the number being checked is stale by construction because deduction is deferred to DELIVERED.
- **Coupling the public storefront to inventory** — AGENTS.md §7.4 is a hard rule.
- Per-lot / expiry tracking, offline stock validation, demand-forecast par levels, aggregator-order product linkage, refund-driven COGS reversal.
- **Widening stock quantities to `Decimal(14,6)`.** Deferred, not refused. `scripts/report-below-precision-ingredients.ts` returns clean on live-shaped data — no ingredient's per-unit requirement currently rounds away at `Decimal(10,3)`. It becomes real when a merchant stocks something in a unit far coarser than a recipe uses it (0.4 g of saffron against kg-tracked stock). When it does: run it as a **standalone migration outside the build path**, because `prisma migrate deploy` executes as the first step of `pnpm build` while the previous deployment still serves traffic, and retyping `stock_movements` is a full table rewrite.

### 2026-08-16, prep list and count sheet (2.71.0)

The operational half of two-tier stock. Batch-produced items only stay in stock if somebody prepares them, so the model needs a low-friction way to log prep and a way to reconcile the count.

- **Today's prep** suggests `minStock − currentStock`, netted against outstanding drawn-shortfall debt.
- **One-tap logging** runs the whole start/complete cycle in one transaction, settlement-aware on both the materials and the finished-goods side.
- **The count sheet** is the only mechanism that expenses finished-goods shrinkage under a sale-recognised COGS model. Anything produced and then binned is otherwise never costed.

### 2026-09-26, Finance to OPERATIONS; ENTERPRISE becomes a service tier

- **Finance moved from ENTERPRISE to OPERATIONS** (`FEATURE_MIN_PLAN.finance`). Operations already sells the recipe/COGS engine and unlimited outlets (capped at 3 on 2026-09-27, see below); Finance is where both pay off, and it sat behind a tier nobody could buy self-serve.
- **The Owner dashboard merged into Finance** as the owner-only All outlets scope. One date range and one set of definitions: the roll-up now runs the exact per-store calculation the single-outlet report uses (the old roll-up's net profit skipped refunds, tax and processing fees). Mixed currencies are shown per outlet, never summed. The store switcher stays a separate control (pick one store vs. compare them all).
- **Custom Development opened to every paid plan** (`FEATURE_MIN_PLAN.customDevelopment = "POS"`). Gating it behind ENTERPRISE meant only people who already had an engagement could ask for one.
- **ENTERPRISE is now consultation / custom build** with the Prionation team, custom-priced. No self-serve feature is gated to it.
- Prices unchanged. Per-outlet pricing for OPERATIONS is open, not decided (answered 2026-09-27 by the outlet cap, see below).

### 2026-09-27, outlet limits per plan

- **Outlets are capped per plan** (`PLAN_MAX_STORES`): FREE 1, POS 1, OPERATIONS up to 3, ENTERPRISE unlimited. `minPlanForStores(count)` names the lowest plan for a store count. Store creation checks the limit under a row lock in `createStore` (`business.service.ts`).
- **A 4th outlet needs ENTERPRISE**, which stays sales-led ("Talk to us" on WhatsApp, custom price).
- **Accepting a store ownership transfer checks the recipient's limit** (`acceptStoreTransfer` in `store-transfer.service.ts`). It is refused with `SUBSCRIPTION_LIMIT_EXCEEDED` and `details.requiredPlan`, inside the transaction, so the invite is not consumed. Before, transferred stores were grandfathered past the limit.
- **Downgrades never remove or lock stores**, whatever the path (Stripe portal / webhook, cancel then activate Free, admin set-plan, beta switch). A business above its new plan's limit keeps every store working but cannot create or receive another. No schema change.
- Prices unchanged. The cap answers the per-outlet pricing question for OPERATIONS. Still open: whether to publish an ENTERPRISE "from" price. Competitors sell the 4th outlet online, and sales-led tiers usually start at 10+ outlets.

### Future decisions to log here

- When AI menu suggestions launches (target: Phase 1)
- When inventory returns visibly to merchants (target: Phase 4)
- When white-label or custom domains ships
- Any pricing changes
