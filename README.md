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

## Feature Map

### Auth & Onboarding

- Email/password + Google OAuth via Better Auth
- Email verification with resend flow
- Guided 5-step onboarding (business → logo → menu → theme → publish)
- `hasOnboarded` flag — `/onboarding` redirects server-side once complete
- OAuth errors redirect to `/login` with human-readable toast
- PWA install button in topbar (hides when already installed/standalone)

### Storefront (`/@slug`)

- Customizable public menu page
- Photo upload: logo (1:1 · 400×400 min · 2 MB) and cover (16:9 · 1920×1080 ideal · 5 MB)
- Theme color, tagline, description, social links, custom links
- Online ordering (customer checkout + order tracking)
- Table reservations (public booking form)
- GoFood / GrabFood / ShopeeFood / Tokopedia aggregator links

### POS & Operations (POS+ plan)

- POS cashier — menu grid, cart, checkout (CASH / CARD / TRANSFER / QRIS)
- Order types: DINE_IN, TAKEOUT, DELIVERY
- Kitchen Display System (KDS)
- Real-time order queue (SSE)
- Table management + reservations dashboard
- Staff PIN login + email invitation
- Shift management with cash reconciliation

### Inventory (OPERATIONS+ plan)

- **Data** — Products, Materials, Recipes, Suppliers (CRUD, bulk delete, CSV export, AI Smart Import)
- New products are auto-added to the POS/storefront menu on creation (finds/creates a matching category); "In Menu" badge on product cards lets you remove one manually if needed
- Sync-to-menu prompt when product price/name changes and a linked MenuItem exists
- POS demand badge on recipe cards (30-day order count)
- **Management** — Deliveries, Production batches, Production history, Stock adjustment
- **Tracking** — Stock Levels tab + Recent Movements tab (with POS order # / batch # source)
- Automatic stock deduction on order → DELIVERED (serializable transaction)
- LOW_STOCK / CRITICAL_STOCK alerts with notification bell

### Finance & Reporting (OPERATIONS+ plan)

- Daily / weekly / monthly P&L: revenue, COGS, gross margin %
- Per-channel breakdown (DIRECT, GOFOOD, GRABFOOD, SHOPEEFOOD, TOKOPEDIA)
- Top-selling items, shift reconciliation, CSV/Excel export

### Multi-outlet & Admin

- Owner dashboard — rolls up all stores (ENTERPRISE)
- Admin panel — subscriptions, passwords, account management (master accounts)
- Aggregator email ingestion via Inngest + OpenAI

### Billing

- Plans: FREE · POS (Rp 99,000/mo) · OPERATIONS (Rp 249,000/mo) · ENTERPRISE
- Stripe Checkout + Customer Portal
- Subscription price on profile updates live per user currency (IDR / USD / EUR)

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
