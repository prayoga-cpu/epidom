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

| Tier       | IDR/month   | USD equiv | EUR equiv (legacy) | Trial             |
| ---------- | ----------- | --------- | ------------------ | ----------------- |
| FREE       | Rp 0        | $0        | €0                 | n/a, free forever |
| POS        | Rp 99,000   | ~$6       | €19                | 14 days           |
| OPERATIONS | Rp 249,000  | ~$15      | €49                | 14 days           |
| ENTERPRISE | Rp 499,000+ | ~$30+     | €99+               | Sales-assisted    |

Pricing rationale and the Indonesian SaaS benchmarks behind these numbers are in `/docs/STRATEGY.md` section 7.

### Annual discount

- 20% off when paid annually
- Stripe price IDs for annual variants live alongside monthly ones

### Free tier limits

Defined in `/docs/FEATURES.md`. Hitting any limit prompts an upgrade flow, never a hard block on essential reads.

---

## Stripe setup (SaaS subscription)

### Products and prices

In the Stripe dashboard:

| Product           | Monthly Price ID        | Annual Price ID        |
| ----------------- | ----------------------- | ---------------------- |
| Epidom POS        | `price_pos_monthly_idr` | `price_pos_annual_idr` |
| Epidom OPERATIONS | `price_ops_monthly_idr` | `price_ops_annual_idr` |
| Epidom ENTERPRISE | `price_ent_monthly_idr` | `price_ent_annual_idr` |

The actual `price_*` IDs go in the env file. Never commit them.

### Test mode setup

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

STRIPE_PRICE_POS_MONTHLY_IDR=price_test_...
STRIPE_PRICE_POS_ANNUAL_IDR=price_test_...
STRIPE_PRICE_OPS_MONTHLY_IDR=price_test_...
STRIPE_PRICE_OPS_ANNUAL_IDR=price_test_...
STRIPE_PRICE_ENT_MONTHLY_IDR=price_test_...
STRIPE_PRICE_ENT_ANNUAL_IDR=price_test_...
```

### Webhook events handled

- `checkout.session.completed` — provision subscription, set plan
- `customer.subscription.updated` — sync plan and status
- `customer.subscription.deleted` — downgrade to FREE, keep data
- `invoice.payment_failed` — set status to `PAST_DUE`, notify merchant
- `invoice.payment_succeeded` — confirm renewal

Webhook handler: `src/app/api/webhooks/stripe/route.ts`. All event handlers are idempotent.

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
