# Stripe Payment Quick Start Guide

## TL;DR - Get Up and Running in 10 Minutes

This is a condensed guide to get Stripe payments working quickly. For full details, see [STRIPE_PAYMENT_SETUP.md](./STRIPE_PAYMENT_SETUP.md).

---

## 1. Get Stripe Keys (2 minutes)

1. Go to https://dashboard.stripe.com
2. Toggle **Test mode** ON
3. Go to **Developers → API keys**
4. Copy:
   - Publishable key (`pk_test_...`)
   - Secret key (`sk_test_...`)

---

## 2. Create Products (3 minutes)

**In Stripe Dashboard → Products:**

1. **Create Starter Plan**:
   - Name: `Starter Plan`
   - Price: €29/month (recurring)
   - Copy the **Price ID** (`price_...`)

2. **Create Pro Plan**:
   - Name: `Pro Plan`
   - Price: €79/month (recurring)
   - Copy the **Price ID** (`price_...`)

---

## 3. Update Environment Variables (1 minute)

Add to your `.env` file:

```env
# Stripe Keys
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."  # Get this in Step 4

# Price IDs
NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER="price_..."
NEXT_PUBLIC_STRIPE_PRICE_ID_PRO="price_..."

# Epidom Owner Email (who receives 80%)
EPIDOM_OWNER_EMAIL="your-email@example.com"
```

---

## 4. Setup Webhooks (2 minutes)

**Install Stripe CLI:**
```bash
# Windows
scoop install stripe

# macOS
brew install stripe/stripe-cli/stripe
```

**Login and Forward Webhooks:**
```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook secret (`whsec_...`) and add to `.env`.

---

## 5. Complete Epidom Owner Onboarding (2 minutes)

The Epidom owner must complete Stripe Connect onboarding to receive 80% of revenue.

**Option A: API Call**

```bash
# First, login and get your session cookie
# Then make this call:
curl -X POST http://localhost:3000/api/connect/onboarding \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..."
```

**Option B: Add UI Button** (recommended)

Add this to your profile page:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function StripeConnectButton() {
  const [loading, setLoading] = useState(false);

  const handleOnboarding = async () => {
    setLoading(true);
    const res = await fetch("/api/connect/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url; // Redirect to Stripe onboarding
    }
    setLoading(false);
  };

  return (
    <Button onClick={handleOnboarding} disabled={loading}>
      {loading ? "Loading..." : "Complete Payment Setup"}
    </Button>
  );
}
```

Click the button and complete the Stripe-hosted onboarding form.

---

## 6. Test the Payment Flow

1. **Start the server**:
   ```bash
   pnpm dev
   ```

2. **Register a new user**:
   - Go to http://localhost:3000/register
   - Complete registration

3. **Select a plan**:
   - Go to http://localhost:3000/pricing
   - Click "Get Started" on Starter or Pro

4. **Complete checkout**:
   - Click "Proceed to Secure Checkout"
   - Use test card: `4242 4242 4242 4242`
   - Expiry: `12/25`, CVC: `123`

5. **Verify success**:
   - You should be redirected to `/billing?success=true`
   - Check Stripe Dashboard → Payments (you'll see the payment)
   - Check Stripe Dashboard → Connect → Transfers (80% transferred to owner)

---

## 7. Verify 80/20 Split

**In Stripe Dashboard:**

1. Go to **Payments**
2. Click on the payment you just made
3. You should see:
   - **Amount**: €29.00 (or €79.00)
   - **Application fee**: €5.80 (20% of €29) or €15.80 (20% of €79)
   - **Transfer**: €23.20 (80% of €29) or €63.20 (80% of €79)

**In Connect Dashboard:**

1. Go to **Connect → Accounts**
2. Click on the Epidom owner's account
3. You should see the transfer of 80%

---

## Test Checklist

Quick tests to run:

- [ ] User can subscribe to Starter plan
- [ ] User can create 1 store on Starter
- [ ] User blocked from creating 2nd store on Starter
- [ ] User can subscribe to Pro plan
- [ ] User can create multiple stores on Pro
- [ ] 80% transferred to Epidom owner
- [ ] 20% kept as platform fee

---

## Common Issues

### "Payment system not configured"

**Problem**: Epidom owner hasn't completed onboarding.

**Solution**: Complete Step 5 above.

### Webhook signature verification failed

**Problem**: Wrong webhook secret.

**Solution**:
1. Check `STRIPE_WEBHOOK_SECRET` in `.env`
2. Restart Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
3. Copy the new secret to `.env`

### Store creation not blocked

**Problem**: Subscription not active.

**Solution**:
1. Check database: `SELECT * FROM subscriptions WHERE userId = 'xxx';`
2. Check subscription status is `ACTIVE`
3. Verify webhook received `checkout.session.completed` event

---

## Next Steps

- [ ] Build billing page UI ([see docs](./STRIPE_PAYMENT_SETUP.md#81-billing-page))
- [ ] Add subscription middleware ([see docs](./STRIPE_PAYMENT_SETUP.md#83-subscription-middleware))
- [ ] Add translations for billing ([see docs](./STRIPE_PAYMENT_SETUP.md#85-translations))
- [ ] Test downgrade flow
- [ ] Test cancellation flow
- [ ] Deploy to production

---

## Production Deployment

When ready for production:

1. **Switch to Live Mode** in Stripe Dashboard
2. **Get Live API Keys** (start with `pk_live_` and `sk_live_`)
3. **Create Live Products** (repeat Step 2 in live mode)
4. **Add Production Webhook**:
   - Go to Developers → Webhooks → Add endpoint
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Select events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
   - Copy webhook secret
5. **Update Production `.env`** with live keys
6. **Epidom Owner Onboarding** (must complete again in live mode)
7. **Test with Real Card** (small amount first!)

---

## Resources

- **Full Setup Guide**: [STRIPE_PAYMENT_SETUP.md](./STRIPE_PAYMENT_SETUP.md)
- **Stripe Test Cards**: https://stripe.com/docs/testing
- **Stripe Dashboard**: https://dashboard.stripe.com
- **Stripe Documentation**: https://stripe.com/docs

---

*Last updated: 2025-11-10*
