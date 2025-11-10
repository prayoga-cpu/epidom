# Profile Page Access Guide

## Overview

There are now **two profile pages** in your app:

### 1. **App-Level Profile** (`/profile`)

- ✅ Accessible **WITHOUT** subscription
- ✅ For all authenticated users
- ✅ Includes: Personal info, Business info, Subscription status, **Stripe Connect setup**
- 📍 Route: `http://localhost:3001/profile`

### 2. **Store-Level Profile** (`/store/[storeId]/dashboard/profile`)

- ⚠️ Requires **ACTIVE** subscription
- 🔐 Protected by dashboard middleware
- 📍 Route: `http://localhost:3001/store/[storeId]/dashboard/profile`

---

## How to Access Profile (Owner Setup)

### For Stripe Connect Onboarding

#### Step 1: Log In

```
URL: http://localhost:3001/login
Email: owner@epidom.com (or whatever EPIDOM_OWNER_EMAIL is set to)
Password: Your password
```

#### Step 2: Go to Profile

```
URL: http://localhost:3001/profile
```

**Or** click on your avatar/profile menu (if available in navigation)

#### Step 3: Complete Stripe Connect

- Scroll down to **"Payment Setup"** section
- Click **"Complete Payment Setup"**
- Fill Stripe form
- Return after approval ✅

---

## What's on the App-Level Profile Page

### Sections (in order):

1. **Profile Header**
   - Your name/avatar
   - Email
   - Account status

2. **Personal Information Card**
   - Name
   - Email
   - Phone (if available)
   - Edit button

3. **Subscription Card**
   - Current plan (Starter/Pro/None)
   - Status (Active/Inactive/None)
   - Renewal date
   - Link to upgrade/manage billing

4. **Business Information Card**
   - Business name
   - Address
   - Tax ID
   - Edit button

5. **Payment Setup Card** ⭐ **IMPORTANT**
   - Stripe Connect status
   - Charges enabled? ✅/❌
   - Payouts enabled? ✅/❌
   - "Complete Payment Setup" button (if not onboarded)
   - "View Earnings" button (if onboarded)

---

## Middleware Configuration

The middleware allows `/profile` without subscription check:

```typescript
// From middleware.ts (line 20)
const allowedPaths = ["/billing", "/pricing", "/payments", "/profile"];
const isAllowedPath = allowedPaths.some((allowedPath) => path.includes(allowedPath));

if (isAllowedPath) {
  return NextResponse.next(); // Skip subscription check
}
```

This means:

- ✅ Owner can access `/profile` to set up Stripe Connect without subscribing first
- ✅ Customers can access `/profile` anytime
- ✅ Everyone needs an account (authentication required)
- ❌ Dashboard routes still require subscription

---

## Subscription-Protected Routes

These routes **require** an active subscription:

```
/dashboard/*
/tracking/*
/data/*
/management/*
/alerts/*
/stores/*
/store/*/dashboard/*
```

---

## Use Cases

### Scenario 1: Owner Setup

```
1. Register account → /register
2. Log in → /login
3. Go to /profile
4. Complete Stripe Connect onboarding
5. ✅ Payment system ready
6. Can now access /stores to create and subscribe
```

### Scenario 2: Customer Trial

```
1. Register account → /register
2. Log in → /login
3. View profile → /profile
4. Go to /pricing
5. Subscribe to plan
6. ✅ Get access to /dashboard and store features
```

### Scenario 3: User Management

```
1. Logged in user can access /profile anytime
2. Update personal/business info
3. View subscription status
4. No need to be in a store dashboard
5. Direct link from any page
```

---

## Summary

| Route                  | Public | Auth Required | Subscription | Purpose                  |
| ---------------------- | ------ | ------------- | ------------ | ------------------------ |
| `/profile`             | ❌     | ✅            | ❌           | Personal & payment setup |
| `/billing`             | ❌     | ✅            | ❌           | Manage subscription      |
| `/pricing`             | ✅     | ❌            | ❌           | View plans               |
| `/dashboard`           | ❌     | ✅            | ✅           | Main app features        |
| `/store/*/dashboard/*` | ❌     | ✅            | ✅           | Store management         |

---

## To Access Profile

1. **Log in first** (required)
2. **Go to**: `http://localhost:3001/profile`
3. **Manage** personal info, subscription, or payment setup
4. **No subscription needed** ✅

That's it! You can now set up payment system without needing a subscription first.
