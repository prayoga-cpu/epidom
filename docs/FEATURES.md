# Features

What Epidom offers, organized by subscription tier. Aligned with `/docs/STRATEGY.md` section 6 and `/docs/roadmap.md`.

If you add a feature, update this doc in the same PR. If a feature is in development, mark it with the phase it lands in.

---

## Tier overview

| Tier           | Price (IDR/mo) | Who it's for                               | Phase delivered |
| -------------- | -------------- | ------------------------------------------ | --------------- |
| **FREE**       | Rp 0           | Any merchant who wants a public storefront | Phase 1-2       |
| **POS**        | Rp 99,000      | Merchant with a cashier and >50 orders/day | Phase 3         |
| **OPERATIONS** | Rp 249,000     | Multi-staff café or restaurant             | Phase 4         |
| **ENTERPRISE** | Rp 499,000+    | Multi-outlet brand, small manufacturer     | Phase 5         |

Each tier includes everything in the tier below. The upgrade always preserves data.

---

## FREE tier

The wedge. Forever free. Replaces Linktree + Google Drive menu + WhatsApp ordering.

### Public storefront _(Phase 1)_

- Branded landing page at `epidom.id/@your-slug`
- Logo and theme color customization
- Hero image
- Business name, tagline, description
- Opening hours display
- Social links: Instagram, TikTok, WhatsApp
- Outbound links: GoFood, GrabFood, ShopeeFood, Google Maps
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

- Storefront view count
- Total orders today / this week / this month
- Top 5 menu items by orders

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

## POS tier (Rp 99,000/mo)

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

## OPERATIONS tier (Rp 249,000/mo)

For merchants with staff and ingredient cost concerns. Everything in POS, plus:

### Shift management _(Phase 4)_

- Clock-in / clock-out with PIN
- Opening and closing cash counts
- Cash drawer reconciliation
- Discrepancy alerts
- Shift handover notes

### Staff and roles _(Phase 4)_

- Add staff members with roles (Manager, Cashier, Kitchen, Waiter)
- Per-role permissions
- Hours tracking per shift

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

### Operations tier limits

| Resource               | Limit       |
| ---------------------- | ----------- |
| Storefronts            | 1           |
| Menu items             | Unlimited   |
| Orders per month       | Unlimited   |
| Storage                | 25 GB       |
| WhatsApp notifications | 5,000/month |
| POS terminals          | 5           |
| Staff accounts         | 15          |

---

## ENTERPRISE tier (Rp 499,000+/mo)

For multi-outlet brands and small manufacturers. Everything in OPERATIONS, plus:

### Multi-outlet management _(Phase 5)_

- Multiple stores under one business
- Centralized menu management with per-outlet overrides
- Per-outlet permissions for managers
- Cross-outlet inventory transfers

### Aggregator dashboard _(Phase 5)_

- Unified order queue across GoFood, GrabFood, ShopeeFood, direct
- Per-channel revenue tracking
- Commission and net margin per channel
- Source-tagged orders for reporting
- Email parsing ingestion (v1)
- Direct API integrations (v2, partner-dependent)

### Finance reports _(Phase 5)_

- Daily, weekly, monthly P&L
- Revenue, COGS, gross margin
- Per-channel profitability
- Per-outlet rollup
- Per-shift cash reconciliation
- PDF and Excel export
- Customizable date ranges

### Production batches _(Phase 5)_

- Resurrected from the original schema for small manufacturers
- Plan production runs
- Track planned vs actual yield
- Cost per batch

### Stripe Connect 80/20 _(Phase 5+, optional)_

- Accept payments through Epidom's Stripe Connect account
- 80% to merchant, 20% to Epidom
- For merchants who want a single financial relationship
- Requires legal review for Indonesian payment regulations

### Custom domains _(Phase 5+)_

- Use your own domain instead of `epidom.id/@slug`
- TLS certificates auto-provisioned

### White-label option _(Phase 5+)_

- Remove "Powered by Epidom" footer
- Custom email sender domain
- Custom WhatsApp business profile

### Enterprise tier limits

| Resource               | Limit                                     |
| ---------------------- | ----------------------------------------- |
| Storefronts            | Unlimited (one per outlet)                |
| Outlets                | Unlimited                                 |
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
| Production batch UI             | Hidden behind feature flag in Phase 0 | Returns in Phase 5 ENTERPRISE for manufacturers    |
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

### Future decisions to log here

- When AI menu suggestions launches (target: Phase 1)
- When inventory returns visibly to merchants (target: Phase 4)
- When white-label or custom domains ships
- Any pricing changes
