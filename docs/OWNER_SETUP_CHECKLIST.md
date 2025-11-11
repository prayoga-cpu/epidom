# Owner Setup Checklist - Payment System

## Overview

To enable the Stripe payment system, you need to:

1. Create the Epidom owner account
2. Complete Stripe Connect onboarding
3. Test the payment flow

---

## Step 1: Create Owner Account

### What to do:

1. Go to **http://localhost:3001/register**
2. Sign up with the following credentials:
   - **Name**: Epidom Owner (or your name)
   - **Email**: `mrcaoevan@gmail.com` ⚠️ **MUST match EPIDOM_OWNER_EMAIL in .env**
   - **Business Name**: Epidom
   - **Address**: Your address
   - **Password**: Create a strong password

3. Complete registration

### Why this email?

The email **MUST** match `EPIDOM_OWNER_EMAIL` in your `.env` file:

```properties
EPIDOM_OWNER_EMAIL="mrcaoevan@gmail.com"
```

This is how the system identifies the owner when customers subscribe.

### Verify it worked:

- You should see "Account created successfully! Please log in"
- Log in with the credentials you just created

---

## Step 2: Complete Stripe Connect Onboarding

### Prerequisites:

- ✅ Owner account created and logged in
- ✅ Personal Stripe account (create at https://stripe.com if needed)

### What to do:

1. After logging in as owner, go to **Profile**
2. Find the section "**Payment Setup**" or "**Stripe Connection**"
3. Click **"Complete Payment Setup"** or similar button
4. You'll be redirected to Stripe's onboarding page (Stripe-hosted, EU-compliant)
5. Fill in your information:
   - Business type: Individual
   - Personal info
   - Bank account details (French bank for 🇫🇷)
   - Tax ID (if applicable)
6. Submit and wait for Stripe to verify (may take a few minutes)

### Important Notes:

- ✅ Uses **Express Account** (EU-compliant)
- ✅ **Stripe-hosted onboarding** (no custom forms)
- ✅ Automatic approvals usually happen within minutes
- ⏱️ May require additional verification documents

### How to check status:

1. Log in to **https://dashboard.stripe.com**
2. Look for your account status in the Connect section
3. Check if **Charges enabled** ✅ and **Payouts enabled** ✅

---

## Step 3: Test Payment Flow

### Prerequisites:

- ✅ Owner account created and onboarded
- ✅ Stripe Connect account enabled for payouts

### Create Test Customer Account:

1. Go to **http://localhost:3001/register**
2. Sign up with a **different email** (not the owner email)
3. This is your "customer" account for testing

### Make a Test Payment:

1. Log in as the **customer** (not owner)
2. Go to **http://localhost:3001/pricing**
3. Click "Subscribe" on either **Starter** or **Pro** plan
4. You'll be redirected to Stripe Checkout
5. Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/26)
   - CVC: Any 3 digits (e.g., 123)
6. Complete the payment

### Verify Success:

✅ Payment completed
✅ Redirected to `/billing?success=true`
✅ Subscription shows as "ACTIVE"

### Check Stripe Dashboard:

1. Go to **https://dashboard.stripe.com/test/subscriptions**
2. You should see the subscription with:
   - **Status**: Active
   - **Amount**: €29 (Starter) or €79 (Pro)
   - **Customer**: Your customer email

3. Go to **https://dashboard.stripe.com/test/payouts**
4. You should see a payout scheduled (or already transferred) for 80% of the subscription

---

## Troubleshooting

### Error: "Payment system is not configured yet"

**Cause**: Owner account doesn't exist or owner email doesn't match `.env`

**Solution**:

1. Verify `.env` has: `EPIDOM_OWNER_EMAIL="mrcaoevan@gmail.com"`
2. Create owner account with exact matching email
3. Try checkout again

### Error: "Payment system not configured" still appears

**Cause**: Owner account exists but Stripe Connect not onboarded

**Solution**:

1. Log in as owner
2. Go to profile page
3. Complete Stripe Connect onboarding
4. Wait for Stripe approval (usually instant)
5. Try checkout again

### Redirect goes to 404 after login

**Cause**: `callbackUrl` parameter wasn't being read

**Solution**: ✅ **Already fixed!**

- Login form now reads both `next` and `callbackUrl` parameters
- After login from pricing page, you'll be redirected back correctly

### Stripe checkout page is blank

**Cause**: Price IDs in `.env` might be invalid

**Solution**:

1. Go to **https://dashboard.stripe.com/test/products**
2. Verify your price IDs:
   - `NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER`
   - `NEXT_PUBLIC_STRIPE_PRICE_ID_PRO`
3. Update `.env` with correct IDs
4. Restart dev server: `pnpm dev`

---

## Environment Variables Reference

```properties
# REQUIRED: Owner email - must match registered account
EPIDOM_OWNER_EMAIL="mrcaoevan@gmail.com"

# REQUIRED: Stripe test keys from dashboard
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# REQUIRED: Price IDs from Stripe products
NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER="price_..."
NEXT_PUBLIC_STRIPE_PRICE_ID_PRO="price_..."

# OPTIONAL: Revenue split (default: 20% platform, 80% owner)
NEXT_PUBLIC_REVENUE_SPLIT_PLATFORM_PERCENT=20
NEXT_PUBLIC_REVENUE_SPLIT_OWNER_PERCENT=80
```

---

## Summary of Changes Made

### ✅ Fixed in Payment Form

- Login redirect now uses correct callback URL: `/pricing?plan={plan}`
- Supports both `next` and `callbackUrl` query parameters

### ✅ Fixed in Login Form

- Reads `callbackUrl` parameter from pricing page
- Properly redirects back to pricing after successful login

### ✅ Updated in Stripe Connect Service

- Added EU-required business profile fields
- Uses "individual" business type (EU-friendly)
- Includes MCC code for SaaS classification

---

## Payment Flow Diagram

```
Customer on /pricing
    ↓
Clicks "Subscribe to Starter/Pro"
    ↓
Not logged in? → Redirect to /login?callbackUrl=/pricing?plan=starter
    ↓
After login → Redirect to /pricing?plan=starter (customer can click again)
    ↓
Clicks button again → POST /api/subscriptions/checkout
    ↓
Checks: Owner exists? ✅ Owner onboarded? ✅
    ↓
Create Stripe Checkout Session
    ↓
Redirect to Stripe Checkout (hosted)
    ↓
Pay with test card
    ↓
Stripe redirects to /billing?success=true
    ↓
✅ Subscription created with 80/20 split
```

---

## Next Steps

1. ✅ **Owner Account**: Create the account with `mrcaoevan@gmail.com`
2. ✅ **Stripe Connect**: Complete onboarding on profile page
3. ✅ **Test Payment**: Create customer account and subscribe
4. ✅ **Verify Split**: Check Stripe dashboard for 80% payout

Once all steps complete, your payment system is live! 🎉
