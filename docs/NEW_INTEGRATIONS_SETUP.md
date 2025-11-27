# Setup Integrasi Baru - Dependencies & Environment Variables

## 📋 Overview

Dokumen ini menjelaskan integrasi baru yang ditambahkan di local workspace yang memerlukan:
1. Install dependencies
2. Setup environment variables
3. Konfigurasi external services

---

## 🔴 Integrasi yang MEMERLUKAN Setup

### 1. ✅ **Sentry** - Error Tracking & Monitoring

**Dependencies:** Sudah terinstall ✅
```json
"@sentry/nextjs": "^10.26.0"
```

**Environment Variables (OPTIONAL tapi Recommended):**

```env
# Sentry DSN (Public key untuk client-side)
NEXT_PUBLIC_SENTRY_DSN="https://xxx@sentry.io/xxx"

# Sentry Org & Project (untuk source maps upload saat build)
SENTRY_ORG="your-org-name"
SENTRY_PROJECT="your-project-name"
SENTRY_AUTH_TOKEN="your-auth-token"
```

**Setup Steps:**
1. Create account di [sentry.io](https://sentry.io)
2. Create new project → Next.js
3. Copy DSN → set `NEXT_PUBLIC_SENTRY_DSN`
4. (Optional) Generate auth token untuk source maps:
   - Settings → Auth Tokens → Create New Token
   - Scopes: `project:read`, `project:releases`, `org:read`
   - Copy token → set `SENTRY_AUTH_TOKEN`
5. Set `SENTRY_ORG` dan `SENTRY_PROJECT` dari project settings

**Status:**
- ✅ Code sudah integrated
- ⚠️ Env vars **OPTIONAL** (Sentry akan disabled jika tidak ada DSN)
- ✅ Fallback ke in-memory logging jika Sentry tidak ada

**Files:**
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `src/instrumentation.ts`
- `src/lib/logger.ts` (uses Sentry)
- `src/components/error-boundary.tsx` (uses Sentry)

---

### 2. ⚠️ **Upstash Redis** - Rate Limiting (OPTIONAL)

**Dependencies:** Sudah terinstall ✅
```json
"@upstash/ratelimit": "^2.0.7",
"@upstash/redis": "^1.35.6"
```

**Environment Variables (OPTIONAL):**

```env
# Upstash Redis REST API
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxx"
```

**Setup Steps:**
1. Create account di [upstash.com](https://upstash.com)
2. Create Redis Database
3. Copy REST URL → set `UPSTASH_REDIS_REST_URL`
4. Copy REST Token → set `UPSTASH_REDIS_REST_TOKEN`

**Status:**
- ✅ Code sudah integrated
- ✅ **HAS FALLBACK** - Akan menggunakan in-memory rate limiting jika Upstash tidak ada
- ⚠️ Env vars **OPTIONAL** - App akan tetap berjalan tanpa ini
- ✅ Rate limiting tetap bekerja (in-memory) untuk development

**Files:**
- `src/lib/middleware/rate-limit.ts`
- `src/config/rate-limit.config.ts`
- `src/app/api/stores/[id]/materials/route.ts` (uses rate limiting)

**Fallback Behavior:**
- Jika `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` tidak ada
- Akan menggunakan `InMemoryRateLimiter` class
- Cocok untuk development (single server)
- Untuk production, recommended pakai Upstash (shared state across servers)

---

## 🟡 Integrasi yang TIDAK PERLU Setup

### 3. ✅ **Vitest & Testing Libraries** - Testing Infrastructure

**Dependencies:** Sudah terinstall ✅ (devDependencies)
```json
"vitest": "^4.0.12",
"@testing-library/react": "^16.3.0",
"@testing-library/jest-dom": "^6.9.1",
"@vitest/coverage-v8": "^4.0.12"
```

**Environment Variables:** TIDAK PERLU ❌

**Status:**
- ✅ Sudah terinstall sebagai devDependencies
- ✅ Hanya digunakan untuk testing (`pnpm test`)
- ✅ Tidak mempengaruhi production build
- ✅ Tidak perlu env vars

**Files:**
- `vitest.config.ts`
- `src/lib/test-helpers.ts`
- `src/lib/test-setup.ts`
- `src/lib/test-utils.tsx`
- Various `*.test.ts` and `*.test.tsx` files

---

### 4. ✅ **Web Vitals** - Performance Monitoring

**Dependencies:** Sudah terinstall ✅
```json
"web-vitals": "^5.1.0"
```

**Environment Variables:** TIDAK PERLU ❌

**Status:**
- ✅ Sudah terinstall
- ✅ Otomatis track web vitals (LCP, FID, CLS, etc.)
- ✅ Send ke Vercel Analytics (if enabled)
- ✅ Tidak perlu env vars
- ✅ Works out of the box

**Files:**
- `src/components/analytics/web-vitals.tsx`
- `src/app/layout.tsx` (uses WebVitals component)

---

## 📊 Summary

| Integration | Dependencies | Env Vars | Required? | Has Fallback? |
|-------------|--------------|----------|-----------|---------------|
| **Sentry** | ✅ Installed | ✅ Optional | ❌ No | ✅ Yes (disabled if no DSN) |
| **Upstash Redis** | ✅ Installed | ✅ Optional | ❌ No | ✅ Yes (in-memory) |
| **Vitest** | ✅ Installed | ❌ No | ❌ No | N/A (dev only) |
| **Web Vitals** | ✅ Installed | ❌ No | ❌ No | N/A (always works) |

---

## 🚀 Quick Setup Guide

### Minimal Setup (App akan berjalan tanpa ini)

**Tidak perlu setup apapun!** ✅

Semua integrasi memiliki fallback:
- **Sentry**: Disabled jika tidak ada DSN
- **Upstash Redis**: In-memory rate limiting jika tidak ada
- **Testing**: Hanya untuk development
- **Web Vitals**: Automatic, no setup needed

### Recommended Setup (Production)

**1. Sentry (Error Tracking)**
```env
NEXT_PUBLIC_SENTRY_DSN="https://xxx@sentry.io/xxx"
SENTRY_ORG="your-org"
SENTRY_PROJECT="your-project"
SENTRY_AUTH_TOKEN="your-token"
```

**2. Upstash Redis (Rate Limiting)**
```env
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxx"
```

---

## ✅ Verification

### Check Sentry
```bash
# Build dengan Sentry config
pnpm build

# Check logs - should see Sentry init (if DSN set)
# Or "Sentry disabled" (if no DSN)
```

### Check Rate Limiting
```bash
# Start dev server
pnpm dev

# Check logs di src/lib/middleware/rate-limit.ts
# Should see "Using Upstash Redis" or "Using in-memory limiter"
```

### Check Testing
```bash
# Run tests
pnpm test

# Should work out of the box
```

---

## 📝 Complete .env Template

```env
# ============================================
# REQUIRED (Core App)
# ============================================
DATABASE_URL="postgresql://user:password@localhost:5432/epidom"
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER="price_..."
NEXT_PUBLIC_STRIPE_PRICE_ID_PRO="price_..."
EPIDOM_OWNER_EMAIL="owner@epidom.com"

# ============================================
# OPTIONAL (New Integrations)
# ============================================

# Sentry (Error Tracking) - OPTIONAL
NEXT_PUBLIC_SENTRY_DSN="https://xxx@sentry.io/xxx"
SENTRY_ORG="your-org"
SENTRY_PROJECT="your-project"
SENTRY_AUTH_TOKEN="your-token"

# Upstash Redis (Rate Limiting) - OPTIONAL
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxx"
```

---

## 🎯 Kesimpulan

**Yang Baru Ditambahkan:**
1. ✅ **Sentry** - Error tracking (OPTIONAL setup)
2. ✅ **Upstash Redis** - Rate limiting (OPTIONAL setup)
3. ✅ **Vitest** - Testing (No setup needed)
4. ✅ **Web Vitals** - Performance (No setup needed)

**Yang Perlu Setup:**
- ❌ **TIDAK ADA yang wajib!** Semua optional dengan fallback

**App akan tetap berjalan tanpa setup apapun!** ✅

---

**Last Updated:** 2025-01-XX

