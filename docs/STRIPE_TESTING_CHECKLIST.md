# Stripe Payment Testing Checklist

## ✅ Pre-Testing Setup

Before you start testing, ensure you've completed:

- [ ] Installed Stripe packages (`pnpm add stripe @stripe/stripe-js @stripe/react-stripe-js`)
- [ ] Added Stripe API keys to `.env` file
- [ ] Created products in Stripe Dashboard (Starter €29, Pro €79)
- [ ] Added price IDs to `.env` file
- [ ] Set `EPIDOM_OWNER_EMAIL` in `.env`
- [ ] Started Stripe webhook forwarding (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`)
- [ ] Copied webhook secret to `.env`
- [ ] Started development server (`pnpm dev`)

---

## 🧪 Test Suite

### 1. Epidom Owner Onboarding (15 minutes)

**Purpose**: Verify the Epidom owner can complete Stripe Connect onboarding to receive 80% of revenue.

- [ ] Register with the email from `EPIDOM_OWNER_EMAIL`
- [ ] Navigate to profile page
- [ ] Verify "Payment Setup" card is displayed
- [ ] Click "Complete Payment Setup" button
- [ ] Verify redirect to Stripe-hosted onboarding page
- [ ] Complete onboarding form with test data:
  - Business name: Test Business
  - Type: Individual or Company
  - Country: France (FR)
  - Bank details: Use Stripe test account `000123456789` (routing `110000000`)
  - Identity: Use test documents if prompted
- [ ] Verify redirect back to profile page
- [ ] Verify "Payment Setup" card now shows "Connected" badge
- [ ] Verify account status shows:
  - Charges: Enabled
  - Payouts: Enabled
  - Account ID: acct_xxx

**Expected Result**: ✅ Epidom owner account is connected and ready to receive 80% of payments.

**API to verify**:
```bash
curl http://localhost:3000/api/connect/status \
  -H "Cookie: next-auth.session-token=..."
```

---

### 2. User Registration & Pricing Redirect (5 minutes)

**Purpose**: Verify new users are directed to pricing page after registration.

- [ ] Navigate to `/register`
- [ ] Fill in registration form:
  - Name: Test User
  - Email: test@example.com
  - Password: password123
  - Business Name: Test Bakery
  - Address: 123 Main St
- [ ] Click "Create Account"
- [ ] Verify redirect to `/login?registered=true&next=/pricing`
- [ ] Verify success toast: "Account created successfully!"
- [ ] Log in with the credentials
- [ ] Verify redirect to `/pricing` page

**Expected Result**: ✅ New users are directed to select a plan after registration.

---

### 3. Starter Plan Subscription (10 minutes)

**Purpose**: Test Starter plan (€29/month, 1 store limit) with 80/20 revenue split.

- [ ] Navigate to `/pricing`
- [ ] Click "Get Started" on Starter plan
- [ ] Verify redirect to `/payments?plan=starter`
- [ ] Verify page shows authentication check if not logged in
- [ ] Click "Proceed to Secure Checkout"
- [ ] Verify redirect to Stripe Checkout page
- [ ] Fill in test payment details:
  - Card: `4242 4242 4242 4242`
  - Expiry: `12/25`
  - CVC: `123`
  - Name: Test User
  - Email: test@example.com
- [ ] Click "Subscribe"
- [ ] Wait for webhook processing
- [ ] Verify redirect to `/billing?success=true&plan=STARTER`
- [ ] Verify success message: "Subscription activated successfully!"

**Stripe Dashboard Verification**:
- [ ] Go to Stripe Dashboard → Payments
- [ ] Find the €29.00 payment
- [ ] Verify:
  - Amount: €29.00
  - Application fee: €5.80 (20%)
  - Transfer: €23.20 (80% to Epidom owner)

**Database Verification**:
```sql
SELECT * FROM subscriptions WHERE status = 'ACTIVE';
-- Should show: plan='STARTER', status='ACTIVE'
```

**Expected Result**: ✅ User subscribed, 80% transferred to Epidom owner, 20% kept as platform fee.

---

### 4. Store Limit Enforcement - Starter Plan (5 minutes)

**Purpose**: Verify Starter plan only allows 1 store.

- [ ] Navigate to `/stores`
- [ ] Click "Create Store"
- [ ] Fill in store details:
  - Name: Store 1
  - Address: 123 Test St
- [ ] Click "Create"
- [ ] Verify store created successfully ✅
- [ ] Try to create a second store
- [ ] Verify error message: "You have reached your plan's store limit (1/1). Upgrade to Pro to add more stores."
- [ ] Verify HTTP 403 status code

**API to test**:
```bash
curl -X POST http://localhost:3000/api/stores \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"name":"Store 2","address":"456 Test St"}'

# Should return 403 error
```

**Expected Result**: ✅ Users on Starter plan cannot create more than 1 store.

---

### 5. Pro Plan Subscription & Multiple Stores (10 minutes)

**Purpose**: Test Pro plan (€79/month, unlimited stores).

**Option A: New User**
- [ ] Register a new user (e.g., pro@example.com)
- [ ] Subscribe to Pro plan (€79/month)
- [ ] Verify payment split: €15.80 (20%) + €63.20 (80%)
- [ ] Create multiple stores (3-5 stores)
- [ ] Verify all stores created successfully ✅

**Option B: Upgrade from Starter**
- [ ] Navigate to `/billing`
- [ ] Click "Upgrade to Pro"
- [ ] Complete upgrade in Stripe Checkout
- [ ] Verify plan updated to PRO
- [ ] Create additional stores (should work now)

**Expected Result**: ✅ Pro users can create unlimited stores.

---

### 6. Billing Page Functionality (5 minutes)

**Purpose**: Verify billing page displays subscription details correctly.

- [ ] Navigate to `/billing`
- [ ] Verify displays:
  - Current plan (STARTER or PRO)
  - Plan status badge (Active)
  - Next billing date
  - Store usage (e.g., "1/1 stores" or "3/Unlimited stores")
- [ ] Click "Manage Payment Methods"
- [ ] Verify redirect to Stripe Customer Portal
- [ ] Verify can update payment method
- [ ] Return to app
- [ ] Click "Cancel Subscription"
- [ ] Confirm cancellation
- [ ] Verify cancellation notice appears
- [ ] Verify subscription marked as `cancelAtPeriodEnd: true`

**Expected Result**: ✅ Users can manage their subscription via billing page.

---

### 7. Subscription Middleware - Dashboard Access (5 minutes)

**Purpose**: Verify users without active subscriptions cannot access dashboard.

- [ ] Create a new user account (no subscription)
- [ ] Try to navigate to `/dashboard`
- [ ] Verify redirect to `/billing?reason=subscription_required`
- [ ] Subscribe to a plan
- [ ] Navigate to `/dashboard` again
- [ ] Verify access granted ✅

**Simulate payment failure**:
- [ ] In Stripe Dashboard, cancel the subscription
- [ ] Wait for webhook to process
- [ ] Try to access `/dashboard`
- [ ] Verify immediate lockout and redirect to `/billing`

**Expected Result**: ✅ Dashboard access requires active subscription.

---

### 8. Plan Downgrade Restrictions (5 minutes)

**Purpose**: Verify users cannot downgrade if they exceed the new plan's store limit.

- [ ] Subscribe to Pro plan
- [ ] Create 3 stores
- [ ] Try to downgrade to Starter (in Stripe Customer Portal)
- [ ] Verify downgrade blocked with message about store limit
- [ ] Delete 2 stores (keep only 1)
- [ ] Try downgrade again
- [ ] Verify downgrade succeeds ✅

**Note**: The downgrade blocking logic is enforced by preventing customers with multiple stores from canceling and resubscribing to Starter.

**Expected Result**: ✅ Users must reduce stores before downgrading.

---

### 9. Webhook Event Processing (10 minutes)

**Purpose**: Verify all webhook events are handled correctly.

Test each event using Stripe CLI:

**Event 1: checkout.session.completed**
```bash
stripe trigger checkout.session.completed
```
- [ ] Check server logs for "[Webhook] Subscription activated"
- [ ] Verify subscription status updated to ACTIVE in database

**Event 2: customer.subscription.updated**
```bash
stripe trigger customer.subscription.updated
```
- [ ] Check logs for "[Webhook] Subscription updated"
- [ ] Verify subscription details updated in database

**Event 3: invoice.payment_succeeded**
```bash
stripe trigger invoice.payment_succeeded
```
- [ ] Check logs for "[Webhook] Payment succeeded"
- [ ] Verify subscription remains ACTIVE

**Event 4: invoice.payment_failed**
```bash
stripe trigger invoice.payment_failed
```
- [ ] Check logs for "[Webhook] Payment failed, user locked out"
- [ ] Verify subscription status changed to PAST_DUE
- [ ] Verify user cannot access dashboard

**Event 5: customer.subscription.deleted**
```bash
stripe trigger customer.subscription.deleted
```
- [ ] Check logs for "[Webhook] Subscription canceled"
- [ ] Verify subscription status changed to CANCELED

**Expected Result**: ✅ All webhook events processed correctly and database updated.

---

### 10. 80/20 Revenue Split Verification (5 minutes)

**Purpose**: Confirm revenue split is working correctly for multiple subscriptions.

- [ ] Create 3 subscriptions:
  - User 1: Starter (€29)
  - User 2: Pro (€79)
  - User 3: Starter (€29)

**Stripe Dashboard - Your Account (Platform)**:
- [ ] Go to Payments
- [ ] Verify 3 payments:
  - €29.00 (fee: €5.80)
  - €79.00 (fee: €15.80)
  - €29.00 (fee: €5.80)
- [ ] Total application fees: €27.40 (20% of €137)

**Stripe Dashboard - Epidom Owner Account**:
- [ ] Switch to Connected Account
- [ ] Go to Payments/Transfers
- [ ] Verify 3 transfers:
  - €23.20 (80% of €29)
  - €63.20 (80% of €79)
  - €23.20 (80% of €29)
- [ ] Total transfers: €109.60 (80% of €137)

**Math Check**:
- Total subscriptions: €137
- Platform (you): €27.40 (20%)
- Epidom owner: €109.60 (80%)
- ✅ Split = €27.40 + €109.60 = €137

**Expected Result**: ✅ Revenue split is accurate at 80/20 ratio.

---

### 11. Edge Cases & Error Handling (10 minutes)

**Test various edge cases**:

- [ ] **User tries to subscribe without Epidom owner onboarding**
  - Expected: Error message "Payment system not configured"

- [ ] **User tries to access billing without subscription**
  - Expected: Shows "No Active Subscription" state

- [ ] **User cancels during Stripe Checkout**
  - Expected: Redirected to `/pricing?canceled=true`

- [ ] **Webhook signature verification fails**
  - Expected: 400 error, logged in server logs

- [ ] **Duplicate checkout session**
  - Expected: Existing subscription updated, not duplicated

- [ ] **User tries to create store without logging in**
  - Expected: 401 Unauthorized error

**Expected Result**: ✅ All edge cases handled gracefully with appropriate errors.

---

### 12. Multi-Language Support (5 minutes)

**Purpose**: Verify billing pages work in all supported languages.

- [ ] Navigate to `/billing`
- [ ] Switch to French (Français)
- [ ] Verify all text is translated
- [ ] Switch to Indonesian (Bahasa)
- [ ] Verify all text is translated
- [ ] Switch back to English
- [ ] Verify all text is in English

**Key areas to check**:
- Billing page labels
- Subscription status messages
- Stripe Connect card text
- Error messages

**Expected Result**: ✅ All billing content is properly translated.

---

## 📊 Final Verification

After completing all tests, verify:

- [ ] All 12 test sections passed ✅
- [ ] No errors in server logs
- [ ] No console errors in browser
- [ ] Database is consistent (run queries below)
- [ ] Stripe Dashboard shows correct payments and transfers

**Database verification queries**:
```sql
-- Check all subscriptions
SELECT
  u.email,
  s.plan,
  s.status,
  s.currentPeriodEnd
FROM subscriptions s
JOIN users u ON s.userId = u.id;

-- Check store counts by user
SELECT
  u.email,
  s.plan,
  COUNT(st.id) as store_count
FROM users u
LEFT JOIN subscriptions s ON u.id = s.userId
LEFT JOIN businesses b ON u.id = b.userId
LEFT JOIN stores st ON b.id = st.businessId AND st.isActive = true
GROUP BY u.id;

-- Check Epidom owner
SELECT
  email,
  stripeConnectAccountId,
  stripeConnectOnboarded
FROM users
WHERE stripeConnectAccountId IS NOT NULL;
```

---

## 🚀 Production Deployment Checklist

Before deploying to production:

- [ ] Switch Stripe Dashboard to Live mode
- [ ] Update `.env` with live Stripe keys
- [ ] Create live products (Starter €29, Pro €79)
- [ ] Update price IDs in `.env`
- [ ] Configure live webhook endpoint in Stripe Dashboard
- [ ] Update webhook secret in production `.env`
- [ ] Epidom owner completes live onboarding (separate from test)
- [ ] Test with real card (small amount)
- [ ] Verify live 80/20 split
- [ ] Monitor webhook deliveries in Stripe Dashboard
- [ ] Set up error alerts (Sentry, LogRocket, etc.)

---

## 🐛 Common Issues & Solutions

### Issue: Webhook signature verification failed

**Solution**:
1. Check `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
2. Restart Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
3. Copy new webhook secret to `.env`

### Issue: Payment succeeded but subscription not activated

**Solution**:
1. Check webhook logs in Stripe Dashboard
2. Check server logs for errors
3. Manually trigger webhook: `stripe trigger checkout.session.completed`

### Issue: 80/20 split not working

**Solution**:
1. Verify Epidom owner completed onboarding
2. Check `stripeConnectAccountId` in database
3. Verify checkout session includes `transfer_data` and `application_fee_percent`

### Issue: Store creation blocked incorrectly

**Solution**:
1. Check subscription status in database
2. Verify `/api/subscriptions/status` returns correct data
3. Check middleware is not caching subscription status

### Issue: Dashboard access lockout after payment failure

**Solution**:
1. This is expected behavior (per requirements)
2. User should update payment method via Stripe Customer Portal
3. Once payment succeeds, access is restored

---

## 📞 Support

If you encounter issues not covered here:

1. Check server logs for detailed error messages
2. Check Stripe Dashboard → Developers → Logs
3. Review webhook events in Dashboard → Developers → Webhooks
4. Check database consistency with SQL queries above
5. Refer to full documentation in `STRIPE_PAYMENT_SETUP.md`

---

**Testing completed**: ___________ (date)

**Tested by**: ___________

**Production ready**: [ ] Yes [ ] No

**Notes**:
_________________________________________
_________________________________________
_________________________________________

---

*Last updated: 2025-11-10*
