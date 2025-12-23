---
description: How to setup and test the paywall / card validation flow
---

# Paywall Setup & Testing Guide

This document explains how to setup and test the paywall flow where users must validate their card to get free PRO access until Dec 31, 2025.

## Architecture Overview

```
User clicks "Start for Free"
        ↓
Register Page (/register)
        ↓
Auto-login
        ↓
Onboarding Page (/onboarding)
        ↓
Stripe Checkout (Setup Mode)
        ↓
Card Validated (no charge)
        ↓
Webhook creates subscription
        ↓
Success Page (/onboarding/success)
        ↓
Dashboard (/dashboard)
```

## Files Created/Modified

| File                                        | Purpose                                      |
| ------------------------------------------- | -------------------------------------------- |
| `src/app/api/subscriptions/setup/route.ts`  | API to create Stripe Setup Mode checkout     |
| `src/app/(app)/onboarding/page.tsx`         | Card validation page                         |
| `src/app/(app)/onboarding/success/page.tsx` | Success page after validation                |
| `src/app/api/webhooks/stripe/route.ts`      | Handles checkout.session.completed (updated) |
| `src/features/auth/hooks/use-auth.ts`       | Auto-login after register (updated)          |
| `src/middleware.ts`                         | Added /onboarding to public routes           |

---

## Step 1: Environment Variables

Make sure you have these in your `.env` or `.env.local`:

```env
# Stripe Keys (use TEST mode keys for development)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# NextAuth
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
```

---

## Step 2: Setup Stripe Webhook

### For Local Development (using Stripe CLI)

// turbo

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli

// turbo 2. Login to Stripe CLI:

```bash
stripe login
```

// turbo 3. Forward webhooks to your local server:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

4. Copy the webhook signing secret (starts with `whsec_`) and add it to your `.env.local`

### For Production (Stripe Dashboard)

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter your production URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select these events:
   - `checkout.session.completed` (REQUIRED for paywall)
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. Copy the signing secret and add it to your production environment variables

---

## Step 3: Testing the Flow

### Test Cards (Stripe Test Mode)

| Card Number           | Scenario              |
| --------------------- | --------------------- |
| `4242 4242 4242 4242` | Successful validation |
| `4000 0000 0000 0002` | Card declined         |
| `4000 0000 0000 9995` | Insufficient funds    |

Use any future expiry date (e.g., 12/28) and any 3-digit CVC.

### Manual Testing Steps

1. **Start dev server:**

   ```bash
   pnpm dev
   ```

2. **Start Stripe webhook listener:**

   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

3. **Go to homepage:** http://localhost:3000

4. **Click "Start for Free"**

5. **Register a new account:**
   - Fill in name, email, password
   - Submit

6. **You should be auto-logged in and redirected to /onboarding**

7. **Click "Add Card & Get PRO Access"**

8. **In Stripe Checkout:**
   - Enter test card: `4242 4242 4242 4242`
   - Any future expiry, any CVC
   - Click "Set up"

9. **You should be redirected to /onboarding/success**

10. **After 5 seconds, auto-redirect to /dashboard**

11. **Verify in database:**
    ```sql
    SELECT * FROM subscriptions WHERE user_id = 'your-user-id';
    ```
    Should show:
    - plan: PRO
    - status: ACTIVE
    - current_period_end: 2025-12-31

---

## Step 4: Troubleshooting

### Webhook not received

- Check Stripe CLI is running
- Verify webhook secret in `.env`
- Check browser console for errors

### User not redirected after Stripe

- Check that webhook is processing correctly
- Look for errors in terminal/logs

### Subscription not created

- Check webhook handler logs
- Verify Stripe event is `checkout.session.completed`
- Ensure `session.mode === "setup"` and `promotion === "new_year_2025"` in metadata

---

## Important Notes

1. **This promotion ends Dec 31, 2025** - Users get PRO until that date
2. **Card is NOT charged** - Only validated via SetupIntent
3. **Card is saved** - For future charges if user continues after promo
4. **If user skips** - They get limited access (defined by your feature flags)
