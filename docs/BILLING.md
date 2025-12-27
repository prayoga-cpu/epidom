# Subscription & Billing

## Overview

EPIDOM uses **Stripe** for subscription management and payments.

## Subscription Plans

| Plan           | Price  | Stores    | Products  | Features               |
| -------------- | ------ | --------- | --------- | ---------------------- |
| **Starter**    | €29/mo | 1         | 500       | Basic features         |
| **Pro**        | €79/mo | Unlimited | Unlimited | All features + Reports |
| **Enterprise** | Custom | Unlimited | Unlimited | Custom integrations    |

---

## Stripe Integration

### Required Environment Variables

```env
STRIPE_SECRET_KEY="sk_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER="price_..."
NEXT_PUBLIC_STRIPE_PRICE_ID_PRO="price_..."
```

---

## Subscription Flows

### 1. New Subscription (Checkout)

```
User → Click "Subscribe" → POST /api/subscriptions/checkout
                                    ↓
                          Create Stripe Checkout Session
                                    ↓
                          Redirect to Stripe Checkout
                                    ↓
                          User completes payment
                                    ↓
                          Stripe Webhook → subscription.created
                                    ↓
                          Update database subscription
```

### 2. Card Validation (Setup Intent)

For promotional periods with free access:

```typescript
// POST /api/subscriptions/setup
const session = await stripe.checkout.sessions.create({
  mode: "setup", // No charge
  payment_method_types: ["card"],
  metadata: { userId, promotion: "new_year_2025" },
});
```

### 3. Cancel Subscription

```typescript
// POST /api/subscriptions/cancel
await stripe.subscriptions.update(subscriptionId, {
  cancel_at_period_end: true,
});
```

### 4. Customer Portal

```typescript
// POST /api/subscriptions/portal
const session = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: `${APP_URL}/profile`,
});
```

---

## Webhook Handling

The webhook endpoint handles all Stripe events:

```
POST /api/webhooks/stripe
```

**Handled Events:**

| Event                           | Action                           |
| ------------------------------- | -------------------------------- |
| `checkout.session.completed`    | Create/update subscription       |
| `customer.subscription.created` | Update subscription status       |
| `customer.subscription.updated` | Sync period dates, cancel status |
| `customer.subscription.deleted` | Mark as canceled                 |
| `invoice.payment_succeeded`     | Ensure ACTIVE status             |
| `invoice.payment_failed`        | Mark as PAST_DUE                 |

---

## Plan Limits Enforcement

Limits are enforced at the service layer:

```typescript
// Check store limit before creating
async createStore(userId: string, data: CreateStoreInput) {
  const subscription = await subscriptionRepo.findByUserId(userId);
  const limit = getStoreLimit(subscription?.plan || 'STARTER');
  const current = await storeRepo.count({ businessId });

  if (current >= limit) {
    throw new StoreLimitExceededError(current, limit);
  }

  return storeRepo.create(data);
}
```

---

## Subscription Status Check

```typescript
// GET /api/subscriptions/status
{
  "hasSubscription": true,
  "subscription": {
    "plan": "PRO",
    "status": "ACTIVE",
    "currentPeriodEnd": "2025-02-01T00:00:00.000Z",
    "cancelAtPeriodEnd": false
  },
  "storeUsage": {
    "current": 2,
    "limit": Infinity,
    "canCreateMore": true
  }
}
```

---

## Stripe Connect (Optional)

For marketplace functionality:

```typescript
// Create Connect account
const account = await stripe.accounts.create({
  type: "express",
  country: "FR",
});

// Generate onboarding link
const link = await stripe.accountLinks.create({
  account: account.id,
  type: "account_onboarding",
  return_url: `${APP_URL}/profile?connect=success`,
  refresh_url: `${APP_URL}/profile?connect=refresh`,
});
```

---

## Testing

### Stripe CLI

```bash
# Listen to webhooks locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### Test Cards

| Card Number      | Description        |
| ---------------- | ------------------ |
| 4242424242424242 | Successful payment |
| 4000000000009995 | Insufficient funds |
| 4000000000000341 | Attach fails       |
