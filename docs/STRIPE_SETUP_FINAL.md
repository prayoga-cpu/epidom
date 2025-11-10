# Stripe Payment Setup - Starter & Pro Plans

## Overview

Complete guide to setting up Stripe payments with two subscription plans and an 80/20 revenue split for the Epidom platform. Enterprise customers contact sales for custom pricing.

### Pricing Plans

| Plan           | Price     | Stores    | Description                                |
| -------------- | --------- | --------- | ------------------------------------------ |
| **Starter**    | €29/month | 1         | Perfect for single location restaurants    |
| **Pro**        | €79/month | Unlimited | For growing multi-location operations      |
| **Enterprise** | Custom    | Unlimited | For large-scale operations (contact sales) |

### Revenue Split (All Plans)

- **You (Developer)**: 20% as platform fee
- **Epidom Owner**: 80% via automatic Stripe Transfer

---

## Step 1: Create Stripe Products & Prices

### 1.1 Login to Stripe Dashboard

Go to https://dashboard.stripe.com and toggle **Test mode ON**.

### 1.2 Create Starter Plan

**Path**: Products → Add product

- **Name**: `Starter Plan`
- **Description**: `Perfect for single location restaurants`
- **Price**: €29.00
- **Billing period**: Monthly (recurring)
- **Save product**
- **Copy Price ID** (e.g., `price_1QXxx1234567890`)

### 1.3 Create Pro Plan

- **Name**: `Pro Plan`
- **Description**: `For growing multi-location operations`
- **Price**: €79.00
- **Billing period**: Monthly (recurring)
- **Save product**
- **Copy Price ID** (e.g., `price_1QYxx1234567890`)

---

## Step 2: Update Environment Variables

Update your `.env` file:

```env
# Stripe Keys
STRIPE_SECRET_KEY="sk_test_xxxxx"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_xxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxx"

# Stripe Price IDs (from Step 1)
NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER="price_1QXxx1234567890"
NEXT_PUBLIC_STRIPE_PRICE_ID_PRO="price_1QYxx1234567890"

# Epidom Owner Configuration
EPIDOM_OWNER_EMAIL="owner@epidom.com"

# Stripe Revenue Split
NEXT_PUBLIC_REVENUE_SPLIT_PLATFORM_PERCENT=20
NEXT_PUBLIC_REVENUE_SPLIT_OWNER_PERCENT=80
```

---

## Step 3: Setup Webhooks (Local Development)

### 3.1 Install Stripe CLI

```bash
# Windows (using Scoop)
scoop install stripe

# macOS
brew install stripe/stripe-cli/stripe

# Or download from https://github.com/stripe/stripe-cli/releases
```

### 3.2 Login & Forward Webhooks

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook secret to `.env`:

```env
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxxxxxxxxxx"
```

---

## Step 4: Plan Limits Implementation

### 4.1 Plan Configuration

Create: `src/lib/config/plan-limits.ts`

```typescript
/**
 * Plan limits configuration
 * Defines store limits for each subscription plan
 */

export const PLAN_LIMITS = {
  STARTER: {
    name: "Starter",
    storeLimit: 1,
    price: 2900, // €29.00 in cents
  },
  PRO: {
    name: "Pro",
    storeLimit: Infinity, // Unlimited
    price: 7900, // €79.00 in cents
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

/**
 * Get store limit for a given plan
 */
export function getStoreLimit(plan: PlanType): number {
  return PLAN_LIMITS[plan]?.storeLimit ?? 1;
}

/**
 * Check if a user can create a store based on their subscription
 */
export function canCreateStore(currentPlan: PlanType, currentStoreCount: number): boolean {
  const limit = getStoreLimit(currentPlan);
  return currentStoreCount < limit;
}
```

### 4.2 Store Creation Validation

In your store creation API route (`src/app/api/stores/route.ts`):

```typescript
import { canCreateStore, getStoreLimit, type PlanType } from "@/lib/config/plan-limits";
import { db } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's subscription
  const subscription = await db.subscription.findUnique({
    where: { userId: session.user.id },
  });

  if (!subscription || subscription.status !== "ACTIVE") {
    return Response.json({ error: "No active subscription" }, { status: 403 });
  }

  // Get current store count
  const storeCount = await db.store.count({
    where: {
      business: {
        userId: session.user.id,
      },
      isActive: true,
    },
  });

  // Check if user can create more stores
  const plan = subscription.plan as PlanType;
  if (!canCreateStore(plan, storeCount)) {
    const limit = getStoreLimit(plan);
    const upgradeText = plan === "STARTER" ? "Pro" : "Enterprise";
    return Response.json(
      {
        error: `You have reached your plan's store limit (${storeCount}/${limit}). Upgrade to ${upgradeText} to add more stores.`,
        code: "STORE_LIMIT_EXCEEDED",
        currentLimit: limit,
        currentCount: storeCount,
      },
      { status: 403 }
    );
  }

  // ... rest of store creation logic ...
}
```

---

## Step 5: Payment Flow Implementation

### 5.1 Checkout Page

Create: `src/app/(app)/payments/page.tsx`

```typescript
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";

const PLAN_CONFIG = {
  starter: {
    name: "Starter",
    price: "€29",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER,
    features: ["1 Store", "Basic Analytics", "Email Support"],
  },
  pro: {
    name: "Pro",
    price: "€79",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO,
    features: ["Unlimited Stores", "Advanced Analytics", "Priority Support"],
  },
};

export default function PaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  const plan = (searchParams.get("plan") || "pro") as keyof typeof PLAN_CONFIG;
  const config = PLAN_CONFIG[plan];

  if (status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p>Please log in to continue</p>
          <Button onClick={() => router.push("/login")}>Login</Button>
        </div>
      </div>
    );
  }

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-12">Complete Your Subscription</h1>

        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-4">{config.name}</h2>
          <div className="text-4xl font-bold mb-6">
            {config.price}<span className="text-lg">/month</span>
          </div>

          <ul className="space-y-3 mb-8">
            {config.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                {feature}
              </li>
            ))}
          </ul>

          <Button
            onClick={handleCheckout}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Processing..." : "Proceed to Secure Checkout"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 5.2 Checkout API Route

Create: `src/app/api/checkout/route.ts`

```typescript
import { stripe } from "@/lib/stripe";
import { getServerSession } from "next-auth/next";
import { db } from "@/lib/prisma";

const PRICE_MAP = {
  starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER!,
  pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO!,
};

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan } = await request.json();

  const priceId = PRICE_MAP[plan as keyof typeof PRICE_MAP];

  if (!priceId) {
    return Response.json({ error: "Invalid plan" }, { status: 400 });
  }

  try {
    // Get or create Stripe customer
    let customers = await stripe.customers.list({
      email: session.user.email,
      limit: 1,
    });

    let customerId = customers.data[0]?.id;

    if (!customerId) {
      const newCustomer = await stripe.customers.create({
        email: session.user.email,
      });
      customerId = newCustomer.id;
    }

    // Get Epidom owner's Connect account
    const owner = await db.user.findUnique({
      where: { email: process.env.EPIDOM_OWNER_EMAIL! },
      select: { stripeConnectAccountId: true },
    });

    if (!owner?.stripeConnectAccountId) {
      return Response.json({ error: "Payment system not configured" }, { status: 500 });
    }

    // Get price info
    const price = await stripe.prices.retrieve(priceId);
    const amount = price.unit_amount || 0;

    // Create checkout session with 80/20 split
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXTAUTH_URL}/billing?success=true&plan=${plan.toUpperCase()}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/pricing?canceled=true`,
      subscription_data: {
        metadata: {
          userId: session.user.id,
          plan: plan.toUpperCase(),
        },
      },
      // 80/20 revenue split
      payment_intent_data: {
        transfer_data: {
          destination: owner.stripeConnectAccountId,
        },
        application_fee_amount: Math.round(amount * 0.2), // 20% fee
      },
    });

    return Response.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return Response.json({ error: "Checkout failed" }, { status: 500 });
  }
}
```

---

## Step 6: Webhook Handler

Create: `src/app/api/webhooks/stripe/route.ts`

```typescript
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/prisma";
import { headers } from "next/headers";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  const body = await request.text();
  const signature = headers().get("stripe-signature")!;

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;

        // Create subscription in database
        await db.subscription.upsert({
          where: { userId },
          create: {
            userId,
            plan,
            status: "ACTIVE",
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            amount: session.amount_total,
            currency: (session.currency || "eur").toUpperCase(),
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          update: {
            plan,
            status: "ACTIVE",
            stripeSubscriptionId: session.subscription,
          },
        });

        console.log(`[Webhook] Subscription activated for user ${userId} (${plan})`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as any;

        await db.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: subscription.status.toUpperCase(),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });

        console.log(`[Webhook] Subscription updated: ${subscription.id}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;

        await db.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: { status: "CANCELED" },
        });

        console.log(`[Webhook] Subscription canceled: ${subscription.id}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;

        await db.subscription.updateMany({
          where: { stripeSubscriptionId: invoice.subscription },
          data: { status: "PAST_DUE" },
        });

        console.log(`[Webhook] Payment failed for subscription: ${invoice.subscription}`);
        break;
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
```

---

## Step 7: Subscription Middleware

Create/Update: `src/middleware.ts`

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { db } from "@/lib/prisma";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });

  // Redirect to login if not authenticated
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Check subscription for dashboard/store routes
  if (request.nextUrl.pathname.startsWith("/store")) {
    const subscription = await db.subscription.findUnique({
      where: { userId: token.sub },
    });

    if (!subscription || subscription.status !== "ACTIVE") {
      return NextResponse.redirect(new URL("/billing?reason=subscription_required", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/store/:path*"],
};
```

---

## Step 8: Stripe Connect Setup (Epidom Owner - 80% Recipient)

### 8.1 Onboarding Endpoint

Create: `src/app/api/connect/onboarding/route.ts`

```typescript
import { stripe } from "@/lib/stripe";
import { getServerSession } from "next-auth/next";
import { db } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only allow Epidom owner
  if (session.user.email !== process.env.EPIDOM_OWNER_EMAIL) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // Create Connect account if doesn't exist
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    });

    let accountId = user?.stripeConnectAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: session.user.email,
      });
      accountId = account.id;

      await db.user.update({
        where: { id: session.user.id },
        data: { stripeConnectAccountId: accountId },
      });
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${process.env.NEXTAUTH_URL}/profile`,
      return_url: `${process.env.NEXTAUTH_URL}/profile?connected=true`,
    });

    return Response.json({ url: accountLink.url });
  } catch (error) {
    console.error("Onboarding error:", error);
    return Response.json({ error: "Onboarding failed" }, { status: 500 });
  }
}
```

### 8.2 Status Endpoint

Create: `src/app/api/connect/status/route.ts`

```typescript
import { stripe } from "@/lib/stripe";
import { getServerSession } from "next-auth/next";
import { db } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession();

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.email !== process.env.EPIDOM_OWNER_EMAIL) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { stripeConnectAccountId: true },
    });

    if (!user?.stripeConnectAccountId) {
      return Response.json({
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      });
    }

    const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

    return Response.json({
      onboardingComplete: account.charges_enabled,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      accountId: user.stripeConnectAccountId,
    });
  } catch (error) {
    console.error("Status check error:", error);
    return Response.json({ error: "Status check failed" }, { status: 500 });
  }
}
```

---

## Step 9: Enterprise Plan - Contact Sales

On your pricing page, the Enterprise plan should redirect to a contact form or dedicated contact page.

Update `src/features/marketing/pricing/components/pricing-cards.tsx`:

```tsx
// For Enterprise button:
<Button asChild className="w-full rounded-lg bg-transparent" variant="outline">
  <Link href="/contact">{t("pricing.plans.enterprise.select")}</Link>
</Button>
```

---

## Step 10: Testing

### 10.1 Test Starter Plan (1 Store Limit)

```bash
# 1. Register new user
# 2. Go to /payments?plan=starter
# 3. Checkout with test card: 4242 4242 4242 4242
# 4. Verify success: /billing?success=true&plan=STARTER
# 5. Create store #1 → Success ✓
# 6. Try store #2 → Error: "Store limit reached (1/1)" ✗
```

### 10.2 Test Pro Plan (Unlimited Stores)

```bash
# 1. Register new user
# 2. Go to /payments?plan=pro
# 3. Checkout with test card: 4242 4242 4242 4242
# 4. Verify success: /billing?success=true&plan=PRO
# 5. Create store #1 → Success ✓
# 6. Create store #2 → Success ✓
# 7. Create store #3 → Success ✓ (unlimited)
```

### 10.3 Test Enterprise Redirect

```bash
# 1. On pricing page, click Enterprise "Get Started"
# 2. Should redirect to /contact ✓
```

### 10.4 Verify 80/20 Split

**In Stripe Dashboard:**

1. Go to **Payments**
2. Find your test payment
3. Verify:
   - Amount: €29.00 (or €79.00)
   - Application fee: €5.80 (or €15.80) = 20%
4. Go to **Connect → Transfers**
5. Verify transfer of 80% to Epidom owner

---

## Testing Checklist

- [ ] Starter plan checkout works
- [ ] Pro plan checkout works
- [ ] Enterprise redirects to contact
- [ ] Starter users limited to 1 store
- [ ] Pro users can create multiple stores
- [ ] 80/20 revenue split verified in Stripe Dashboard
- [ ] Webhooks are processing correctly
- [ ] Subscription middleware blocks non-subscribers

---

## Production Deployment

When deploying to production:

1. **Switch Stripe to Live Mode**
   - Get live keys: `pk_live_...` and `sk_live_...`

2. **Create Live Products**
   - Repeat Step 1 in live mode
   - Copy live price IDs

3. **Update Production .env**

   ```env
   STRIPE_SECRET_KEY="sk_live_..."
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
   NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER="price_..."
   NEXT_PUBLIC_STRIPE_PRICE_ID_PRO="price_..."
   ```

4. **Setup Live Webhook**
   - Stripe Dashboard → Developers → Webhooks → Add endpoint
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Copy live webhook secret

5. **Epidom Owner Live Onboarding**
   - Must complete again in live mode (separate from test)

6. **Test with Real Card** (small amount)

---

## Environment Variables Reference

```env
# Stripe API Keys
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Stripe Price IDs
NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER="price_..."
NEXT_PUBLIC_STRIPE_PRICE_ID_PRO="price_..."

# Epidom Owner (receives 80%)
EPIDOM_OWNER_EMAIL="owner@epidom.com"

# Revenue Split
NEXT_PUBLIC_REVENUE_SPLIT_PLATFORM_PERCENT=20
NEXT_PUBLIC_REVENUE_SPLIT_OWNER_PERCENT=80

# App URLs
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."
```

---

## Summary

✅ **Starter**: €29/month, 1 store
✅ **Pro**: €79/month, unlimited stores
✅ **Enterprise**: Custom pricing, contact sales
✅ **Revenue Split**: 80% Epidom owner, 20% platform fee
✅ **Fully Automated**: Stripe webhooks handle everything

_Last Updated: 2025-11-10_
