# Payment Setup Card: Owner Only

## What Changed

The **Payment Setup** card on the profile page is now **only visible to the Epidom owner**.

---

## How It Works

### Check for Owner

```tsx
const epidomOwnerEmail = process.env.NEXT_PUBLIC_EPIDOM_OWNER_EMAIL;
const isOwner = sessionUser?.email === epidomOwnerEmail;
```

### Conditional Rendering

```tsx
{
  isOwner && (
    <div className="mt-8">
      <StripeConnectCard />
    </div>
  );
}
```

---

## User Experience

### For the Owner (e.g., `owner@epidom.com`)

```
Profile Page (/profile)
├─ Profile Header
├─ Personal Information
├─ Business Information
├─ Subscription Status
└─ 🔑 Payment Setup (Stripe Connect) ← VISIBLE ONLY FOR OWNER
```

### For Regular Customers

```
Profile Page (/profile)
├─ Profile Header
├─ Personal Information
├─ Business Information
└─ Subscription Status
   (Payment Setup NOT shown)
```

---

## Configuration

### .env File

```properties
EPIDOM_OWNER_EMAIL="owner@epidom.com"                 # Server-side only
NEXT_PUBLIC_EPIDOM_OWNER_EMAIL="owner@epidom.com"     # Client-side accessible
```

Both are set to the same email for consistency.

---

## Why Two Environment Variables?

- **`EPIDOM_OWNER_EMAIL`** - Used server-side by subscription service
- **`NEXT_PUBLIC_EPIDOM_OWNER_EMAIL`** - Used client-side by profile page to check owner status

---

## Testing

### Test as Owner

1. Log in as: `owner@epidom.com`
2. Go to `/profile`
3. ✅ See "Payment Setup" section
4. ✅ Can complete Stripe Connect onboarding

### Test as Customer

1. Log in as: `customer@test.com` (or any other email)
2. Go to `/profile`
3. ✅ See profile information
4. ❌ Payment Setup section NOT shown

---

## Files Modified

### `/src/app/(app)/profile/page.tsx`

- Added owner check: `const isOwner = sessionUser?.email === epidomOwnerEmail`
- Wrapped StripeConnectCard with `{isOwner && ...}`

### `.env`

- Added: `NEXT_PUBLIC_EPIDOM_OWNER_EMAIL="owner@epidom.com"`

---

## Security Note

⚠️ The owner email is visible on the client side (`NEXT_PUBLIC_` prefix), but this is intentional:

- The card is only shown to that email address
- No sensitive operations are exposed
- All actual Stripe operations are server-side protected

---

## Next Steps

✅ Owner-only Payment Setup card
✅ Customers see normal profile
✅ Ready for Stripe Connect onboarding (owner only)

The profile page is now properly restricted! 🔐
