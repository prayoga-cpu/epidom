# Phase 0, Cleanup & Re-alignment

This is the first task to run before any feature work begins. It exists to make the codebase reflect the new strategic positioning. **No new features. No new domains. Just cleanup.**

Target duration: **5 working days, one developer.**

When complete, a new contributor reading the repo should have no idea it was ever a cookie-bar-only product.

---

## Snapshot

| Metric | Target |
|---|---|
| Files modified | ~40-60 |
| Files deleted | ~15-25 |
| Migrations created | 1 |
| Tests broken | 0 |
| Lines of code added | <500 |
| Lines of code removed | ~2,000-3,000 (mostly copy & deprecated assets) |
| Days | 5 |

---

## Day 1, Strategic decisions and schema

Hardest work first. These choices unblock everything else.

### Task 1.1, Lock geographic priority

Decision required from the operator before code:
- **Indonesia first**, France paused (current recommendation)
- Or France first, Indonesia paused

Whichever wins, document it in `/docs/STRATEGY.md` section 3 and confirm with the team in writing. This decision drives pricing, payment provider, and locale priorities.

### Task 1.2, Rename `SubscriptionPlan` enum

Edit `prisma/schema.prisma`:

```prisma
enum SubscriptionPlan {
  FREE
  POS
  OPERATIONS
  ENTERPRISE
}
```

Old values (`STARTER`, `PRO`, `ENTERPRISE`) get migrated:
- `STARTER` → `FREE` for trial users, `POS` for paying users
- `PRO` → `OPERATIONS`
- `ENTERPRISE` → `ENTERPRISE` (no change)

Write the migration manually (don't trust `prisma migrate dev` to do an enum value swap cleanly):

```bash
pnpm prisma migrate dev --name rename_subscription_plans --create-only
```

Edit the generated SQL to:
1. Create the new enum type
2. Update existing rows
3. Swap the column type
4. Drop the old enum

Test against a snapshot of production data before merging.

### Task 1.3, Sketch the new schema additions (do not migrate yet)

Add the storefront-related models to `schema.prisma` as **commented-out scaffolding**. This is to socialize the upcoming schema, not to apply it.

```prisma
// PHASE 1 -- Public Storefront
// model Storefront { ... }
// model MenuCategory { ... }
// model MenuItem { ... }
```

Migration happens in Phase 1, not Phase 0.

---

## Day 2, Marketing copy and locales

Remove every reference to cookie bars, France-first messaging, and bakery-only language. The product is now an Indonesian F&B operating system.

### Task 2.1, Strip cookie-bar copy from `id.ts`

File: `src/locales/id.ts`. Find and replace:

| Old | New |
|---|---|
| "Cookie Bar" / "cookie bars" | "warung, kafe, dan resto" |
| "Cookie Bar Inventory Management" | "Manajemen Operasional F&B" |
| "Trusted by cookie bars in France" | "Untuk usaha F&B kecil di Indonesia" |
| "Track your cookies stock" | "Kelola pesanan, menu, dan stok" |
| References to "France" in product copy | Remove or replace with "Indonesia" |
| Pricing in `€29 / €79` | `Rp 99.000 / Rp 249.000` |

### Task 2.2, Mirror changes in `en.ts`

Same replacements in English. Keep English copy aligned with Indonesian.

### Task 2.3, Freeze `fr.ts`

Add a header comment to `src/locales/fr.ts`:

```typescript
/**
 * DEPRECATED as of Phase 0 (May 2026).
 * The French locale is frozen. Do not add new strings.
 * The file remains for legacy translations only.
 * French market is paused; see /docs/STRATEGY.md.
 */
```

Do not delete the file. Existing strings stay translated for any legacy users.

### Task 2.4, Update SEO metadata

File: `src/app/(marketing)/page.tsx`

Replace the entire `generateMetadata` call:

```typescript
export const metadata = generateMetadata({
  title: "Epidom — Toko Online, Menu, dan Kasir untuk UMKM F&B Indonesia",
  description:
    "Bikin halaman menu untuk Instagram, terima pesanan QRIS, kelola kasir, semua gratis. Untuk warung, kafe, dan resto Indonesia.",
  keywords: [
    "aplikasi kasir gratis",
    "menu QR resto",
    "halaman pesanan instagram",
    "toko online F&B",
    "POS UMKM",
    "QRIS resto",
    "Epidom",
  ],
  openGraph: {
    title: "Epidom — Toko Online dan Kasir untuk F&B",
    description: "Halaman menu, pesanan online, dan kasir dalam satu link.",
    url: "https://epidom.id",
    locale: "id_ID",
  },
});
```

Also update `src/lib/seo.ts` defaults if they hardcode anything French or cookie-bar related.

### Task 2.5, Update the marketing landing page composition

File: `src/app/(marketing)/page.tsx`

The `LandingPageSections` component composition stays the same shape but the section copy and ordering should reflect the new wedge:

1. Hero: "Halaman pesanan untuk Instagram-mu" (not "Cookie Bar Inventory")
2. Social proof: replace fake French testimonials with placeholders for now
3. How it works: 3 steps (publish menu → share link → terima pesanan)
4. Pricing: 4 tiers (FREE, POS, OPERATIONS, ENTERPRISE)
5. Pain vs Gain: keep the format, change the pain points to "Linktree + Drive + WA chaos" vs "satu link untuk semua"
6. Closing CTA

This is mostly a copy swap inside `src/features/marketing/home/components/landing-page-sections.tsx` and its children. Don't rebuild components.

---

## Day 3, Package cleanup and feature flags

Trim weight from the codebase that doesn't serve the new direction.

### Task 3.1, Remove unused packages

```bash
pnpm remove leaflet react-leaflet maplibre-gl @types/leaflet
pnpm remove mathjs
# Audit then maybe also:
# pnpm remove react-easy-crop browser-image-compression embla-carousel-react
```

For each removal, grep first:

```bash
grep -r "from 'leaflet'" src/
grep -r "from 'maplibre-gl'" src/
grep -r "from 'mathjs'" src/
```

If any usage is found, refactor or note as a follow-up.

Expected bundle size reduction: ~15MB.

### Task 3.2, Archive dashboard surfaces not used in Phase 1-3

Do not delete. Move under a feature flag.

Create `src/lib/feature-flags.ts`:

```typescript
export const FEATURE_FLAGS = {
  LEGACY_INVENTORY: process.env.NEXT_PUBLIC_FEATURE_LEGACY_INVENTORY === "true",
} as const;
```

Edit `.env.example` to add:

```
NEXT_PUBLIC_FEATURE_LEGACY_INVENTORY=false
```

In the sidebar/nav component (look in `src/components/` or `src/features/dashboard/shared/`), wrap the relevant nav links with a check for `FEATURE_FLAGS.LEGACY_INVENTORY`. The routes that get flagged:

- `/store/[storeId]/management`
- `/store/[storeId]/data`
- `/store/[storeId]/tracking`
- `/store/[storeId]/alerts`

The pages still exist, still work for anyone with the flag on. They just disappear from default nav.

### Task 3.3, Remove or archive deprecated marketing pages

The pages `payments`, `refund-policy`, `services`, `terms` may be outdated. Audit each:

- If still legally required (terms, refund), update copy to match new positioning
- If no longer needed (`services` likely), move to `_archive/`

`src/app/(marketing)/_archive/` is a Next.js-ignored convention (any folder starting with `_` is excluded from routing). Use it for pages we want to preserve in git but not publish.

---

## Day 4, Docs and developer experience

The repo should now match the new direction in documentation as well as code.

### Task 4.1, Drop in new doc set

Place these files in the repo (most are new in this Phase 0 doc bundle):

- `AGENTS.md` (root, new)
- `docs/STRATEGY.md` (new)
- `docs/roadmap.md` (new)
- `docs/PHASE_0_CLEANUP.md` (this file)
- `docs/README.md` (rewrite as table of contents)
- `docs/ARCHITECTURE.md` (updated)
- `docs/FEATURES.md` (updated)
- `docs/BILLING.md` (updated)
- `docs/ENVIRONMENT.md` (updated)
- `docs/DATABASE.md` (updated)

The old docs that don't need changes (`AUTH.md`, `CONTRIBUTING.md`, `DEPLOYMENT.md`, `ERROR_HANDLING.md`, `I18N.md`, `INSTALLATION.md`, `SECURITY.md`, `TESTING.md`, `TROUBLESHOOTING.md`, `API.md`) stay as-is for now.

The marketing-strategy docs in `/marketing/` are dated. Archive the whole folder to `_archive/marketing-old/` and reference `/docs/STRATEGY.md` going forward.

### Task 4.2, Update `CLAUDE.md`

The existing `CLAUDE.md` describes the old positioning. Either:
- **Delete `CLAUDE.md`** and rely on the new `AGENTS.md` (preferred, since `AGENTS.md` is now the de-facto standard for AI coding tools)
- Or trim `CLAUDE.md` to a one-line redirect: "See AGENTS.md."

### Task 4.3, Update `README.md`

The repo root README is currently aimed at developers setting up the cookie-bar app. Rewrite the first 30 lines to reflect:

- Project tagline (one-liner from `/docs/STRATEGY.md`)
- Quick start commands
- Link to `AGENTS.md` for AI agents
- Link to `/docs/STRATEGY.md` for context
- Link to `/docs/roadmap.md` for what's next

Keep the developer setup section.

---

## Day 5, Verification and PR

Make sure nothing is broken.

### Task 5.1, Full local rebuild

```bash
pnpm install                  # fresh node_modules
pnpm prisma generate
pnpm prisma migrate dev       # apply the enum migration
pnpm type-check               # zero errors
pnpm lint                     # zero errors, warnings OK
pnpm build                    # production build succeeds
pnpm test                     # all existing tests pass
```

If any step fails, fix it before merging.

### Task 5.2, Grep for stragglers

Run these greps. The result count for each should be **zero** (or a documented exception):

```bash
# Cookie-bar references in user-facing code
grep -r "cookie bar" src/ --ignore-case
grep -r "kue kering" src/locales/

# Old plan names
grep -rE "STARTER|\"PRO\"" src/  # outside subscription history

# French as default
grep -r "locale: \"fr_FR\"" src/

# Removed packages
grep -rE "from ['\"]leaflet|from ['\"]maplibre-gl|from ['\"]mathjs" src/
```

### Task 5.3, Local smoke test

Spin up locally and walk through:
1. Sign up with a new email
2. See the rebranded onboarding (no cookie-bar copy)
3. Land on the dashboard (legacy nav items hidden)
4. Visit `/pricing` — see new tier names and IDR prices
5. Open `/api/health` — returns 200

### Task 5.4, Open the cleanup PR

One PR. Title: `chore: phase 0 cleanup and re-positioning to Indonesian F&B platform`.

The PR description must include:
- Link to `/docs/STRATEGY.md` summarizing the pivot
- List of removed packages and rationale
- Migration plan for `SubscriptionPlan` enum
- Risk callout: what users see post-deploy
- Rollback plan

Get sign-off from the operator before merging.

### Task 5.5, Production deploy checklist

After merge, before promoting to production:

- [ ] Stripe products renamed to match new tier names (manual in Stripe dashboard)
- [ ] Stripe price IDs updated in env vars
- [ ] Email any existing paying users about the renamed tiers (legally required if pricing changes — coordinate with the operator)
- [ ] Update `epidom.com` and `epidom.fr` (if active) to redirect to `epidom.id`
- [ ] Cloudflare/DNS confirmed for `epidom.id`
- [ ] Monitor Sentry/error logs for the first 24 hours after deploy

---

## What does not happen in Phase 0

To avoid scope creep, these items are explicitly out of scope. They go to Phase 1+:

- New schema models (Storefront, MenuItem, etc.) — Phase 1
- Public route group (`src/app/(public)/`) — Phase 1
- Payment provider abstraction with Xendit — Phase 2
- WhatsApp notification integration — Phase 2
- PWA / service worker — Phase 3
- Aggregator email parsing — Phase 5

If a teammate proposes adding any of these during Phase 0, send them this list.

---

## Done definition

Phase 0 is complete when:

1. ✅ Production build succeeds with zero new type or lint errors
2. ✅ Migration applied and verified against a snapshot of prod data
3. ✅ All five grep checks in Task 5.2 return zero results (or documented exceptions)
4. ✅ Local smoke test (Task 5.3) passes end-to-end
5. ✅ PR merged to main
6. ✅ Production deploy completed
7. ✅ Operator confirms the public landing page reflects the new positioning

Then we open Phase 1.
