# Billing

How Epidom charges, who pays whom, and how the payment flows are wired.

---

## TL;DR

| Flow                                      | Provider                 | Currency                    | Frequency           |
| ----------------------------------------- | ------------------------ | --------------------------- | ------------------- |
| **SaaS subscription** (merchant → Epidom) | Stripe                   | IDR (primary), EUR (legacy) | Monthly recurring   |
| **Customer payments** (diner → merchant)  | Xendit                   | IDR                         | Per order           |
| **Connect payouts** (Epidom → merchant)   | Stripe Connect, optional | IDR / EUR                   | Per order, Phase 5+ |

The two flows live in different modules and never share code paths. See `/docs/ARCHITECTURE.md` section 5.

---

## Pricing tiers

The current public pricing for Indonesia.

| Tier       | IDR/month  | USD equiv | Trial              |
| ---------- | ---------- | --------- | ------------------ |
| FREE       | Rp 0       | $0        | n/a, free forever  |
| POS        | Rp 229,000 | $14.99    | 14 days            |
| OPERATIONS | Rp 459,000 | $29.99    | 14 days            |
| ENTERPRISE | Custom     | Custom    | Sales-assisted     |

(Raised from the original Rp 99k/249k/499k+ figures — see `CHANGELOG.md` 2.24.1. Enterprise moved to
custom/sales-assisted pricing rather than a fixed Rp 499,000+ floor.)

**Single source of truth in code:** `src/lib/constants/plan-pricing.ts` holds every displayed price
(IDR, EUR and USD, monthly and yearly) for POS and OPERATIONS. The billing UI's `PLAN_PRICE_IDR`
imports from it, and `src/lib/constants/__tests__/plan-pricing.test.ts` fails if any locale's price
string on `/pricing` or the home teaser differs from it. The Stripe Price objects mirror it: EUR is
the base currency, with USD and IDR as `currency_options` on the same Price (see "Products and prices"
below). Note `docs/STRATEGY.md` still quotes the older Rp 99k / 249k / 499k figures.

**Plan activation without payment:** `SubscriptionService.activateFree` is FREE-only (it throws for
anything else) and `POST /api/subscriptions/activate-free` accepts only `plan: "FREE"`. The single
no-payment paid grant (the admin-secret demo seed) goes through
`SubscriptionService.grantPlanWithoutPayment` — never pass a request-derived plan to it.

Pricing rationale and the Indonesian SaaS benchmarks behind these numbers are in `/docs/STRATEGY.md` section 7.

### Annual discount

- 20% off when paid annually
- Stripe price IDs for annual variants live alongside monthly ones

### Free tier limits

Defined in `/docs/FEATURES.md`. Hitting any limit prompts an upgrade flow, never a hard block on essential reads.

---

## Stripe setup (SaaS subscription)

### Products and prices

Stripe account `acct_1UJrtbBS1eyDCgdx` (France, EUR) since 2026-09-26. Each plan is one Product with a
monthly and a yearly recurring Price. Every Price is EUR-based and carries USD and IDR
`currency_options`, with amounts from `src/lib/constants/plan-pricing.ts` (yearly = the per-month
"billed yearly" figure × 12). Find a price by its lookup key:

| Product           | Monthly lookup key          | Yearly lookup key          | Env var (monthly / yearly)                                                   |
| ----------------- | --------------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| Epidom POS        | `epidom_pos_monthly`        | `epidom_pos_yearly`        | `NEXT_PUBLIC_STRIPE_PRICE_ID_POS_MONTHLY` / `_POS_YEARLY`                   |
| Epidom Operations | `epidom_operations_monthly` | `epidom_operations_yearly` | `NEXT_PUBLIC_STRIPE_PRICE_ID_OPERATIONS_MONTHLY` / `_OPERATIONS_YEARLY`     |

ENTERPRISE has no catalog Price; it is quoted per account (see "Admin custom price override" below). The
`price_*` IDs go in the env file, never in code. The Customer portal must have saved settings in the
dashboard (Settings → Billing → Customer portal): the code opens portal sessions without a
configuration ID, so it needs the account's default configuration.

### Test mode setup

Local `.env` uses a Stripe **sandbox** of the same account, never live keys: a checkout from localhost
with a live key charges a real card, and because the dev database copies production user IDs, the
production webhook would upgrade the matching production user.

```bash
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # printed by: stripe listen --forward-to localhost:3000/api/webhooks/stripe

NEXT_PUBLIC_STRIPE_PRICE_ID_POS_MONTHLY=price_...        # the sandbox's own price IDs
NEXT_PUBLIC_STRIPE_PRICE_ID_POS_YEARLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_ID_OPERATIONS_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_ID_OPERATIONS_YEARLY=price_...
```

### Webhook events handled

The production endpoint is `https://epidom.fr/api/webhooks/stripe` (the apex host: Stripe does not
follow redirects), snapshot payloads, API version `2026-08-26.dahlia`. Subscribe it to exactly these:

- `checkout.session.completed` — provision subscription, set plan
- `customer.subscription.created` — same, for subscriptions created outside Checkout
- `customer.subscription.updated` — sync plan, status, period and scheduled cancellation
- `customer.subscription.deleted` — downgrade to FREE, keep data
- `invoice.payment_failed` — set status to `PAST_DUE`
- `invoice.payment_succeeded` — back to `ACTIVE` after a recovered payment

Webhook handler: `src/app/api/webhooks/stripe/route.ts`. All event handlers are idempotent.

**API version shapes.** Webhook payloads use the endpoint's API version; SDK responses use the version
pinned in `src/lib/stripe.ts` (`2025-10-29.clover`, stripe-node 19.3). Since `2025-03-31.basil` the
billing period is on each subscription item and an invoice's subscription is at
`invoice.parent.subscription_details.subscription`. Read these only through the helpers in
`src/types/stripe.ts`, which accept both the current and the pre-basil shape.

### Subscription model

```prisma
model Subscription {
  id                   String             @id @default(cuid())
  userId               String             @unique
  stripeCustomerId     String             @unique
  stripeSubscriptionId String?            @unique
  stripePriceId        String?
  plan                 SubscriptionPlan   @default(FREE)
  status               SubscriptionStatus @default(INCOMPLETE)
  currentPeriodStart   DateTime?
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean            @default(false)
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt
}
```

A user with no subscription is implicitly on `FREE`. Don't require a `Subscription` row just to gate features.

### Admin custom price override

`Subscription.customPriceAmount` / `customPriceCurrency` / `customPriceInterval` / `customPricePlan` (nullable) let an admin quote a specific account its own price for a specific tier, via the Master Admin Panel's "Manage" → "Set Custom Price" action (`SubscriptionService.setCustomPrice`/`clearCustomPrice`). Deliberately separate fields from `stripePriceId` — which every Stripe webhook handler rewrites on its own — so a quote can never be silently clobbered back to catalog pricing. `customPricePlan` is one of POS/OPERATIONS/ENTERPRISE; FREE is not quotable.

Behavior splits on how the account is actually billed:

- **Real Stripe-paying account** (`stripeCustomerId` not `admin_`/`free_`-prefixed): a **re-quote**. Their running subscription is canceled in Stripe immediately (`prorate: false`) and `stripeSubscriptionId` is cleared, `customPricePendingAt` is stamped, `customPricePrevStatus` records the status to hand back on withdrawal, and `status` drops to `INCOMPLETE` — which is what actually suspends access, since every gate (`requirePlan`, `SubscriptionService.has*Access`, the public storefront routes) already reads a non-ACTIVE subscription as FREE. The user pays from their Billing page: `POST /api/subscriptions/custom-price/checkout` → `createCustomPriceCheckoutSession` builds an ad-hoc `price_data` line item from the stored amount/currency/interval (never from the request body) and tags session + subscription metadata `customPrice: "true"`.
- **Admin-granted/comped account** (`admin_`/`free_`-prefixed `stripeCustomerId`): **reference-only** — no Stripe call, no suspension. Stored purely for display (admin panel + the account's own Billing page) so the operator has a record for a manual/negotiated invoicing arrangement outside the app. Suspending an account the operator comped by hand would lock it out with nothing to pay.

While `customPricePendingAt` is set:

- `requirePlan` redirects to `/store/<storeId>/billing?customPrice=pending` instead of `/pricing` — /pricing can't sell them the quoted price.
- The Stripe webhook refuses to hand access back from the superseded subscription: `customer.subscription.updated` and `invoice.payment_succeeded` skip the ACTIVE/plan restore, and `customer.subscription.deleted` keeps the quote (that cancellation is the one `setCustomPrice` just issued). Only an event carrying `customPrice: "true"` clears `customPricePendingAt`.
- `/api/subscriptions/sync`, `/api/subscriptions/cleanup` and `activateFree` refuse with 409 — each of them force-writes `status: ACTIVE` from Stripe and would otherwise be a way around the quote.

Clearing (`clearCustomPrice`) nulls every custom-price field. A still-pending quote is withdrawn and `status` returns to `customPricePrevStatus` (their old Stripe subscription stays canceled — that can't be undone, so re-quote or let them subscribe again). For an account already paying a custom price on POS/OPERATIONS, the subscription item is restored to that plan's catalog `MONTHLY` price (always monthly — the original interval isn't tracked once overridden).

---

## Xendit setup (customer payments)

### Supported methods (Phase 2)

| Method                          | Settlement | Xendit fee      |
| ------------------------------- | ---------- | --------------- |
| QRIS                            | T+1        | 0.7%            |
| GoPay                           | T+1        | 2.0%            |
| OVO                             | T+1        | 2.0%            |
| DANA                            | T+1        | 2.0%            |
| ShopeePay                       | T+1        | 2.0%            |
| Bank Transfer (Virtual Account) | T+1        | Rp 4,000 flat   |
| Credit Card                     | T+2        | 2.9% + Rp 2,000 |

Fees are passed through to merchants, not absorbed by Epidom (FREE tier). On ENTERPRISE Stripe Connect, Epidom takes an additional 20% margin on top — but only if the merchant opts into Connect.

### Test mode setup

```bash
# .env.local
XENDIT_SECRET_KEY=xnd_development_...
XENDIT_WEBHOOK_TOKEN=...
XENDIT_CALLBACK_URL=https://epidom-pr-N.vercel.app/api/webhooks/xendit
```

### Webhook events handled

- `invoice.paid` — mark Order as PAID, notify merchant
- `invoice.expired` — mark Order as FAILED
- `qr.payment` — same as invoice.paid, for QRIS Dynamic
- `ewallet.payment` — for GoPay/OVO/DANA/ShopeePay

Handler: `src/app/api/webhooks/xendit/route.ts`. Always idempotent.

### Order → payment lifecycle

```
Customer places order
    ↓
Order created (PENDING, PaymentStatus=PENDING)
    ↓
Xendit invoice / QR / e-wallet charge created
    ↓
Customer pays
    ↓
Xendit webhook fires
    ↓
Order.paymentStatus = PAID
Order.status = PENDING (waiting for kitchen)
    ↓
WhatsApp notification to merchant
    ↓
Merchant accepts → preparing → ready → served
```

---

## Stripe Connect 80/20 (Phase 5+, optional)

The original codebase has Stripe Connect scaffolding for an 80/20 revenue split. This is paused pending:

1. Legal review for Indonesian payment regulations (Bank Indonesia, OJK)
2. Validation that merchants want consolidated billing
3. Sufficient ENTERPRISE tier customer base to justify the complexity

Until then, ENTERPRISE merchants on Connect-style billing get a custom integration, not the productized flow.

When Connect ships:

- Merchant connects their Stripe account through Connect OAuth
- Every customer payment flows: Customer → Epidom Stripe → 80% to merchant, 20% to Epidom
- Replaces Xendit for that merchant entirely
- Pricing model shifts: lower subscription, higher transaction take

---

## Billing UI

| Surface                | Path                                   | Audience                    |
| ---------------------- | -------------------------------------- | --------------------------- |
| Public pricing page    | `/pricing`                             | Anyone                      |
| In-app billing page    | `/store/[storeId]/billing`             | Logged-in merchant          |
| Upgrade flow           | `/store/[storeId]/billing?upgrade=POS` | Merchant hitting plan limit |
| Stripe Customer Portal | Linked from in-app billing             | Existing subscriber         |

The Customer Portal handles payment method changes, invoice history, and cancellations. We do not build these ourselves.

---

## Plan changes and proration

| Change           | Behavior                                          |
| ---------------- | ------------------------------------------------- |
| FREE → POS       | Immediate, full month charged                     |
| POS → OPERATIONS | Immediate, prorated upgrade charge                |
| OPERATIONS → POS | Effective at next renewal, no immediate refund    |
| Annual → Monthly | Effective at next renewal                         |
| Cancel           | Stays active until period end, then drops to FREE |

We never delete data on downgrade. A merchant who drops from OPERATIONS to FREE still has their inventory data; they just can't access the inventory UI until they upgrade again.

---

## Failed payments

Stripe handles dunning. We mirror the state:

| Stripe state                         | App state  | What we show                                        |
| ------------------------------------ | ---------- | --------------------------------------------------- |
| Invoice payment failed (1st attempt) | `PAST_DUE` | Banner: "Payment failed, retrying in 3 days"        |
| All retries failed                   | `CANCELED` | Banner: "Subscription canceled" + downgrade to FREE |

Notifications go out via Resend (email) and WhatsApp.

---

## Refunds

| Scenario                                         | Policy                                                          |
| ------------------------------------------------ | --------------------------------------------------------------- |
| First 14 days of subscription                    | Full refund, manual via Stripe                                  |
| After 14 days                                    | No refund, but immediate downgrade-at-period-end allowed        |
| Annual plan, mid-year cancel                     | Prorated refund of unused months minus 1                        |
| Customer payment failed but merchant marked paid | Merchant resolves with customer directly; we don't intermediate |

Refund operations are manual through the Stripe dashboard. Document the reason in the customer note field for every refund.

---

## Currency handling

| Field                           | Storage               | Display                            |
| ------------------------------- | --------------------- | ---------------------------------- |
| `subscription.plan`             | enum                  | tier name (localized)              |
| `subscription.amount`           | Decimal               | formatted with currency code       |
| `order.currency`                | string (`IDR`, `EUR`) | displayed with merchant's currency |
| `order.subtotal`, `order.total` | Decimal(12, 2)        | localized formatting               |

Indonesia uses period `.` for thousands and comma `,` for decimals: `Rp 99.000,00`. Use `Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" })`.

---

## Open billing questions

1. Should we charge Xendit fees back to merchants on FREE tier, or absorb them? (Current: pass through.)
2. Will we offer a "social tier" below FREE for menu-only with no ordering? (Possibly Phase 2 decision.)
3. Annual discount: 20% or 17%? (20% chosen; revisit after 6 months of conversion data.)
4. When does Stripe Connect 80/20 ship? (Targeting Phase 5, contingent on legal.)
