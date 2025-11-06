# Image Upload - Quick Setup Guide

## 🚀 Quick Start

### 1. Install Dependencies

Already done! ✅

```bash
pnpm add browser-image-compression @vercel/blob
```

### 2. Set Up Environment Variables

Add to your `.env.local`:

```env
# Required: Vercel Blob Storage Token
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxx

# Optional: Choose storage provider (default: vercel-blob)
STORAGE_PROVIDER=vercel-blob
```

### 3. Get Your Vercel Blob Token

#### Option A: Using Vercel CLI (Recommended)

```bash
# Login to Vercel
vercel login

# Link your project
vercel link

# Pull environment variables
vercel env pull .env.local
```

#### Option B: Using Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project
3. Navigate to **Storage** → **Create Database** → **Blob**
4. Copy the `BLOB_READ_WRITE_TOKEN`
5. Add to `.env.local`

### 4. Restart Dev Server

```bash
pnpm dev
```

## ✅ Verify Installation

1. Go to your store creation/edit form
2. You should see the new image upload component
3. Try uploading an image
4. Check the browser console for compression logs

## 📝 What Was Implemented

### New Files Created (7 files)

1. **`src/lib/storage/storage-adapter.interface.ts`**
   - Storage adapter interface definition
   - Allows swapping between providers

2. **`src/lib/storage/vercel-blob-adapter.ts`**
   - Vercel Blob implementation
   - Handles upload/delete operations

3. **`src/lib/storage/index.ts`**
   - Factory function to get storage adapter
   - Centralizes provider switching

4. **`src/lib/utils/image-compression.ts`**
   - Client-side image compression
   - Compresses 60-80% before upload
   - Converts to WebP format

5. **`src/components/shared/image-upload.tsx`**
   - Reusable upload component
   - Drag & drop, preview, progress

6. **`src/app/api/upload/route.ts`**
   - Upload API endpoint
   - Session validation, file validation

7. **`docs/IMAGE_UPLOAD_IMPLEMENTATION.md`**
   - Complete documentation

### Files Modified (1 file)

1. **`src/features/stores/stores/components/store-form.tsx`**
   - Replaced text input with ImageUpload component
   - Now has drag & drop image upload

## 🎯 Usage Example

```tsx
import { ImageUpload } from "@/components/shared/image-upload";

<ImageUpload
  value={imageUrl}
  onChange={(url) => setImageUrl(url)}
  disabled={isLoading}
  maxSize={5}
  aspectRatio="16/9"
/>;
```

## 🔄 How to Switch Storage Providers (Future)

### To Cloudflare R2:

1. Create `src/lib/storage/cloudflare-r2-adapter.ts`
2. Implement `StorageAdapter` interface
3. Update `src/lib/storage/index.ts` factory
4. Set `STORAGE_PROVIDER=cloudflare-r2` in `.env.local`

**No changes to components or API routes needed!** ✨

## 📊 Features

- ✅ Drag & drop upload
- ✅ Image preview
- ✅ Automatic compression (60-80% size reduction)
- ✅ WebP conversion
- ✅ Progress indicator
- ✅ Error handling with toasts
- ✅ File validation (type, size)
- ✅ Session security
- ✅ Accessible (keyboard, screen reader)
- ✅ Modular (swap storage providers)

## 🐛 Troubleshooting

### Error: "Storage service is not configured"

**Solution:** Add `BLOB_READ_WRITE_TOKEN` to `.env.local` and restart dev server.

### Error: Upload fails with 401

**Solution:** User needs to log in. Session expired.

### Images not appearing

**Solution:** Check if `BLOB_READ_WRITE_TOKEN` has write permissions.

## 📚 Full Documentation

See `docs/IMAGE_UPLOAD_IMPLEMENTATION.md` for:

- Complete architecture diagram
- API documentation
- Migration guides
- Performance benchmarks
- Testing checklist

## 🎉 Next Steps

1. Set up `BLOB_READ_WRITE_TOKEN` in `.env.local`
2. Restart dev server
3. Test uploading an image in store form
4. Deploy to Vercel (env vars sync automatically)

---

**Need help?** Check the full documentation or open an issue!
