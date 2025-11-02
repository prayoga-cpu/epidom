# Profile Page TanStack Query Migration

## Overview

Migrated the profile page and related components from manual `fetch` calls with `useState` to TanStack Query for better caching, automatic refetching, and state management.

## Changes Made

### 1. Created Profile Hooks (`src/features/dashboard/profile/hooks/use-profile.ts`)

**New hooks:**

- `useProfile()` - Fetches and caches profile data
  - Query key: `["profile", userId]`
  - Stale time: 5 minutes
  - Garbage collection time: 10 minutes
  - Automatically enabled when user is authenticated

- `useUpdateProfile()` - Mutation for updating user profile
  - Automatically updates cache on success
  - Returns mutation state (isPending, isError, etc.)

- `useUpdateBusiness()` - Mutation for updating business info
  - Automatically updates cache on success
  - Returns mutation state (isPending, isError, etc.)

**Benefits:**

- Automatic caching - profile data is cached and reused
- Background refetching - data stays fresh automatically
- Optimistic updates - cache is updated immediately on mutation success
- No need for manual `refetch()` calls in most cases

### 2. Updated Profile Page (`src/app/(app)/store/[storeId]/(dashboard)/profile/page.tsx`)

**Before:**

```tsx
const [profileData, setProfileData] = useState<ProfileData | null>(null);
const [loading, setLoading] = useState(true);

const fetchProfileData = async () => {
  // Manual fetch logic...
};

useEffect(() => {
  if (!sessionLoading && sessionUser) {
    fetchProfileData();
  }
}, [sessionLoading, sessionUser]);
```

**After:**

```tsx
const { data: profileData, isLoading, isError, refetch } = useProfile();

// No useEffect needed - hook handles everything!
```

**Improvements:**

- Removed 20+ lines of boilerplate code
- Automatic loading and error states
- Better error handling with `isError` flag
- Cache is shared across the app

### 3. Updated Edit Personal Info Dialog (`src/features/dashboard/profile/components/edit-personal-info-dialog.tsx`)

**Changes:**

- Replaced manual `fetch` call with `useUpdateProfile()` hook
- Changed from `useToast()` to `toast` from Sonner
- Changed `form.formState.isSubmitting` to `updateProfile.isPending`
- Made `onUpdate` prop optional (cache updates automatically)

**Before:**

```tsx
const response = await fetch("/api/user/profile", {
  method: "PATCH",
  // ...
});
// Manual error handling, manual cache invalidation
```

**After:**

```tsx
await updateProfile.mutateAsync(data);
// Automatic cache update, cleaner error handling
```

### 4. Updated Edit Business Info Dialog (`src/features/dashboard/profile/components/edit-business-info-dialog.tsx`)

**Changes:**

- Replaced manual `fetch` call with `useUpdateBusiness()` hook
- Changed from `useToast()` to `toast` from Sonner
- Changed `form.formState.isSubmitting` to `updateBusiness.isPending`
- Made `onUpdate` prop optional (cache updates automatically)

### 5. Updated Card Components

**PersonalInfoCard & BusinessInfoCard:**

- Made `onUpdate` prop optional (no longer required)
- Cache updates automatically when mutations succeed

## Benefits of TanStack Query

1. **Automatic Caching**
   - Profile data is fetched once and cached
   - Subsequent page visits use cached data
   - No unnecessary API calls

2. **Smart Refetching**
   - Refetches on window focus
   - Refetches on network reconnect
   - Configurable stale time prevents excessive refetching

3. **Better UX**
   - Faster page loads (cached data)
   - Loading states handled automatically
   - Error states handled automatically

4. **Cleaner Code**
   - No manual state management
   - No useEffect dependencies to worry about
   - No manual error handling boilerplate

5. **Automatic Cache Updates**
   - Mutations automatically update the cache
   - No need to manually refetch data
   - UI updates immediately after successful mutations

## Migration Pattern

This pattern can be applied to other pages:

```tsx
// 1. Create hooks file
export const useDataName = () => {
  return useQuery({
    queryKey: ["dataName", id],
    queryFn: fetchData,
    staleTime: 5 * 60 * 1000,
  });
};

export const useUpdateDataName = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateData,
    onSuccess: (data) => {
      queryClient.setQueryData(["dataName", id], data);
    },
  });
};

// 2. Use in component
const { data, isLoading, isError } = useDataName();
const updateData = useUpdateDataName();

// 3. In forms
await updateData.mutateAsync(formData);
```

## Testing Checklist

- [ ] Profile page loads correctly
- [ ] Profile data is cached (check Network tab - no duplicate requests)
- [ ] Edit personal info updates immediately
- [ ] Edit business info updates immediately
- [ ] Loading states work correctly
- [ ] Error states display properly
- [ ] Toast notifications show on success/error
- [ ] Cache persists across page navigation

## Notes

- The `onUpdate` prop is now optional but still supported for backward compatibility
- TanStack Query automatically handles cache updates, so manual refetch is rarely needed
- The `refetch` function is still available if manual refetching is needed
