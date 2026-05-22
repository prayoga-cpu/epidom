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
    │ epidom.id     │   │ epidom.id/@x   │   │ epidom.id/   │
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

| Group | Auth | Purpose | Caching |
|---|---|---|---|
| `(marketing)` | None | Public landing, pricing, terms | Static, ISR |
| `(public)` | None | Per-merchant storefronts at `/@slug` | Static with revalidation tags |
| `(app)` | Required | Authenticated merchant dashboard | Server-rendered |

The `(public)` group is the heart of the new positioning. Every storefront is statically cached and only revalidates when the merchant edits their menu. This keeps load times under 2 seconds even on poor Indonesian mobile connections.

---

## 3. Feature-Driven Architecture (FDA)

```
src/
├── app/                      # Routes only. Pages stay thin.
├── features/                 # Domain logic, one folder per feature
│   ├── auth/
│   ├── storefront/           # Phase 1
│   │   ├── editor/           # In-app storefront editor
│   │   ├── public/           # Public-facing storefront components
│   │   └── analytics/
│   ├── orders/               # Phase 2
│   ├── pos/                  # Phase 3
│   ├── operations/           # Phase 4
│   │   ├── shifts/
│   │   ├── kds/
│   │   └── inventory/
│   ├── finance/              # Phase 5
│   ├── dashboard/            # Cross-feature dashboard shell
│   ├── marketing/            # Marketing site components
│   └── onboarding/
├── components/               # Shared, generic UI only (shadcn primitives)
│   ├── ui/
│   └── providers/
├── lib/                      # Core, framework-level utilities
│   ├── auth/
│   ├── prisma.ts
│   ├── payments/             # Payment provider abstraction
│   ├── notifications/        # Notification provider abstraction
│   ├── services/             # Cross-feature business logic
│   ├── validation/           # Zod schemas
│   └── seo.ts
├── locales/                  # i18n strings
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
           └── Staff                   [Phase 4]
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

A failing test in `src/test/tenant-isolation.test.ts` catches accidental cross-tenant reads.

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
│  Provider: Stripe          │         │  Provider: Xendit          │
│  Currency: IDR, EUR        │         │  Currency: IDR             │
│  Methods: Card             │         │  Methods: QRIS, GoPay,     │
│                            │         │           OVO, DANA, Bank  │
│  src/lib/payments/         │         │  src/lib/payments/         │
│    providers/stripe.ts     │         │    providers/xendit.ts     │
└────────────────────────────┘         └────────────────────────────┘
```

Selector pattern in `src/lib/payments/index.ts`:

```typescript
export function getSubscriptionProvider() {
  return stripeProvider;
}

export function getCustomerPaymentProvider(region: "ID" | "FR") {
  return region === "ID" ? xenditProvider : stripeProvider;
}
```

This keeps the two flows from leaking into each other and makes it trivial to swap providers (Xendit → Midtrans for IDN, for example) without touching feature code.

---

## 6. Notification provider abstraction

Indonesian merchants live on WhatsApp. Email is secondary. The notification layer reflects this.

```
src/lib/notifications/
├── providers/
│   ├── fonnte.ts             # v1, unofficial WhatsApp gateway
│   ├── whatsapp-business.ts  # v2, official Meta WhatsApp Business API
│   ├── resend.ts             # Email
│   └── index.ts              # Provider selector
├── orchestrator.ts           # Multi-channel dispatcher
└── templates/                # Message templates by event type
```

Events that trigger notifications:

| Event | WhatsApp | Email | SSE |
|---|---|---|---|
| Order placed | Yes | No | Yes |
| Order paid | Yes | No | Yes |
| Order cancelled by customer | Yes | No | Yes |
| Low stock alert | Yes (Phase 4) | Yes | Yes |
| Shift discrepancy | No | Yes | No |
| Account / billing | No | Yes | No |

---

## 7. Background jobs

Inngest, from Phase 2 onwards.

```
src/lib/inngest/
├── client.ts
└── functions/
    ├── send-order-notification.ts
    ├── retry-failed-webhook.ts
    ├── daily-finance-rollup.ts      # Phase 5
    └── parse-aggregator-email.ts    # Phase 5
```

All async work that takes more than 1 second goes through Inngest. API routes stay fast.

### Phase 5: Aggregator email ingestion pipeline

Merchants forward aggregator order emails to `orders@epidom.id` with a subject prefix `[@their-slug]`.

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

| Platform | Commission |
|----------|-----------|
| GoFood | 20% |
| GrabFood | 20% |
| ShopeeFood | 20% |
| Tokopedia | 15% |

These feed directly into `/api/stores/[id]/finance/channels` net-revenue calculations.

---

## 8. Caching strategy

| Surface | Strategy |
|---|---|
| `(marketing)` | Static, regenerated on deploy |
| `(public)/@[slug]` | Static with `revalidate` tag `storefront:[slug]` |
| `(public)/@[slug]/menu` | Same tag as parent storefront |
| `(app)/store/[storeId]/*` | Server-rendered, no cache |
| API routes returning storefront data | Cached at edge with the same tag |

When a merchant edits their storefront:

```typescript
import { revalidateTag } from "next/cache";
revalidateTag(`storefront:${slug}`);
```

This invalidates both the page and the API response. Customers see the change within seconds.

---

## 9. Authentication

Better Auth, with two distinct session contexts:

| Context | Session source | Used in |
|---|---|---|
| **Server components** | `getSession()` from `src/lib/auth.ts` | `page.tsx`, layouts, server actions |
| **Client components** | `useUser()` from `src/lib/auth-client.ts` | Interactive components |
| **API routes** | `auth.api.getSession({ headers })` | All `/api/*` routes |
| **Public routes** | None | `(public)` pages and `/api/public/*` |

The custom `useSession` hook in `auth-client.ts` fetches from `/api/session` rather than using Better Auth's built-in hook directly. This is intentional: it gives us a single chokepoint for session changes and is friendlier to TanStack Query.

---

## 10. Plan-gating

From Phase 4 onwards, routes will be gated by subscription plan.

```typescript
// src/lib/auth/require-plan.ts
export async function requirePlan(
  storeId: string,
  minPlan: SubscriptionPlan
): Promise<void> {
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
                                  Service Worker
                                  syncs on reconnect
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

---

## 12. Cross-cutting concerns

| Concern | Solution |
|---|---|
| **Logging** | Server-side: `console.log` to Vercel logs in dev; Sentry in prod |
| **Error tracking** | Sentry (to be added in Phase 1) |
| **Rate limiting** | Upstash Redis + `@upstash/ratelimit`, applied to public POST endpoints |
| **CSRF** | Better Auth handles for `(app)` surface; public endpoints rely on origin checks + rate limits |
| **Validation** | Zod everywhere, never trust unvalidated input |
| **Analytics** | Vercel Analytics for web vitals; PostHog (to be added Phase 2) for product analytics |
| **Feature flags** | `src/lib/feature-flags.ts`, environment-variable-driven |

---

## 13. Deployment

| Environment | Branch | URL | Database |
|---|---|---|---|
| Development | (local) | `localhost:3000` | Local Postgres or Docker |
| Preview | All PRs | `epidom-pr-N.vercel.app` | Neon preview branch |
| Staging | `staging` | `staging.epidom.id` | Neon staging |
| Production | `main` | `epidom.id` | Neon prod (Singapore region from Phase 3) |

Every PR gets a preview deployment with its own database branch. Merging to `staging` deploys to staging. Merging to `main` deploys to prod after a manual approval gate.

---

## 14. Open architectural decisions

Decisions yet to be made. Tracked here so we don't relitigate them in PRs:

1. **POS hardware**: do we sell or recommend specific Android tablets? (Lean: recommend, never sell.)
2. **Aggregator API access**: pursue partner programs vs continue email parsing? (Phase 5 decision.)
3. **White-label**: should we support kopi-chain franchises rebranding the storefront? (Phase 5+.)
4. **Mobile app**: do we ever ship a native app, or stay PWA-only? (Current bet: stay PWA. Owner.com regrets shipping native too early.)
