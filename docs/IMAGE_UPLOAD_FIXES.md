# Image Upload Fixes

## Issues Fixed

### 1. ✅ Image Not Loading After Store Creation

**Problem:**

- Image was uploaded to Vercel Blob successfully
- But the image didn't display on the web after creating a store
- The `previewUrl` state wasn't syncing with the `value` prop correctly

**Solution:**
Added `useEffect` to sync the `previewUrl` state with the `value` prop when it changes externally:

```tsx
const previousValueRef = useRef<string | undefined>(value);

useEffect(() => {
  if (value !== previousValueRef.current) {
    setPreviewUrl(value);
    previousValueRef.current = value;
  }
}, [value]);
```

This ensures that when the form is reopened in edit mode with an existing image URL, the preview displays correctly.

### 2. ✅ Duplicate Images in Blob Storage on Update

**Problem:**

- When updating a store image, a new image was uploaded
- But the old image wasn't deleted from Vercel Blob
- This resulted in 2 images in storage (wasting space and costs)
- Even creating a store without an image, then adding one, would create duplicates

**Solution:**
Modified the `uploadImage` function to delete the old image before uploading the new one:

```tsx
const uploadImage = useCallback(
  async (file: File) => {
    const oldImageUrl = value; // Store old image URL

    // Delete old image if exists
    if (oldImageUrl && oldImageUrl.includes("blob.vercel-storage.com")) {
      try {
        await fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: oldImageUrl }),
        });
        console.log("Old image deleted:", oldImageUrl);
      } catch (error) {
        console.warn("Failed to delete old image:", error);
        // Continue with upload even if delete fails
      }
    }

    // ... rest of upload logic
  },
  [value, onChange, toast, previewUrl]
);
```

### 3. ✅ Remove Button Also Deletes from Storage

**Bonus Fix:**
Updated the `handleRemove` function to also delete the image from Blob storage when the user clicks the remove button:

```tsx
const handleRemove = useCallback(async () => {
  const currentUrl = previewUrl || value;

  // Delete from blob storage
  if (currentUrl && currentUrl.includes("blob.vercel-storage.com")) {
    try {
      await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentUrl }),
      });
      console.log("Image deleted from storage:", currentUrl);
    } catch (error) {
      console.warn("Failed to delete image from storage:", error);
    }
  }

  // ... rest of removal logic
}, [previewUrl, value, onChange, toast]);
```

## How It Works Now

### Store Creation Flow

1. User selects an image
2. Image is compressed (60-80% reduction)
3. Image is uploaded to Vercel Blob
4. URL is returned and saved to form state
5. **Preview now stays visible** ✅
6. User submits form with image URL
7. Store is created with the image
8. Image displays correctly on the page ✅

### Store Update Flow

1. User opens edit dialog (existing image displays correctly) ✅
2. User selects a new image
3. **Old image is deleted from Blob first** ✅
4. New image is compressed and uploaded
5. New URL replaces old URL in form
6. User submits form
7. Only 1 image exists in Blob storage ✅

### Image Removal Flow

1. User clicks remove button on image preview
2. **Image is deleted from Blob storage** ✅
3. Image is removed from form state
4. No orphaned images in storage ✅

## Benefits

| Before                               | After                       |
| ------------------------------------ | --------------------------- |
| ❌ Image doesn't show after creation | ✅ Image displays correctly |
| ❌ Duplicate images accumulate       | ✅ Old images auto-deleted  |
| ❌ Storage costs increase            | ✅ Storage usage optimized  |
| ❌ Manual cleanup needed             | ✅ Automatic cleanup        |

## Testing Checklist

- [x] Create store with image → Image displays correctly
- [x] Edit store, upload new image → Old image deleted, new image shows
- [x] Create store without image → No image in storage
- [x] Edit store, add image for first time → Only 1 image in storage
- [x] Remove image → Image deleted from storage
- [x] Upload image, then remove, then upload again → Clean storage

## Storage Optimization

### Before Fix

```
Storage after 3 updates:
- image-1.webp (300 KB) ❌ orphaned
- image-2.webp (280 KB) ❌ orphaned
- image-3.webp (290 KB) ❌ orphaned
- image-4.webp (310 KB) ✅ current
Total: 1.18 MB (only 310 KB needed)
```

### After Fix

```
Storage after 3 updates:
- image-4.webp (310 KB) ✅ current
Total: 310 KB (perfect!)
```

**Result:** 73% storage reduction + no manual cleanup needed!

## Error Handling

All delete operations are wrapped in try-catch blocks:

- If delete fails, upload still continues
- Logs warnings to console for debugging
- User experience is not interrupted
- Graceful degradation if API is unavailable

## Console Logs (for Debugging)

You'll now see helpful logs:

```
✅ Old image deleted: https://...
✅ Image deleted from storage: https://...
⚠️ Failed to delete old image: Error message
```

These help verify the cleanup is working correctly.

## Notes

- Only Vercel Blob URLs are deleted (checked via `includes('blob.vercel-storage.com')`)
- External URLs (if manually entered) are not deleted
- Blob URLs created with `createImagePreview()` are properly revoked
- All state changes are tracked with `previousValueRef` for consistency

---

**Status:** ✅ All issues fixed and tested
**File Modified:** `src/components/shared/image-upload.tsx`
