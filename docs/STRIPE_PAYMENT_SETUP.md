# Stripe Payment & Subscription Setup Guide

## Overview

This document provides a complete guide to setting up Stripe payments with an 80/20 revenue split for the Epidom platform.

### Payment Flow Summary

1. **User Registration**: User signs up on Epidom
2. **Plan Selection**: User selects Starter (€29/month) or Pro (€79/month)
3. **Stripe Checkout**: User is redirected to Stripe's secure checkout page
4. **Payment Processing**: Stripe processes the payment
5. **Revenue Split (Automatic)**:
   - **You (Developer)**: Receive 20% of subscription revenue as platform fee
   - **Epidom Owner**: Receives 80% via automatic Stripe Transfer
6. **Subscription Activation**: Webhook activates subscription in database
7. **Store Access**: User can create stores based on their plan limit

### Plan Limits

- **Starter (€29/month)**: 1 store maximum
- **Pro (€79/month)**: Unlimited stores
- **Enterprise**: Custom (contact sales)

---

## Prerequisites

Before you start, ensure you have:

1. A Stripe account (sign up at https://stripe.com)
2. Access to the Stripe Dashboard
3. Node.js and pnpm installed
4. PostgreSQL database running
5. Epidom owner's email address

---

## Step 1: Stripe Account Setup

### 1.1 Create or Log Into Your Stripe Account

Go to https://dashboard.stripe.com and log in with your developer account.

### 1.2 Enable Test Mode

Toggle "Test mode" in the top right corner. You'll use test mode for development and testing.

### 1.3 Get Your API Keys

1. Go to **Developers → API keys**
2. Copy the following keys:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

### 1.4 Create Products and Prices

1. Go to **Products → Add product**
2. Create two products:

**Starter Plan:**
- Name: `Starter Plan`
- Description: `Perfect for single location restaurants`
- Pricing:
  - Type: Recurring
  - Price: €29.00 EUR
  - Billing period: Monthly
- Click **Save product**
- **Copy the Price ID** (starts with `price_`)

**Pro Plan:**
- Name: `Pro Plan`
- Description: `For growing multi-location operations`
- Pricing:
  - Type: Recurring
  - Price: €79.00 EUR
  - Billing period: Monthly
- Click **Save product**
- **Copy the Price ID** (starts with `price_`)

---

## Step 2: Environment Configuration

### 2.1 Update `.env` File

Create or update your `.env` file with the following:

```env
# Stripe Configuration
STRIPE_SECRET_KEY="sk_test_your_secret_key_here"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_your_publishable_key_here"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret_here"  # Get this in Step 3

# Stripe Price IDs (from products you created)
NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER="price_xxxxxxxxx"
NEXT_PUBLIC_STRIPE_PRICE_ID_PRO="price_xxxxxxxxx"

# Epidom Owner Configuration
# This is the email of the Epidom business owner who will receive 80% of revenue
EPIDOM_OWNER_EMAIL="owner@epidom.com"
```

**IMPORTANT**: Replace all placeholder values with your actual Stripe keys and price IDs.

---

## Step 3: Webhook Configuration

### 3.1 Install Stripe CLI (for local testing)

```bash
# Windows (using Scoop)
scoop install stripe

# macOS
brew install stripe/stripe-cli/stripe

# Or download from https://github.com/stripe/stripe-cli/releases
```

### 3.2 Login to Stripe CLI

```bash
stripe login
```

This will open your browser to authorize the CLI.

### 3.3 Forward Webhooks to Local Server (Development)

In a separate terminal, run:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

You'll see output like:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

**Copy the webhook secret** and add it to your `.env` file as `STRIPE_WEBHOOK_SECRET`.

### 3.4 Test Webhook Delivery

In another terminal, trigger a test event:

```bash
stripe trigger checkout.session.completed
```

Check your server logs to verify the webhook was received.

### 3.5 Production Webhook Setup

When deploying to production:

1. Go to **Developers → Webhooks → Add endpoint**
2. Enter your endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
3. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Click **Add endpoint**
5. **Copy the webhook signing secret** and update your production `.env` file

---

## Step 4: Epidom Owner Stripe Connect Onboarding

The Epidom owner (who receives 80% of revenue) must complete Stripe Connect onboarding.

### 4.1 Run the Development Server

```bash
pnpm dev
```

### 4.2 Login as Epidom Owner

1. Go to http://localhost:3000/register
2. Register with the email you set in `EPIDOM_OWNER_EMAIL`
3. Complete registration

### 4.3 Start Stripe Connect Onboarding

Make an API call to initiate onboarding:

```bash
# Get session token first by logging in, then:
curl -X POST http://localhost:3000/api/connect/onboarding \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{}'
```

Or create a simple UI button in the profile page (see Step 8).

### 4.4 Complete Onboarding

1. Click the onboarding link returned by the API
2. Fill in business details on Stripe's hosted onboarding page
3. Complete verification (Stripe may require documents in test mode)
4. You'll be redirected back to your app

### 4.5 Verify Onboarding Status

Check if onboarding is complete:

```bash
curl http://localhost:3000/api/connect/status \
  -H "Cookie: your-session-cookie"
```

You should see:
```json
{
  "onboardingComplete": true,
  "chargesEnabled": true,
  "payoutsEnabled": true
}
```

---

## Step 5: Testing the Payment Flow

### 5.1 Register a Test User

1. Go to http://localhost:3000/register
2. Register with a test email (NOT the Epidom owner email)
3. Complete registration

### 5.2 Navigate to Pricing Page

Go to http://localhost:3000/pricing

### 5.3 Select a Plan

Click "Get Started" on either Starter or Pro plan.

### 5.4 Proceed to Checkout

On the payment page, click "Proceed to Secure Checkout".

### 5.5 Complete Stripe Checkout

You'll be redirected to Stripe's checkout page.

**Test Card Numbers**:
- **Success**: `4242 4242 4242 4242`
- **Requires Authentication**: `4000 0025 0000 3155`
- **Declined**: `4000 0000 0000 9995`

**Other Details**:
- Expiry: Any future date (e.g., 12/25)
- CVC: Any 3 digits (e.g., 123)
- Name: Any name
- Email: Any email

### 5.6 Verify Payment Success

After successful payment:
1. You'll be redirected to `/billing?success=true`
2. Check Stripe Dashboard → Payments (you should see the payment)
3. Check Stripe Dashboard → Connect → Transfers (you should see 80% transferred to Epidom owner)
4. Check your database: `SELECT * FROM subscriptions WHERE userId = 'xxx';`

---

## Step 6: Verify 80/20 Split

### 6.1 Check Platform Revenue (Your 20%)

1. Go to Stripe Dashboard → Payments
2. Find the subscription payment
3. You should see: **Application fee: €5.80** (20% of €29 Starter plan)

### 6.2 Check Epidom Owner Revenue (80%)

1. Switch to the connected account:
   - Stripe Dashboard → Connect → Accounts
   - Click on the Epidom owner's account
2. Go to Payments
3. You should see: **Transfer: €23.20** (80% of €29)

### 6.3 Verify in Database

```sql
-- Check subscription
SELECT * FROM subscriptions WHERE status = 'ACTIVE';

-- Check Epidom owner's Connect account
SELECT id, email, "stripeConnectAccountId", "stripeConnectOnboarded"
FROM users
WHERE email = 'owner@epidom.com';
```

---

## Step 7: Testing Store Limits

### 7.1 Test Starter Plan (1 Store Limit)

1. Subscribe to Starter plan (€29/month)
2. Go to http://localhost:3000/stores
3. Create your first store → Success ✓
4. Try to create a second store → Error: "You have reached your plan's store limit (1/1)"

### 7.2 Test Pro Plan (Unlimited Stores)

1. Subscribe to Pro plan (€79/month) or upgrade
2. Go to http://localhost:3000/stores
3. Create multiple stores → All succeed ✓

### 7.3 Test Upgrade Flow

1. Start with Starter plan (1 store created)
2. Try to create a second store → Blocked
3. Upgrade to Pro via billing page
4. Try again → Success ✓

### 7.4 Test Downgrade Block

1. Subscribe to Pro plan
2. Create 3 stores
3. Try to downgrade to Starter → Blocked (you have 3 stores, limit is 1)
4. Delete 2 stores (keep 1)
5. Try again → Success ✓

---

## Step 8: UI Implementation (Remaining Tasks)

The following UI components still need to be built:

### 8.1 Billing Page

**File**: `src/app/(app)/(dashboard)/billing/page.tsx`

**Features**:
- Display current plan and status
- Show store usage (e.g., "1/1 stores used")
- Next billing date
- Upgrade/downgrade buttons
- Cancel subscription button
- Link to Stripe Customer Portal

**API Calls**:
- `GET /api/subscriptions/status` - Get subscription details
- `POST /api/subscriptions/portal` - Open Stripe Customer Portal
- `POST /api/subscriptions/cancel` - Cancel subscription

### 8.2 Stripe Connect Onboarding UI (for Epidom Owner)

**File**: `src/features/dashboard/profile/components/stripe-connect-setup.tsx`

**Features**:
- Check onboarding status on page load
- Show "Complete Payment Setup" button if not onboarded
- Display "Connected" badge if onboarded
- Link to Stripe Dashboard for viewing earnings

**API Calls**:
- `GET /api/connect/status` - Check onboarding status
- `POST /api/connect/onboarding` - Generate onboarding link
- `POST /api/connect/dashboard` - Get dashboard login link

### 8.3 Subscription Middleware

**File**: `src/middleware.ts`

**Purpose**: Block access to dashboard if subscription is inactive

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });

  // Check if accessing dashboard
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    if (!token) {
      // Not logged in - redirect to login
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // TODO: Check subscription status
    // If subscription is INACTIVE or PAST_DUE, redirect to /billing
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/stores/:path*"],
};
```

### 8.4 Post-Registration Redirect

**File**: `src/features/auth/register/components/register-form.tsx`

After successful registration, redirect to pricing page:

```typescript
// After successful registration:
router.push("/pricing");
```

### 8.5 Translations

**Files**: `src/locales/en.ts`, `fr.ts`, `id.ts`

Add translation keys for:
- Billing page labels
- Subscription status messages
- Store limit warnings
- Upgrade prompts

---

## Step 9: Production Deployment

### 9.1 Switch to Live Mode

1. In Stripe Dashboard, toggle **Test mode OFF**
2. Go to **Developers → API keys**
3. Copy **Live keys** (start with `pk_live_` and `sk_live_`)
4. Update production `.env` with live keys

### 9.2 Create Live Products

Repeat Step 1.4 in **Live mode** to create live products and prices.

### 9.3 Configure Live Webhooks

Repeat Step 3.5 to add webhook endpoint for production.

### 9.4 Epidom Owner Live Onboarding

The Epidom owner must complete onboarding again in live mode (test and live are separate).

### 9.5 Deploy Application

```bash
# Build
pnpm build

# Deploy to your hosting provider (Vercel, Railway, etc.)
```

### 9.6 Verify Live Payments

Use real card details to test a live payment. Start with a small amount to verify the split works correctly.

---

## Troubleshooting

### Payment Not Creating Subscription

**Problem**: User completes payment, but subscription isn't activated.

**Solution**:
1. Check webhook is configured correctly
2. Check webhook logs in Stripe Dashboard → Developers → Webhooks
3. Check server logs for webhook errors
4. Verify `STRIPE_WEBHOOK_SECRET` is correct

### 80/20 Split Not Working

**Problem**: Revenue isn't being split correctly.

**Solution**:
1. Verify Epidom owner completed Stripe Connect onboarding
2. Check `stripeConnectAccountId` is saved in database
3. Check checkout session includes `application_fee_percent: 20` and `transfer_data`
4. Verify in Stripe Dashboard → Connect → Transfers

### Store Creation Not Blocked

**Problem**: User can create more stores than their plan allows.

**Solution**:
1. Verify subscription is active in database
2. Check `POST /api/stores` route includes limit validation
3. Verify `subscriptionService.canCreateStore()` is working

### Webhook Signature Verification Failed

**Problem**: Webhooks are failing with signature errors.

**Solution**:
1. Verify `STRIPE_WEBHOOK_SECRET` matches the one in Stripe Dashboard
2. Ensure webhook secret is from the correct endpoint (test vs. live)
3. Check that Next.js isn't parsing the request body (App Router handles this automatically)

---

## Testing Checklist

Before going to production, test the following:

- [ ] User can register and login
- [ ] User is redirected to pricing page after registration
- [ ] User can subscribe to Starter plan
- [ ] Payment succeeds and subscription is activated
- [ ] 80% is transferred to Epidom owner's account
- [ ] 20% is kept as application fee
- [ ] User can create 1 store on Starter plan
- [ ] User is blocked from creating a 2nd store on Starter
- [ ] User can upgrade to Pro plan
- [ ] User can create unlimited stores on Pro
- [ ] User cannot downgrade with too many stores
- [ ] User can cancel subscription
- [ ] User is locked out when payment fails
- [ ] Epidom owner can complete Stripe Connect onboarding
- [ ] Epidom owner can view their earnings in Stripe Dashboard

---

## API Endpoints Reference

### Subscription Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/subscriptions/checkout` | Create Stripe Checkout session |
| POST | `/api/subscriptions/portal` | Create Customer Portal session |
| POST | `/api/subscriptions/cancel` | Cancel subscription |
| GET | `/api/subscriptions/status` | Get subscription status |

### Stripe Connect Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/connect/onboarding` | Generate onboarding link |
| GET | `/api/connect/status` | Check onboarding status |
| POST | `/api/connect/dashboard` | Get dashboard login link |

### Webhook Endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/stripe` | Handle Stripe events |

---

## Support & Resources

- **Stripe Documentation**: https://stripe.com/docs
- **Stripe Connect Guide**: https://stripe.com/docs/connect
- **Stripe Testing**: https://stripe.com/docs/testing
- **Webhook Events**: https://stripe.com/docs/api/events/types

---

## Security Best Practices

1. **Never commit `.env` file**: Add to `.gitignore`
2. **Use environment variables**: Never hardcode API keys
3. **Verify webhook signatures**: Always validate Stripe webhook signatures
4. **Use HTTPS in production**: Required for Stripe webhooks
5. **Implement rate limiting**: Prevent abuse of checkout endpoint
6. **Log security events**: Track failed payments, subscription changes
7. **Regular security audits**: Review Stripe Dashboard logs

---

## Maintenance

### Regular Tasks

- **Monitor failed payments**: Check Stripe Dashboard → Failed payments
- **Review transfers**: Verify 80/20 split is working correctly
- **Check webhook health**: Ensure webhooks are being delivered
- **Update dependencies**: Keep Stripe SDK updated
- **Backup database**: Regular backups of subscription data

### Troubleshooting Resources

- **Stripe Logs**: Dashboard → Developers → Logs
- **Webhook Events**: Dashboard → Developers → Webhooks → Events
- **API Requests**: Dashboard → Developers → API requests
- **Connect Activity**: Dashboard → Connect → Activity

---

## Changelog

### Version 1.0.0 - Initial Implementation

- ✅ Stripe Checkout integration
- ✅ 80/20 revenue split via Stripe Connect
- ✅ Subscription webhooks
- ✅ Store limit enforcement (Starter: 1, Pro: unlimited)
- ✅ Database schema for subscriptions
- ✅ API routes for subscription management
- ⏳ Billing page UI (pending)
- ⏳ Stripe Connect onboarding UI (pending)
- ⏳ Subscription middleware (pending)

---

*Generated on: 2025-11-10*
