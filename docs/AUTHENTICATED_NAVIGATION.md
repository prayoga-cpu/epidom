# Updated: Authenticated Navigation in Site Header

## What Changed

The `SiteHeader` component now shows different navigation based on user authentication status:

### Before ❌

- Always showed: Home, Services, Pricing, Contact (landing pages)
- No distinction between authenticated and unauthenticated users

### After ✅

- **Landing (unauthenticated)**: Home, Services, Pricing, Contact
- **Authenticated**: My Stores, Profile, Pricing

---

## How It Works

The header uses the `variant` prop to determine navigation:

```tsx
<SiteHeader variant="landing" />     // Shows: Home, Services, Pricing, Contact
<SiteHeader variant="authenticated" /> // Shows: My Stores, Profile, Pricing
```

---

## Navigation Changes

### Landing (Default)

```
Logo | Home | Services | Pricing | Contact | [Waitlist] [Language]
```

### Authenticated

```
Logo | My Stores | Profile | Pricing | [Logout] [Language]
```

---

## Where It's Used

### With `variant="landing"`

- Homepage (`/`)
- Marketing pages (Services, Pricing)
- Public pages (Pricing page for unauthenticated users)

### With `variant="authenticated"`

- Profile page (`/profile`)
- Stores page (`/stores`) - Already has this header!
- Store dashboard pages

---

## Desktop Navigation

✅ Shows 3 links for authenticated users: **My Stores | Profile | Pricing**
✅ Shows 4 links for landing: **Home | Services | Pricing | Contact**
✅ Active page is highlighted with bold and glow effect

---

## Mobile Navigation (Hamburger Menu)

✅ Same navigation items as desktop
✅ Icons added for each navigation item
✅ Responsive sheet menu works on all screen sizes

---

## Profile Navigation Integration

The profile page now has **two levels of navigation**:

1. **Site Header** (at the top)
   - Shows: Logo, My Stores, Profile, Pricing, Logout, Language

2. **Profile Nav** (below header)
   - Shows: Profile (active), My Stores (link to stores)

This provides quick access to jump between profile and stores!

---

## Example Usage in Components

```tsx
// In profile layout
<SiteHeader variant="authenticated" showNav={true} />

// In stores layout
<SiteHeader variant="authenticated" showNav={true} />

// In marketing layout
<SiteHeader variant="landing" showNav={true} />
```

---

## Navigation Structure

```
App Flow:
┌─────────────────────────────────────┐
│ Site Header (variant="authenticated") │
│ Logo | My Stores | Profile | Pricing  │
│              [Logout]                 │
└─────────────────────────────────────┘
           ↓         ↓          ↓
    ┌────────┐  ┌─────────┐  ┌─────────┐
    │ Stores │  │ Profile │  │ Pricing │
    │ page   │  │  page   │  │  page   │
    │        │  │         │  │  (free) │
    └────────┘  └─────────┘  └─────────┘
         ↓            ↓
    ┌──────────────────────────┐
    │ Profile Nav              │
    │ Profile | My Stores      │
    └──────────────────────────┘
         ↓
    ┌──────────────────────────┐
    │ Profile Content:         │
    │ - Personal Info          │
    │ - Business Info          │
    │ - Subscription Status    │
    │ - Payment Setup (Stripe) │
    └──────────────────────────┘
```

---

## Summary

✅ **Site Header** now adapts based on authentication state
✅ **Authenticated users** see: My Stores, Profile, Pricing
✅ **Landing visitors** see: Home, Services, Pricing, Contact
✅ **Mobile menu** includes all navigation items with icons
✅ **Active page** is highlighted for better UX

Navigation is now clean and context-aware! 🎉
