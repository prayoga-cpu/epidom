# OPERATIONS

One-stop reference for production operations. Every manual action that affects live data has a GitHub Actions `workflow_dispatch` workflow under `.github/workflows/ops-*.yml`. Run them from **Actions → [workflow name] → Run workflow** — never from the command line directly against production, unless you're in a recovery situation where GitHub is unreachable.

---

## Secrets inventory

| Secret | Vercel env | Used by | Rotates how | Last rotated |
|--------|-----------|---------|-------------|--------------|
| `BETTER_AUTH_SECRET` | Production + Preview | Session signing | Generate new random 32-byte string; all active sessions are immediately invalidated | — |
| `NEXTAUTH_SECRET` | Production + Preview | Fallback for `BETTER_AUTH_SECRET` when that key is absent | Same as above | — |
| `GOOGLE_CLIENT_ID` | Production + Preview | Google OAuth sign-in | Google Cloud Console → Credentials | — |
| `GOOGLE_CLIENT_SECRET` | Production + Preview | Google OAuth sign-in | Google Cloud Console → Credentials | — |
| `RESEND_API_KEY` | Production + Preview | Transactional email (verification, password reset, account deactivated) | resend.com dashboard → API Keys | — |
| `DATABASE_URL` | Production | Prisma pooled queries at runtime | Neon → Connection → rotate password | — |
| `DIRECT_URL` | Production | `prisma migrate deploy` only | Same as `DATABASE_URL` password rotation | — |
| `BLOB_READ_WRITE_TOKEN` | Production + Preview | Vercel Blob Storage (legacy; will be phased out after R2 migration) | Vercel Storage dashboard → Tokens | — |
| `R2_ACCOUNT_ID` | Production + Preview | Cloudflare R2 (backups + media) | Cloudflare dashboard | — |
| `R2_ACCESS_KEY_ID` | Production + Preview | Cloudflare R2 | Cloudflare R2 → Manage API tokens | — |
| `R2_SECRET_ACCESS_KEY` | Production + Preview | Cloudflare R2 | Cloudflare R2 → Manage API tokens | — |
| `R2_BUCKET_NAME` | Production + Preview | Primary bucket (`epidom`) — holds backups AND media uploads | Config-only; rename requires script update | — |
| `R2_MEDIA_BUCKET` | Production + Preview | Optional; overrides `R2_BUCKET_NAME` for uploads. Omit to share the same bucket. | Config-only | — |
| `R2_MEDIA_PUBLIC_URL` | Production + Preview | Public URL base served by the Cloudflare Worker (`https://media.epidom.fr`) | Config-only; requires next.config.ts update | — |
| `VERCEL_API_TOKEN` | Production | Vercel admin capacity dashboard | Vercel dashboard → Account Settings → Tokens | — |
| `VERCEL_TEAM_ID` | Production | Vercel admin capacity dashboard | Read-only; changes when team is renamed | — |
| `NEON_API_KEY` | Production | Neon admin capacity dashboard | Neon dashboard → Account → API Keys | — |
| `NEON_PROJECT_ID` | Production | Neon admin capacity dashboard | Read-only; never changes | — |
| `STRIPE_SECRET_KEY` | Production | Subscription billing | Stripe dashboard → Developers → API Keys | — |
| `STRIPE_WEBHOOK_SECRET` | Production | Stripe webhook signature verification | Regenerated when endpoint URL changes | — |
| `MAGICBELL_API_KEY` | Production + Preview | Merchant push alerts (new order, low stock) | MagicBell dashboard → Projects → API Keys | — |
| `MAGICBELL_API_SECRET` | Production + Preview | Merchant push alerts | MagicBell dashboard → Projects → API Keys | — |
| `INNGEST_EVENT_KEY` | Production | Background jobs (backups, purge sweeps, receipt retries) | Inngest dashboard → Manage → Event Keys | — |
| `INNGEST_SIGNING_KEY` | Production | Inngest webhook signature | Inngest dashboard → Manage → Signing Keys | — |
| `OPENAI_API_KEY` | Production | AI profile analysis, aggregator email parsing | OpenAI dashboard → API Keys | — |
| `VAPID_PUBLIC_KEY` | Production + Preview | Web push notifications | Regenerate with `npx web-push generate-vapid-keys`; invalidates all existing subscriptions | — |
| `VAPID_PRIVATE_KEY` | Production + Preview | Web push notifications | Rotate together with `VAPID_PUBLIC_KEY` | — |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Production + Preview | Client-side push subscription | Must match `VAPID_PUBLIC_KEY` | — |
| `PUSHER_APP_ID` | Production + Preview | Realtime order/material/product events | Pusher dashboard | — |
| `PUSHER_KEY` | Production + Preview | Realtime | Pusher dashboard | — |
| `PUSHER_SECRET` | Production + Preview | Realtime | Pusher dashboard | — |
| `EXCHANGE_RATE_API_KEY` | Production | Multi-currency FX rates | exchangerate-api.com dashboard | — |
| `XENDIT_SECRET_KEY` | Production | Indonesian payments (QRIS, GoPay, etc.) | Xendit dashboard → Settings → Developers | — |
| `XENDIT_WEBHOOK_TOKEN` | Production | Xendit webhook signature | Regenerated when endpoint changes | — |
| `NEXT_PUBLIC_META_PIXEL_ID` | Production | Meta/Facebook Pixel | Meta Events Manager | — |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Production | Google Analytics 4 | Google Analytics dashboard | — |
| `AUDIT_CAPTURE` | Production | Audit trail kill switch (unset = ON) | — | — |
| `CF_DEPLOY_HOOK` | GitHub Actions secrets | `ops-deploy.yml` triggers a Vercel deploy | Vercel → Project → Settings → Git → Deploy Hooks | — |
| `GH_PAT` | GitHub Actions secrets | `ops-env-audit.yml` reads Vercel env list | GitHub PAT with `repo` scope | — |

---

## Operations workflows

All workflows are in `.github/workflows/`. Run from **Actions → [name] → Run workflow**.

### `ops-deploy.yml` — Trigger production deploy
Fires the Vercel deploy hook (`CF_DEPLOY_HOOK` secret). Use when you've merged to `main` and the automatic deploy is stuck, or when you want an immediate rollout without a new commit.

**Inputs:** `reason` (string) — brief description of why you're triggering manually.

### `ops-migrate-status.yml` — Check pending migrations
Reports which Prisma migrations are applied on the production database vs. the ones in `prisma/migrations/`. A list of "pending" migrations means the last deploy did not run `prisma migrate deploy`.

**Inputs:** none.

### `ops-backup-now.yml` — Trigger an immediate database backup
Calls the Inngest `backup/database` event, which runs the same nightly backup job on demand. The backup lands in the `epidom` R2 bucket under `backups/YYYY-MM-DD-HH-MM-SS.dump`. See `docs/BACKUP_RESTORE.md` for how to restore.

**Inputs:** `note` (string) — why you're taking a snapshot (pre-migration, pre-incident, etc.).

### `ops-restore-to-dev.yml` — Restore a backup to the dev Neon branch
Downloads the named backup from R2 and restores it onto the `development` Neon branch. Useful for reproducing a prod data bug locally without touching production.

**Inputs:** `backup_key` (string) — R2 object key, e.g. `backups/2026-10-19-02-00-00.dump`.

### `ops-env-audit.yml` — List production environment variables
Prints all key names (not values) currently set in the Vercel production environment and flags any that are in `.env.example` but missing from Vercel. Helps catch drift after a new secret is added to code but not yet added to Vercel.

**Inputs:** none.

### `ops-deps-audit.yml` — Audit npm dependencies for known vulnerabilities
Runs `pnpm audit --prod` against the production dependency tree and opens a GitHub issue if HIGH or CRITICAL advisories are found.

**Inputs:** none.

---

## MagicBell (merchant alerts)

MagicBell handles server-side push alerts to store owners: new order notifications and low/critical stock warnings. Both API key and secret are live in production.

- Dashboard: https://app.magicbell.com/
- Project: epidom
- Events fired by: `src/lib/magicbell/client.ts`
- Does **not** require operator onboarding; alerts are delivered to the owner's browser automatically once they sign in.

---

## Inngest (background jobs)

Inngest runs 15 recurring and event-driven jobs. To check that the app is synced with Inngest Cloud:

```bash
# Probe the sync endpoint — 200 means synced, 404 means not synced yet
curl -I https://epidom.fr/api/inngest
```

To re-sync manually (does not require a deploy):

```bash
curl -X PUT https://epidom.fr/api/inngest
```

See `project_inngest_local_events.md` memory for the full history.

---

## Cloudflare R2 bucket

A single private `epidom` bucket holds everything. Objects are separated by prefix:

| Prefix | Purpose | Served via |
|--------|---------|-----------|
| `backups/` | Nightly DB dumps | Presigned URL (time-limited, server-side) |
| `videos/` | Sales-page video (VSL.mp4) | Presigned URL — see `src/lib/storage/sales-video.ts` |
| `media/uploads/` | User-uploaded images (logos, avatars, etc.) | Cloudflare Worker proxy → `media.epidom.fr` |

**The bucket stays private.** `media.epidom.fr` is a Cloudflare Worker that reads from the `epidom` bucket and serves only the `media/` prefix publicly, blocking access to `backups/` and `videos/`. Set the Worker up once via the Cloudflare dashboard (Workers → Create → R2 binding → bucket `epidom`).

Worker script (paste into the Cloudflare editor):
```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = "media" + url.pathname; // media/uploads/… or media/…
    const obj = await env.EPIDOM_BUCKET.get(key);
    if (!obj) return new Response("Not found", { status: 404 });
    return new Response(obj.body, {
      headers: {
        "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  },
};
```
Bind the R2 bucket as `EPIDOM_BUCKET` in the Worker settings, then set the custom domain `media.epidom.fr`.

To migrate existing Vercel Blob uploads to R2:

```bash
# Dry-run (shows what would change, writes no DB rows):
npx tsx scripts/migrate-blob-to-r2.ts

# Apply:
npx tsx scripts/migrate-blob-to-r2.ts --apply
```

A CSV rollback map is written to `migrate-blob-to-r2-rollback.csv`.

---

## Neon database branches

| Branch | Used by | Reset schedule |
|--------|---------|----------------|
| `main` | Production (`epidom.fr`) | Never |
| `development` | Preview deploys (`dev.epidom.fr`) | Nightly at 02:00 WIB from `main` |

After the dev branch is reset, run `prisma migrate deploy` against it so the next preview deploy has a current schema. The `reset-dev-db.yml` GitHub Actions workflow does this automatically (requires `VERCEL_DEV_DEPLOY_HOOK_URL` secret).

---

## Vercel deploy hooks

| Hook | Secret | Trigger |
|------|--------|---------|
| Production | `CF_DEPLOY_HOOK` (GitHub Actions secret) | `ops-deploy.yml` |
| Dev | `VERCEL_DEV_DEPLOY_HOOK_URL` (GitHub Actions secret) | `reset-dev-db.yml` (post-Neon-reset) |

Never commit hook URLs — they are the secret.
