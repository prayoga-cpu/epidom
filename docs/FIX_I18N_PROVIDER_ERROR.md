# Fix: useI18n Provider Error

## Problem

```
Error: useI18n must be used within I18nProvider
at ProfilePage (src/app/(app)/profile/page.tsx:24:24)
```

The profile page was using `useI18n()` hook but wasn't wrapped in `<I18nProvider>`.

---

## Root Cause

The profile page layout didn't include the `I18nProvider` wrapper:

```tsx
// ❌ BEFORE (profile/layout.tsx)
export default function ProfileLayout({ children }) {
  return <>{children}</>; // No I18nProvider!
}
```

---

## Solution

Updated the profile layout to wrap with `I18nProvider` and add proper UI structure:

```tsx
// ✅ AFTER (profile/layout.tsx)
import { I18nProvider } from "@/components/lang/i18n-provider";
import { SiteHeader } from "@/features/marketing/shared/components/site-header";

export default function ProfileLayout({ children }) {
  return (
    <I18nProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-neutral-50">
        <SiteHeader variant="authenticated" showNav={false} />
        <main className="flex flex-1 flex-col overflow-hidden pt-16 sm:pt-20 md:pt-20">
          {children}
        </main>
      </div>
    </I18nProvider>
  );
}
```

---

## What Changed

### File: `src/app/(app)/profile/layout.tsx`

**Before:**

```tsx
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

**After:**

```tsx
import type { Metadata } from "next";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { SiteHeader } from "@/features/marketing/shared/components/site-header";

export const metadata: Metadata = {
  title: "Profile - EPIDOM",
  description: "Manage your profile and payment settings",
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-neutral-50">
        <SiteHeader variant="authenticated" showNav={false} />
        <main className="flex flex-1 flex-col overflow-hidden pt-16 sm:pt-20 md:pt-20">
          {children}
        </main>
      </div>
    </I18nProvider>
  );
}
```

---

## Provider Hierarchy

Now the provider hierarchy is correct:

```
Root Layout (RootLayout)
  ├─ ErrorBoundary
  ├─ QueryProvider
  └─ SessionProvider
      └─ Profile Layout (ProfileLayout)
          ├─ I18nProvider ✅ (NOW INCLUDED)
          ├─ SiteHeader
          └─ ProfilePage
              ├─ useI18n() ✅ (Can now use this hook)
              ├─ useUser()
              └─ useProfile()
```

---

## Why This Works

1. **I18nProvider** is now in the profile layout
2. **ProfilePage** is now inside I18nProvider
3. **useI18n()** hook can now access the context ✅
4. **useUser()** and **useProfile()** still work as before ✅

---

## Testing

After this fix:

```
1. Go to http://localhost:3001/profile
2. Log in if needed
3. ✅ Page loads without "useI18n must be used within I18nProvider" error
4. ✅ See profile information
5. ✅ See "Payment Setup" section
6. ✅ See "Complete Payment Setup" button
```

---

## Other Similar Layouts

The profile layout now matches the pattern used in:

- `(marketing)/layout.tsx` - Has I18nProvider ✅
- `(app)/(stores)/layout.tsx` - Has I18nProvider ✅
- `store/[storeId]/(dashboard)/layout.tsx` - Check if needs I18nProvider

---

## Summary

✅ Added `I18nProvider` to profile layout
✅ Added `SiteHeader` for consistent UI
✅ Added metadata for page title/description
✅ Maintains same profile page code (no changes needed)

The error should now be resolved! 🎉
