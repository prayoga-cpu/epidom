# Subscription Fix Summary

## Issues Fixed

### 1. ✅ Database Schema Error
**Problem:** Missing `stripeConnectAccountId` column causing profile endpoint to crash

**Fix:**
- Added missing Stripe Connect columns to database
- Fixed schema relation (User has ONE subscription, not many)
- Added proper unique constraints

**Changes:**
```prisma
// User model - line 33
subscription Subscription? // Changed from: subscriptions Subscription[]

// Subscription model - lines 108-109
userId String @unique
stripeCustomerId String @unique
```

### 2. ✅ Webhook Creating Duplicate Records
**Problem:** Modified webhook was trying to CREATE new subscription records, violating unique constraint

**Fix:**
- Reverted webhook to UPDATE existing subscription (not create new one)
- Database has `userId @unique` constraint - only ONE subscription per user

**File:** `src/app/api/webhooks/stripe/route.ts:111-127`

### 3. ✅ Multiple Active Subscriptions in Stripe
**Problem:** User has STARTER + PRO + PRO all active in Stripe

**Solution Created:**
- New endpoint: `POST /api/subscriptions/cleanup`
- New endpoint: `GET /api/subscriptions/debug`
- New endpoint: `POST /api/subscriptions/sync`

## What You Need to Do Now

### Step 1: Restart Dev Server
The Prisma client needs to regenerate. Stop and restart your dev server:

```bash
# Stop current server (Ctrl+C)
pnpm dev
```

### Step 2: Clean Up Your Stripe Subscriptions

Run these commands in order:

#### A. Debug (See what's wrong)
```bash
GET /api/subscriptions/debug
```

This shows:
- All subscriptions in Stripe
- Current database state
- What's mismatched

#### B. Preview Fix (Dry Run)
```bash
POST /api/subscriptions/cleanup?dryRun=true
```

This shows what will be done WITHOUT doing it.

#### C. Actually Fix It
```bash
POST /api/subscriptions/cleanup
```

This will:
- ✅ Keep your newest PRO subscription
- ❌ Cancel STARTER immediately
- ❌ Cancel duplicate PRO immediately
- ✅ Update database to PRO + ACTIVE

### Step 3: Verify Fix

After cleanup, check:
1. Profile page shows PRO + ACTIVE
2. Stripe Dashboard shows only 1 active subscription
3. No errors in console

## From Browser Console

```javascript
// See current state
const debug = await fetch('/api/subscriptions/debug').then(r => r.json());
console.log(debug);

// Preview what will be done
const preview = await fetch('/api/subscriptions/cleanup?dryRun=true', {
  method: 'POST'
}).then(r => r.json());
console.log(preview);

// Actually fix it
const result = await fetch('/api/subscriptions/cleanup', {
  method: 'POST'
}).then(r => r.json());
console.log(result);

// Refresh page
window.location.reload();
```

## Files Modified

1. ✅ `prisma/schema.prisma` - Fixed relation and added unique constraints
2. ✅ `src/app/api/webhooks/stripe/route.ts` - Fixed to UPDATE not CREATE
3. ✅ `src/lib/services/subscription.service.ts` - Removed premature CANCELED status update
4. ✅ `src/app/api/subscriptions/cleanup/route.ts` - NEW: Cleanup duplicates
5. ✅ `src/app/api/subscriptions/debug/route.ts` - NEW: Debug tool
6. ✅ `src/app/api/subscriptions/sync/route.ts` - NEW: Sync with Stripe
7. ✅ `src/app/api/subscriptions/audit/route.ts` - NEW: Audit tool

## Expected Final State

### Database
```
User: youruser@email.com
└─ Subscription
   ├─ plan: PRO
   ├─ status: ACTIVE
   └─ stripeSubscriptionId: sub_newest123
```

### Stripe
```
Customer: youruser@email.com
└─ Subscriptions
   ├─ PRO ($49/mo) - ACTIVE ✅
   ├─ PRO ($49/mo) - CANCELED ❌
   └─ STARTER ($19/mo) - CANCELED ❌
```

## Prevention

Going forward, the fix ensures:
1. ✅ Old subscription cancels IMMEDIATELY on upgrade
2. ✅ Webhook updates existing record (not create new)
3. ✅ Database enforces ONE subscription per user
4. ✅ Cleanup tools available if issues occur

## Need Help?

If cleanup fails or you see errors, share the output from:
```bash
GET /api/subscriptions/debug
```
