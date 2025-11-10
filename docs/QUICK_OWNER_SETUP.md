# Quick Navigation for Owner Setup

## TL;DR - Go to Profile

```
1. Log in: http://localhost:3001/login
2. Go to: http://localhost:3001/profile
3. Click: "Complete Payment Setup"
4. Fill: Stripe form
5. ✅ Done!
```

---

## Key URLs

### For Owner (Payment Setup)

```
Register:         http://localhost:3001/register
Login:            http://localhost:3001/login
Profile:          http://localhost:3001/profile ← Complete Stripe Connect here
```

### For Testing Payments

```
Pricing:          http://localhost:3001/pricing
Billing:          http://localhost:3001/billing?success=true (after payment)
```

### After Subscription (Dashboard)

```
Stores:           http://localhost:3001/stores
Dashboard:        http://localhost:3001/store/[storeId]/dashboard
Profile (store):  http://localhost:3001/store/[storeId]/dashboard/profile
```

---

## What to Do Now

### Step 1: Log In as Owner

```
Email: owner@epidom.com
Go to: /profile
```

### Step 2: Click "Complete Payment Setup"

Button is in the **Payment Setup** card at the bottom

### Step 3: Stripe Takes Over

- You're redirected to Stripe's secure page
- Fill business & bank info
- Stripe approves (usually instant)

### Step 4: Back to /profile

- See ✅ "Charges: Enabled"
- See ✅ "Payouts: Enabled"
- Ready to accept payments!

---

## That's It!

Your app now supports:

- ✅ Owner payment setup without subscription
- ✅ Customer subscriptions
- ✅ Automatic 80/20 revenue split
- ✅ Full profile management

Happy testing! 🚀
