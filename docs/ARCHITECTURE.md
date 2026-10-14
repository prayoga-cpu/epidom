# Architecture

How the codebase is organized and why. This doc evolves as the product evolves. If you change architecture, update this file in the same PR.

---

## 1. System diagram (logical)

```
                    ┌────────────────────────┐
                    │   Public Internet      │
                    └────────────┬───────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                    ▼
    ┌───────────────┐   ┌────────────────┐   ┌──────────────┐
    │ (marketing)   │   │   (public)     │   │   (app)      │
    │ epidom.fr     │   │ epidom.fr/@x   │   │ epidom.fr/   │
    │               │   │                │   │   store/...  │
    │ Landing,      │   │ Storefronts,   │   │              │
    │ Pricing,      │   │ Menus,         │   │ Authed       │
    │ Terms         │   │ Anon Orders    │   │ Dashboard    │
    └───────────────┘   └────────┬───────┘   └──────┬───────┘
                                 │                  │
                                 │                  │
                                 ▼                  ▼
                       ┌─────────────────────────────────┐
                       │       Next.js API Routes        │
                       │   /api/public/* /api/stores/*   │
                       └─────────────┬───────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            ▼                        ▼                        ▼
       ┌─────────┐           ┌────────────┐         ┌─────────────────┐
       │Postgres │           │   Xendit   │         │  Stripe         │
       │ (Prisma)│           │  (Customer │         │ (SaaS Subs +    │
       │         │           │   Payments)│         │  optional Conn) │
       └─────────┘           └────────────┘         └─────────────────┘
                                                              │
                                                    ┌─────────┴─────────┐
                                                    ▼                   ▼
                                              ┌──────────┐        ┌──────────┐
                                              │  Resend  │        │ Fonnte / │
                                              │  (Email) │        │ WA Biz   │
                                              └──────────┘        └──────────┘
```

---

## 2. Route groups

Next.js App Router groups in `src/app/`:

| Group         | Auth     | Purpose                                                                                                           | Caching                                                                  |
| ------------- | -------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `(marketing)` | None     | Landing, pricing, guides, blog, comparisons, under `m/[locale]`                                                   | Prerendered, served from the CDN                                         |
| `(public)`    | None     | Per-merchant storefronts (`[slug]`, shown as `/@slug`) and `r/[orderId]` receipts                                 | Server-rendered; the storefront lookup is request-deduped with `cache()` |
| `(app)`       | Required | Authenticated app: `(auth)`, `(stores)`, `store/[storeId]`, `admin`, `owner`, `checkout`, `onboarding`, `profile` | Server-rendered                                                          |

`src/proxy.ts` rewrites marketing URLs onto `(marketing)/m/[locale]` and treats paths starting with `/@` as public storefront routes. Inside `store/[storeId]` there are two sub-groups: `(dashboard)` (the back office: menu, finance, schedule, staff, shifts, billing, ...) and `(pos-mode)` (the POS and tables screens).

The `(public)` group is the heart of the new positioning: a storefront has to load quickly on poor Indonesian mobile connections.

---

## 3. Feature-Driven Architecture (FDA)

```
src/
├── app/                      # Routes only. Pages stay thin.
├── features/                 # Domain logic, one folder per feature
│   ├── admin/                # Platform admin (/admin)
│   ├── auth/
│   ├── billing/
│   ├── checkout/
│   ├── dashboard/            # Back office: menu, finance, schedule, staff, shifts, ...
│   ├── guide/
│   ├── loading/
│   ├── marketing/            # Marketing site components
│   ├── onboarding/
│   ├── pos/                  # POS, incl. the offline queues (hooks/)
│   ├── pos-mode/             # POS Mode shell: tab bar, status bar, overflow menu, store switcher
│   ├── store-transfer/
│   ├── storefront/           # Public storefront + editor
│   └── stores/
├── components/               # Shared, generic UI only (shadcn primitives)
│   ├── ui/
│   └── providers/
├── lib/                      # Core, framework-level utilities
│   ├── auth/                 # Session + plan/permission guards
│   ├── prisma.ts
│   ├── payments/             # Payment provider abstraction
│   ├── notifications/        # WhatsApp (Fonnte) notifications
│   ├── inngest/              # Background jobs
│   ├── realtime/             # Pusher publish/subscribe
│   ├── services/             # Cross-feature business logic
│   ├── validation/           # Zod schemas
│   └── seo.ts
├── config/                   # Plan, rate-limit, permission and fee config
├── locales/                  # i18n strings (en, fr, id)
└── types/                    # Cross-cutting types
```

**Rules:**

- A feature folder owns its own components, hooks, and types.
- Feature folders never import from other feature folders. Cross-feature logic goes in `lib/services/`.
- `components/` is for primitives only. Anything domain-specific goes in `features/`.
- `page.tsx` files import a single feature root component and pass server-fetched data into it.

---

## 4. Data model architecture

### Tenant hierarchy

```
User
 └── Business (1:N)
      └── Store (1:N)
           ├── Storefront (1:1)        [Phase 1]
           │    └── MenuItem (1:N)
           ├── Product / Material      [Phase 4, gated]
           ├── Recipe                  [Phase 4, gated]
           ├── Order                   [Phase 2]
           │    └── OrderItem (1:N)
           ├── Shift                   [Phase 4]
           └── StaffMember             [Phase 4]
```

### Scoping rule

**Every query must scope to `storeId`.** There are no exceptions. Tenant isolation is the most important invariant in the system.

```typescript
// ✅ Correct
const orders = await prisma.order.findMany({
  where: { storeId, status: "PENDING" },
});

// ❌ Wrong, no tenant scope
const orders = await prisma.order.findMany({
  where: { status: "PENDING" },
});
```

Tenant scoping is enforced by the guards in `src/lib/auth/` and `src/lib/utils/store-verification.ts` (`verifyStoreAccess`); the guards have tests in `src/lib/auth/__tests__/`. There is no dedicated cross-tenant test suite, so review every new query for the `storeId` scope.

### Decimal everywhere

Money and quantities use Prisma `Decimal`, not `Float`:

```prisma
price       Decimal  @db.Decimal(12, 2)   // money
quantity    Decimal  @db.Decimal(12, 3)   // ingredient quantities
```

`Float` is forbidden in financial fields. Rounding errors compound.

---

## 5. Payment provider abstraction

Two completely different payment flows. Architecturally separated.

```
┌────────────────────────────┐         ┌────────────────────────────┐
│  SaaS Subscription Billing │         │   Customer Payments        │
│  (merchants pay Epidom)    │         │   (diners pay merchants)   │
│                            │         │                            │
│  Provider: Stripe          │         │  Providers: Xendit, Stripe │
│  Currency: EUR (+USD, IDR) │         │  Currency: IDR (Xendit)    │
│  Methods: Card             │         │  Methods: QRIS, GoPay,     │
│                            │         │    OVO, DANA, ShopeePay,   │
│  src/lib/stripe.ts         │         │    Bank (Xendit), Card     │
│  src/app/api/subscriptions │         │  src/lib/payments/         │
│                            │         │    providers/xendit.ts     │
│                            │         │    providers/stripe-       │
│                            │         │      customer.ts           │
└────────────────────────────┘         └────────────────────────────┘
```

Customer payments go through one entry point in `src/lib/payments/index.ts`: `initiatePayment(req)` routes by payment method (`isIndonesianPayment(method)` is true for QRIS, GoPay, OVO, DANA, ShopeePay and bank transfer, which use Xendit; `STRIPE_CARD` uses `stripe-customer.ts`). SaaS subscription billing does not use this module.

This keeps the two flows from leaking into each other and makes it trivial to swap providers (Xendit → Midtrans for IDN, for example) without touching feature code.

---

## 6. Notification provider abstraction

Indonesian merchants live on WhatsApp. Email is secondary. The notification layer reflects this.

```
src/lib/notifications/
├── index.ts                  # notifyMerchantNewOrder, notifyCustomerReceipt
└── providers/
    └── fonnte.ts             # Unofficial WhatsApp gateway (disabled without a token)
```

Other channels live outside this folder:

- **Email**: Resend, via `src/lib/services/email.service.ts`.
- **Browser push**: `web-push` (VAPID) in `src/lib/push/`.
- **Merchant alerts** (new order, low/critical stock): MagicBell in `src/lib/magicbell/`.
- **Live UI updates**: Pusher in `src/lib/realtime/`; the app polls when Pusher is not configured.

The official WhatsApp Business API is not implemented.

Events that trigger notifications:

| Event                       | WhatsApp      | Email | SSE |
| --------------------------- | ------------- | ----- | --- |
| Order placed                | Yes           | No    | Yes |
| Order paid                  | Yes           | No    | Yes |
| Order cancelled by customer | Yes           | No    | Yes |
| Low stock alert             | Yes (Phase 4) | Yes   | Yes |
| Shift discrepancy           | No            | Yes   | No  |
| Account / billing           | No            | Yes   | No  |

---

## 7. Background jobs

Inngest, from Phase 2 onwards.

```
src/lib/inngest/
├── client.ts
└── functions/
    ├── audit-alerts.ts
    ├── audit-retention.ts
    ├── check-backup-freshness.ts
    ├── custom-development-notification.ts
    ├── feedback-notification.ts
    ├── nightly-database-backup.ts
    ├── order-notification.ts
    ├── parse-aggregator-email.ts
    ├── purge-expired-accounts.ts
    ├── send-customer-receipt.ts
    ├── send-receipt-email-on-order.ts
    └── stock-integrity-sweep.ts
```

All async work that takes more than 1 second goes through Inngest. API routes stay fast.

### Phase 5: Aggregator email ingestion pipeline

Merchants forward aggregator order emails to `orders@epidom.fr` with a subject prefix `[@their-slug]`.

```
Aggregator email (GoFood / GrabFood / ShopeeFood / Tokopedia)
  ↓  merchant forwards with [@slug] prefix
POST /api/webhooks/email
  → validate Resend inbound payload (Zod)
  → extract slug, look up storefront.storeId
  → detect platform from from-address + subject
  → create AggregatorEmail { parseStatus: "pending" }
  → inngest.send("aggregator/email.received")   ← async, fire-and-forget
  ↓
Inngest: parse-aggregator-email (retries: 2)
  → if no OPENAI_API_KEY → set parseStatus="manual", return
  → call OpenAI gpt-4o with structured Zod schema
  → create Order + OrderItems (source=GOFOOD|…, status=CONFIRMED, paymentStatus=PAID)
  → update AggregatorEmail { parseStatus: "success", parsedOrderId }
```

Commission rates (hardcoded, update as official rates change):

| Platform   | Commission |
| ---------- | ---------- |
| GoFood     | 20%        |
| GrabFood   | 20%        |
| ShopeeFood | 20%        |
| Tokopedia  | 15%        |

These feed directly into `/api/stores/[id]/finance/channels` net-revenue calculations.

---

## 8. Caching strategy

| Surface                              | Strategy                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `(marketing)/m/[locale]`             | Prerendered at build, served from the CDN (`changelog` revalidates hourly)                          |
| `(public)/[slug]` (storefront, menu) | Server-rendered per request; `getPublicStorefront` is deduped within a request with React `cache()` |
| `(app)/store/[storeId]/*`            | Server-rendered, no cache                                                                           |

There is no `revalidateTag` usage today: a menu edit shows on the next request.

---

## 9. Authentication

Better Auth, with two distinct session contexts:

| Context               | Session source                            | Used in                              |
| --------------------- | ----------------------------------------- | ------------------------------------ |
| **Server components** | `getSession()` from `src/lib/auth.ts`     | `page.tsx`, layouts, server actions  |
| **Client components** | `useUser()` from `src/lib/auth-client.ts` | Interactive components               |
| **API routes**        | `auth.api.getSession({ headers })`        | All `/api/*` routes                  |
| **Public routes**     | None                                      | `(public)` pages and `/api/public/*` |

The custom `useSession` hook in `auth-client.ts` fetches from `/api/session` rather than using Better Auth's built-in hook directly. This is intentional: it gives us a single chokepoint for session changes and is friendlier to TanStack Query.

---

## 10. Plan-gating

From Phase 4 onwards, routes will be gated by subscription plan.

```typescript
// src/lib/auth/require-plan.ts
export async function requirePlan(storeId: string, minPlan: SubscriptionPlan): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");

  const sub = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
  });

  if (!sub || !planMeetsMinimum(sub.plan, minPlan)) {
    redirect(`/store/${storeId}/billing?upgrade=${minPlan}`);
  }
}
```

Used in route layouts:

```typescript
// src/app/(app)/store/[storeId]/(dashboard)/data/layout.tsx
export default async function DataLayout({ children, params }) {
  await requirePlan(params.storeId, "OPERATIONS");
  return children;
}
```

`planMeetsMinimum` knows the tier order: `FREE < POS < OPERATIONS < ENTERPRISE`.

---

## 11. Offline-first POS architecture (Phase 3+)

The POS surface must work without internet. Indonesian power and internet are unreliable.

```
┌─────────────────────────────────────────────────────────┐
│              POS UI (React, browser)                    │
│                                                         │
│   ┌─────────────────┐         ┌─────────────────────┐  │
│   │  Optimistic UI  │ ──────► │  TanStack Query     │  │
│   │  (instant)      │         │  Mutation Queue     │  │
│   └─────────────────┘         └─────────┬───────────┘  │
│                                          │              │
│                                          ▼              │
│                              ┌──────────────────────┐  │
│                              │   IndexedDB Queue    │  │
│                              │   (idb-keyval)       │  │
│                              └──────────┬───────────┘  │
└─────────────────────────────────────────┼───────────────┘
                                          │
                          App replays the queue on reconnect
                          (use-offline-sync.ts)
                                          │
                                          ▼
                              ┌──────────────────────┐
                              │   API + Postgres     │
                              └──────────────────────┘
```

Key principles:

- Every mutation is queued and persisted before being sent
- The UI never blocks on network
- Conflict resolution is last-write-wins for most fields, with manual review for cash reconciliation discrepancies

**As built (3.3.6):** the diagram above was the Phase 3 plan. What shipped is a
service worker (`public/sw.js`, caching only: no background sync) for the screens, an IndexedDB mirror of the TanStack Query cache
for reads, and three IndexedDB write queues (sales, table status, production
logs) replayed through one loop with server-side idempotency keys. A sale keeps
its own time and shift on replay, and nothing in a queue is ever deleted without
a person choosing to. The same web app ships as a desktop installer (`desktop/`),
an Android Trusted Web Activity (`android/`) and an iOS home-screen PWA. Details,
guarantees, limits and the roadmap (offline shifts, a local-first sync engine, an
in-store hub) are in [`OFFLINE_POS.md`](./OFFLINE_POS.md).

---

## 12. Cross-cutting concerns

| Concern            | Solution                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Logging**        | `src/lib/logger.ts`: console output in dev, JSON lines in prod (Vercel logs), with request IDs                                             |
| **Error tracking** | None beyond Vercel logs; no third-party error tracker is installed                                                                         |
| **Rate limiting**  | In-memory `Map` (`src/lib/middleware/rate-limit.ts`, config in `src/config/rate-limit.config.ts`); per-instance, not shared across lambdas |
| **CSRF**           | Better Auth handles for `(app)` surface; public endpoints rely on origin checks + rate limits                                              |
| **Validation**     | Zod everywhere, never trust unvalidated input                                                                                              |
| **Analytics**      | Vercel Analytics for web vitals; optional Google Analytics and Meta Pixel, loaded only after cookie consent (`src/components/analytics/`)  |
| **Plan gating**    | No env feature flags. Plan and feature gates: `src/lib/auth/require-plan.ts`, `require-store-feature.ts`, `require-feature.ts`             |

---

## 13. Deployment

| Environment | Branch         | URL              | Database                                             |
| ----------- | -------------- | ---------------- | ---------------------------------------------------- |
| Development | (local)        | `localhost:3000` | Neon `development` branch (see `DATABASE.md`)        |
| Preview     | tracked branch | `dev.epidom.fr`  | Neon `development` branch, reset nightly from `main` |
| Production  | `main`         | `epidom.fr`      | Neon `main` branch                                   |

Local dev and Vercel Preview deployments share the `development` Neon branch and never touch production data. Merging to `main` deploys to production. The nightly reset and the redeploy of `dev.epidom.fr` are described in [`DATABASE.md`](./DATABASE.md) ("Development vs production database").

----------- | --------- | ------------------------ | ----------------------------------------- |
| Development | (local) | `localhost:3000` | Local Postgres or Docker |
| Preview | All PRs | `epidom-pr-N.vercel.app` | Neon preview branch |
| Staging | `staging` | `staging.epidom.fr` | Neon staging |
| Production | `main` | `epidom.fr` | Neon prod (Singapore region from Phase 3) |

Every PR gets a preview deployment with its own database branch. Merging to `staging` deploys to staging. Merging to `main` deploys to prod after a manual approval gate.

---

## 14. Open architectural decisions

Decisions yet to be made. Tracked here so we don't relitigate them in PRs:

1. **POS hardware**: do we sell or recommend specific Android tablets? (Lean: recommend, never sell.)
2. **Aggregator API access**: pursue partner programs vs continue email parsing? (Phase 5 decision.)
3. **White-label**: should we support kopi-chain franchises rebranding the storefront? (Phase 5+.)
4. **Mobile app**: do we ever ship a native app, or stay PWA-only? (Current bet: stay PWA. Owner.com regrets shipping native too early.) As of 3.3.6 the PWA is also packaged as installable apps without a second codebase: an Electron desktop shell and an Android Trusted Web Activity — see `OFFLINE_POS.md`.
