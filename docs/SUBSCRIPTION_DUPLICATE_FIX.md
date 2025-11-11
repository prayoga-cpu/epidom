# Subscription Duplicate Plan Fix

## Problem

When users upgraded from STARTER to PRO plan (or any plan change), the system was creating a **new Stripe subscription** without canceling the old one. This resulted in:

1. **Multiple active Stripe subscriptions** for the same user
2. **Double billing** - user gets charged for both STARTER and PRO plans
3. **Database inconsistency** - database only shows the latest plan, but Stripe has multiple active subscriptions

## Root Cause

In `src/lib/services/subscription.service.ts` (createCheckoutSession method):

- When a user already had a subscription and requested an upgrade
- The system would reuse the existing Stripe customer ID
- But it would create a **completely new Stripe subscription** via checkout session
- The old subscription was **never canceled** in Stripe

## Solution

### 1. Cancel Old Subscription on Upgrade

**File:** `src/lib/services/subscription.service.ts:75-107`

Added logic to detect and cancel the old Stripe subscription before creating a new checkout session:

```typescript
if (subscription) {
  stripeCustomerId = subscription.stripeCustomerId;

  // IMPORTANT: Cancel old Stripe subscription if upgrading/downgrading
  if (
    subscription.stripeSubscriptionId &&
    subscription.status === SubscriptionStatus.ACTIVE &&
    subscription.plan !== plan
  ) {
    console.log(
      `[Subscription] Canceling old ${subscription.plan} subscription before upgrading to ${plan}`
    );

    // Cancel the old subscription immediately
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);

    // Update database to reflect cancellation
    await this.subscriptionRepo.update(userId, {
      status: SubscriptionStatus.CANCELED,
    });
  }
}
```

**This ensures:**
- Old subscription is canceled in Stripe before creating new one
- No double billing occurs
- Database status is updated to CANCELED

### 2. Improved Webhook Logging

**File:** `src/app/api/webhooks/stripe/route.ts:111-141`

Added logging to track upgrade flow:
- Logs when updating existing subscription (upgrade scenario)
- Logs when creating new subscription (new user scenario)

### 3. Audit & Fix Utility

**File:** `src/lib/services/subscription.service.ts:281-341`

Added `auditAndFixDuplicateSubscriptions()` method to:
1. Check if a user has multiple active Stripe subscriptions
2. Keep the newest subscription
3. Cancel all older duplicate subscriptions
4. Update database to reflect correct subscription

**File:** `src/app/api/subscriptions/audit/route.ts`

Created API endpoint to run the audit for the current user:

```
POST /api/subscriptions/audit
```

## How to Fix Existing Users with Duplicates

If you already have users with duplicate subscriptions, they can be fixed by:

### Option 1: API Call (Recommended)

Users can call the audit endpoint to automatically fix their account:

```bash
# User must be logged in
curl -X POST https://yourdomain.com/api/subscriptions/audit \
  -H "Cookie: your-session-cookie"
```

Response:
```json
{
  "message": "Found and canceled 1 duplicate subscription(s)",
  "duplicatesFound": 1,
  "canceledSubscriptionIds": ["sub_old123"]
}
```

### Option 2: Manual via Stripe Dashboard

1. Go to Stripe Dashboard → Customers
2. Find the customer by email
3. View their subscriptions
4. Cancel the older subscription(s), keep the newest one

### Option 3: Create Admin Tool (Optional)

You could create an admin page that:
1. Lists all users
2. Shows which users have duplicate subscriptions
3. Provides a button to run the audit/fix for each user

## Testing the Fix

### For New Upgrades

1. Create a user and subscribe to STARTER plan
2. Upgrade to PRO plan
3. Verify in Stripe Dashboard:
   - Old STARTER subscription is canceled
   - Only PRO subscription is active
4. Verify no double billing occurs

### For Existing Duplicates

1. Find a user with duplicate subscriptions (check Stripe Dashboard)
2. Call `POST /api/subscriptions/audit` for that user
3. Verify duplicates are canceled
4. Verify only newest subscription remains active

## Prevention

The fix ensures this won't happen again by:

1. **Immediate cancellation** of old subscription when creating new checkout session
2. **Database update** to CANCELED status before creating new subscription
3. **Audit utility** available to detect and fix any future issues

## Database Constraint

Note: The Prisma schema already has a `@unique` constraint on `userId` in the Subscription model:

```prisma
model Subscription {
  userId String @unique
  // ...
}
```

This prevents multiple subscription **records** in the database, but it doesn't prevent multiple active subscriptions in Stripe for the same customer. That's why we needed to add the cancellation logic in the application code.

## Important: Immediate Cancellation

The fix uses **immediate cancellation** with `prorate: false`:

```typescript
await stripe.subscriptions.cancel(subscription.stripeSubscriptionId, {
  prorate: false, // No refund for unused time
});
```

This ensures:
- Old subscription ends **immediately** (not at end of billing period)
- User is not double-billed
- Only one active subscription at a time

## Future Improvements (RECOMMENDED)

**IMPORTANT:** The current approach (cancel + create new) is not ideal. Consider using Stripe's **Subscription Update API** with proration instead. This is the **recommended approach** for subscription upgrades:

```typescript
// Instead of creating new checkout session for upgrades
await stripe.subscriptions.update(subscriptionId, {
  items: [{
    id: subscriptionItem.id,
    price: newPriceId,
  }],
  proration_behavior: 'create_prorations',
});
```

Benefits:
- ✅ Avoids multiple subscriptions entirely
- ✅ Handles proration automatically (charge/credit for partial billing periods)
- ✅ Better user experience (no redirect to checkout page)
- ✅ Keeps same subscription ID (cleaner billing history)
- ✅ User gets charged/credited for the difference immediately

This would require refactoring the upgrade flow to:
1. Detect if user is upgrading vs new subscription
2. For upgrades: Use `stripe.subscriptions.update()` instead of checkout session
3. For new subscriptions: Continue using checkout session
