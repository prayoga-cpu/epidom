# Environment

Environment variables required to run Epidom, what each one does, and where to get it.

When you add a new env var to the codebase, update this doc and `.env.example` in the same PR.

---

## Quick reference

| Group         | Required for           | Phase added |
| ------------- | ---------------------- | ----------- |
| Core app      | Local dev to boot      | Existing    |
| Better Auth   | Login flows            | Existing    |
| Stripe (SaaS) | Subscription billing   | Existing    |
| Xendit        | Customer payments      | Phase 2     |
| Fonnte        | Disabled — see below   | Phase 2     |
| Inngest       | Background jobs        | Phase 2     |
| Resend        | Transactional email    | Existing    |
| Google OAuth  | Google login button    | Existing    |
| Pusher        | Live updates (optional, polls without) | Maintenance |
| OpenAI        | Aggregator email parsing (optional) | Phase 5 |
| Analytics     | GA / Meta Pixel (optional, consent-gated) | Maintenance |
| Web Push      | Order/low-stock push notifications | Maintenance |
| Android app   | Play Store app opens full-screen | Maintenance |

---

## Core app

```bash
# Public URL of your app
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database: pooled connection used by the app at runtime (PostgreSQL only)
DATABASE_URL="postgresql://user:pass@localhost:5432/epidom"
# Direct (non-pooled) connection for migrations and bulk COPY
DIRECT_URL="postgresql://user:pass@localhost:5432/epidom"

# Operator email: the account that gets the /admin dashboard
EPIDOM_OWNER_EMAIL=owner@epidom.fr
```

- `NEXT_PUBLIC_APP_URL` is the app's public origin. `NEXTAUTH_URL` is a legacy fallback, read only
  where `NEXT_PUBLIC_APP_URL` or the request origin is missing (subscription checkout/portal,
  Stripe Connect). Leave it unset unless an old deployment still sets it.
- `DATABASE_URL` is the pooled URL (Neon: the `-pooler` host). The schema is PostgreSQL only;
  there is no SQLite fallback.
- `DIRECT_URL` is the non-pooled URL used by the Prisma CLI (`prisma.config.ts`) and the backup/restore
  scripts. Optional in practice: `directDatabaseUrl()` in `src/lib/db/connection-string.ts` uses it when
  set and otherwise derives the direct host from a pooled `DATABASE_URL` by dropping `-pooler`. Set it
  explicitly on Vercel so migrations never depend on that derivation.
- `EPIDOM_OWNER_EMAIL` (server) and `NEXT_PUBLIC_EPIDOM_OWNER_EMAIL` (client-visible) identify the operator
  account for the admin dashboard; the `NEXT_PUBLIC_` one takes precedence when both are set.
- `NEXT_PUBLIC_API_URL` is optional: the base URL of the client API wrapper (`src/lib/api/client.ts`),
  defaulting to `/api`. Leave it unset.
- `LOG_QUERIES=true` logs each Prisma query with its duration. Development only
  (`NODE_ENV=development`, see `src/lib/prisma.ts`); ignored in production.

---

## Authentication (Better Auth)

```bash
# Generate with: openssl rand -hex 32
BETTER_AUTH_SECRET=<random-hex-string>

# Legacy fallback, only read when BETTER_AUTH_SECRET is unset
# NEXTAUTH_SECRET=<random-hex-string>

# Google OAuth (for "Sign in with Google")
GOOGLE_CLIENT_ID=<from-google-cloud-console>
GOOGLE_CLIENT_SECRET=<from-google-cloud-console>
```

**Where to get Google OAuth credentials:**

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI: `{APP_URL}/api/auth/callback/google`
4. Copy Client ID and Secret

---

## Stripe (SaaS subscription billing)

```bash
# Server-side
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs, one per plan per cadence (from the same account as the keys)
NEXT_PUBLIC_STRIPE_PRICE_ID_POS_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_ID_POS_YEARLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_ID_OPERATIONS_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_ID_OPERATIONS_YEARLY=price_...
```

The catalog is one Price per plan and cadence, EUR-based with USD and IDR `currency_options`; find
each by its lookup key `epidom_{pos,operations}_{monthly,yearly}`. ENTERPRISE has no catalog price
(it is quoted per account). Details: `docs/BILLING.md` → Stripe setup.

**Where to get keys:**

1. Stripe dashboard → Developers → API keys
2. Use a Stripe **sandbox** (test keys) for local development, never live keys: a local checkout
   with a live key charges a real card, and the dev database shares production user IDs
3. Webhook secret: Stripe → Developers → Webhooks → click your endpoint → reveal signing secret

**Setting up webhooks for local dev:**

```bash
stripe listen --api-key "$STRIPE_SECRET_KEY" --forward-to localhost:3000/api/webhooks/stripe
```

The CLI prints the webhook secret. Paste it into `STRIPE_WEBHOOK_SECRET`.

---

## Xendit (customer payments, Phase 2+)

```bash
XENDIT_SECRET_KEY=xnd_development_...
XENDIT_WEBHOOK_TOKEN=<from-xendit-dashboard>
```

**Where to get keys:**

1. Sign up at xendit.co
2. Get test mode API keys from Dashboard → Settings → Developers → API Keys
3. Configure webhooks at Dashboard → Settings → Webhooks
4. Set `XENDIT_WEBHOOK_TOKEN` to the verification token shown
5. Point the webhook URL at `{APP_URL}/api/webhooks/xendit`

**Local development with webhooks:**
Use `ngrok http 3000` or Cloudflare Tunnel, point Xendit's webhook callback at your tunnel URL.

---

## Fonnte (WhatsApp notifications) — disabled

`FONNTE_API_TOKEN` has been removed from `.env`/`.env.example`; the token on
file stopped working and hasn't been replaced. `isFonnteAvailable()` returns
`false` with no token set, so every Fonnte send path (auto-send-on-payment,
the manual "Send Receipt" button) no-ops/fails gracefully rather than
throwing — no code changes needed to keep the app running without it. The
receipt/order-notification flows fall back to the "Open in WhatsApp"
(`wa.me`) redirect, which needs no API token at all.

If re-enabling Fonnte (or a similar unofficial bridge) later:

```bash
FONNTE_API_TOKEN=<from-fonnte-dashboard>
```

1. Sign up at fonnte.com
2. Connect a WhatsApp number (you'll scan a QR with the WA Web app)
3. Get the token from Dashboard → API
4. Important: this is unofficial and the account can be flagged/banned by
   Meta with no notice — that's almost certainly why the previous token
   stopped working. Treat it as a stopgap, not infrastructure to depend on.

**Alternatives**, roughly cheapest/fastest-to-set-up to most durable:

- **Wablas / Watzap.id / StarSender** — other Indonesian unofficial bridges,
  same QR-scan model and same ban risk as Fonnte. Only worth it if you need
  something working again in the next hour; budget to migrate off it later.
- **Official Meta WhatsApp Cloud API via a BSP** (Twilio, MessageBird,
  360dialog) — requires a verified Meta Business
  account and per-template message approval, but won't get your number
  banned and is the actual production-grade path. Not implemented in the app today: it would
  need a new provider next to `src/lib/notifications/providers/fonnte.ts`.
- **Twilio WhatsApp API** specifically — same BSP category as above, but
  worth calling out on its own since it's the easiest of the three to get a
  sandbox running same-day (Twilio's WhatsApp sandbox needs no Meta Business
  verification to start testing), then graduate to a paid Twilio WhatsApp
  Sender once ready for production.

---

## Inngest (background jobs, Phase 2+)

```bash
INNGEST_EVENT_KEY=<from-inngest-cloud>
INNGEST_SIGNING_KEY=<from-inngest-cloud>
```

**Where to get keys:**

1. Sign up at inngest.com
2. Create an app
3. Copy event key and signing key from the dashboard

Local development uses the Inngest Dev Server (no env vars needed for that flow).

---

## Resend (email)

```bash
RESEND_API_KEY=re_...
EMAIL_FROM="Epidom <noreply@epidom.fr>"
```

**Where to get a key:**

1. Sign up at resend.com
2. Add and verify your domain (`epidom.fr`)
3. Create an API key under API Keys

DNS records required at the domain level:

- SPF
- DKIM
- DMARC (recommended)

---

## Web Push (VAPID) — OS-level browser push

```bash
# Server-side
VAPID_PUBLIC_KEY=<from-web-push-generate-vapid-keys>
VAPID_PRIVATE_KEY=<from-web-push-generate-vapid-keys>
VAPID_SUBJECT=mailto:you@yourdomain.com

# Client-side (same value as VAPID_PUBLIC_KEY above)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<same-as-VAPID_PUBLIC_KEY>
```

**Where to get keys:**

1. Run `npx web-push generate-vapid-keys` once (or `node -e "console.log(require('web-push').generateVAPIDKeys())"` if you already have the package installed)
2. Copy the pair into `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`
3. Copy the public key again into `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
4. `VAPID_SUBJECT` must be a `mailto:` or `https:` URL — push services use it to contact you if your server misbehaves (excessive sends, invalid subscriptions, etc.)

Used for OS-level browser push (new storefront orders, low/critical material stock — see
`src/lib/push/send.ts`). Optional — until all four vars are set, the push toggle in
`NotificationBell` stays hidden and everything keeps working via existing polling
(see AGENTS.md "Graceful Degradation").

**Platform notes:** iOS Safari requires the site to be added to the Home Screen
(standalone display mode) and iOS 16.4+ — Web Push is unavailable in a plain Safari
tab. Desktop Safari requires macOS 13+. A user who has already denied the browser
permission prompt won't be re-prompted automatically — the UI must surface that as
a distinct "blocked" state rather than retrying.

---

## Android app (Trusted Web Activity)

```bash
ANDROID_TWA_PACKAGE_NAME=fr.epidom.pos
ANDROID_TWA_SHA256_FINGERPRINTS=AA:BB:…:FF,11:22:…:99
```

The Play Store build of Epidom is this website wrapped in a Trusted Web Activity
(see `android/README.md` and `docs/OFFLINE_POS.md`). Android only shows it
full-screen — no browser address bar — once `https://epidom.fr/.well-known/assetlinks.json`
vouches for the app. That file is served by `src/app/.well-known/assetlinks.json/route.ts`
from these two variables.

- `ANDROID_TWA_PACKAGE_NAME` — the package id chosen when the app was generated.
  Optional; defaults to `fr.epidom.pos`.
- `ANDROID_TWA_SHA256_FINGERPRINTS` — comma-separated SHA-256 certificate
  fingerprints. Add **both** the upload key's (`keytool -list -v -keystore android.keystore`)
  and Play App Signing's (Play Console → Setup → App signing), since Play re-signs
  the app with its own key. Malformed entries are dropped.

Optional, and not secret (the file is public by design). Until a fingerprint is
set the route answers `[]`, which associates nothing — the app still works, it just
shows a slim browser bar at the top.

---

## Pusher (live updates) — optional

```bash
# Server-side (publishing events)
PUSHER_APP_ID=<from-pusher-channels>
PUSHER_KEY=<from-pusher-channels>
PUSHER_SECRET=<from-pusher-channels>
PUSHER_CLUSTER=<e.g. ap1>

# Client-side (subscribing)
NEXT_PUBLIC_PUSHER_KEY=<same-as-PUSHER_KEY>
NEXT_PUBLIC_PUSHER_CLUSTER=<same-as-PUSHER_CLUSTER>
```

Pushes live updates (orders, materials, products, recipes, stock, presence) to open dashboards and
the POS. Code: `src/lib/realtime/` (`pusher-server.ts`, `pusher-client.ts`, `publish.ts`).

**Where to get keys:** create a Channels app at dashboard.pusher.com (free tier is enough to start)
and copy the app id, key, secret and cluster from App Keys.

Optional. The server publishes only when all four `PUSHER_*` vars are set, and the browser subscribes
only when both `NEXT_PUBLIC_PUSHER_*` vars are set; otherwise every surface keeps working on its
existing polling (see AGENTS.md "Graceful Degradation"). The `NEXT_PUBLIC_` values are inlined at build
time, so redeploy after changing them.

---

## OpenAI (aggregator email parsing) — optional

```bash
OPENAI_API_KEY=sk-...
```

Used by the `parse-aggregator-email` Inngest function (`src/lib/inngest/functions/parse-aggregator-email.ts`)
to turn forwarded GoFood/GrabFood/ShopeeFood/Tokopedia emails into orders. Get a key at
platform.openai.com. Optional: without it the email is stored with `parseStatus: "manual"` for manual review.

---

## Inbound email webhook secret — optional

```bash
EMAIL_WEBHOOK_SECRET=<your-own-secret>
```

Shared secret for `POST /api/webhooks/email` (`src/app/api/webhooks/email/route.ts`). When set, requests
must send it in the `x-webhook-secret` header or get a 401. When unset the check is skipped, so set it
in production.

---

## Demo seeding secret — optional

```bash
SEED_DEMO_SECRET=<your-own-secret>
```

Required to call `POST /api/admin/seed-demo` (creates the demo account and store). Callers send it in the
`x-seed-secret` header. When unset the route answers 500 "not configured", so it stays disabled by default.

---

## Exchange rates — optional

```bash
EXCHANGE_RATE_API_KEY=<from-exchangerate-api.com>
# Defaults to https://v6.exchangerate-api.com/v6
EXCHANGE_RATE_API_URL=https://v6.exchangerate-api.com/v6
```

Live currency conversion for the display currency (`src/lib/services/exchange-rate.service.ts`,
`/api/exchange-rates`) and the admin revenue page. Get a key at exchangerate-api.com (free tier: 1,500
requests/month). Without a key the admin revenue page falls back to built-in approximate rates.

---

## Analytics (Google Analytics, Meta Pixel) — optional

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_META_PIXEL_ID=<pixel-id>
```

Both scripts load client-side only after the visitor grants the matching cookie consent
(`src/components/analytics/tracking-vendors.ts`). The IDs are public, and the code ships hardcoded
fallbacks for the production IDs, so these only need setting to point a different environment at a
different property or pixel. Vercel Analytics needs no variable.

---

## Audit trail kill switches — optional

```bash
AUDIT_CAPTURE=off      # stop ALL audit writes
AUDIT_SNAPSHOTS=off    # stop only Layer 3 entity snapshots
```

Read per call in `src/lib/audit/config.ts`. Fail-open by design: unset, or any value other than
`off`, `false`, `0` or `disabled`, means capture is ON, so a missing variable never silently disables
the trail. Use them to shed write load without a deploy; snapshots (a Serializable transaction across
the cascade graph) are the part most likely to need disabling.

---

## Vercel / hosting specific

If deploying on Vercel:

```bash
# Auto-populated by Vercel
VERCEL_URL=
VERCEL_ENV=development|preview|production

# Vercel Blob (image storage, Phase 1)
BLOB_READ_WRITE_TOKEN=<from-vercel-storage>

# Vercel Analytics is enabled via the @vercel/analytics package
```

---

## Admin capacity dashboard — platform usage (optional)

Powers the Vercel/Neon cards on `/admin/capacity`. Without these, that section just
shows "not configured" — everything else on the page (DB size, blob usage, tenant
scale) works without them.

```bash
# Vercel — team-scoped API token (Account Settings → Tokens) + the team id (starts
# with `team_`, found in Team Settings). Reads current-period billing/usage via the
# FOCUS billing-charges API; Vercel exposes no per-account plan-limit API, so this
# reports consumption only — compare against https://vercel.com/docs/limits.
VERCEL_API_TOKEN=
VERCEL_TEAM_ID=

# Neon — API key (Account Settings → API Keys) + project id (Project Settings →
# General). Reads live storage/compute usage and the project's quota limits.
NEON_API_KEY=
NEON_PROJECT_ID=
```

---

## Dev/prod database split (Neon branching)

`DATABASE_URL`/`DIRECT_URL` point at different Neon branches depending on
where the app is running — local dev and Vercel Preview deployments must
never touch the production branch. See `docs/DATABASE.md` for the full
rationale and setup.

| Context                    | Neon branch   | Vercel env target      |
| --------------------------- | ------------- | ----------------------- |
| Local dev (`.env`)          | `development` | n/a                      |
| Vercel Preview (PRs)        | `development` | `preview`                |
| Vercel Production (`main`)  | `main`        | `production`             |

`.env` already points at the `development` branch. Do not copy production's
`DATABASE_URL`/`DIRECT_URL` into `.env` for local work — that defeats the
whole point of the split.

**GitHub Actions secrets** (repo → Settings → Security and quality → Secrets and
variables → Actions) used by `.github/workflows/reset-dev-db.yml`:

- `NEON_API_KEY` — resets the `development` branch and reads its reset status.
- `VERCEL_DEV_DEPLOY_HOOK_URL` — a Vercel Deploy Hook (Project Settings → Git →
  Deploy Hooks) for the branch `dev.epidom.fr` tracks. The workflow POSTs to it
  after each reset so the preview rebuilds and re-applies migrations that are
  not on production yet. See `docs/DATABASE.md`.

---

## Database backup (Cloudflare R2)

Powers the nightly `nightly-database-backup` Inngest cron and the "Database
Backups" card on `/admin/capacity`. Without these, the backup job no-ops (logs
a skip, doesn't create a `BackupRun` row) instead of failing. See
`docs/BACKUP_RESTORE.md` for the full setup + restore runbook.

```bash
# Cloudflare dashboard → R2 → Manage API Tokens (create a bucket-scoped token
# with read+write access) + the bucket name you created for backups.
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# Only for scripts/restore-from-backup.ts: the disposable database to restore into
# (or pass --target=...). The script refuses the app's own live database.
RESTORE_DATABASE_URL=
```

---

## MagicBell (merchant alerts: new order, low/critical stock)

Replaces the old direct VAPID push / Fonnte WhatsApp calls for these two
specific events (`src/lib/magicbell/client.ts`). Everything else — the in-app
NotificationBell, customer-facing WhatsApp receipts, transactional email via
Resend — is unrelated and unaffected. Without these set, both flows log a
warning and no-op (order placement / stock deduction still succeed).

```bash
# MagicBell dashboard → API Keys. Use the permanent key/secret pair — NOT the
# "project auth" bearer token shown in their quick-start (that one is
# short-lived, meant for testing, and will expire on a running server).
MAGICBELL_API_KEY=
MAGICBELL_API_SECRET=
```

Recipient is the store's owning `User` (resolved via `Store.business.user`),
identified to MagicBell by email + `external_id` — configure delivery
channels (web push, mobile push, email, SMS via a connected Twilio account,
Slack) per category in the MagicBell dashboard, not in this app's code.

---

## File: `.env.example`

Keep `.env.example` current. Every required env var must appear here with a placeholder value and a one-line comment explaining what it's for. Never commit a `.env` file with real secrets.

The checked-in `.env.example` is the source of truth for the full variable list and its placeholders; this doc explains each group. Don't keep a second copy of the file here.

---

## Rotation policy

| Key type           | Rotation                                                |
| ------------------ | ------------------------------------------------------- |
| Stripe secret      | Rotate annually, or immediately on suspected compromise |
| Xendit secret      | Rotate annually                                         |
| Better Auth secret | Rotate annually, requires re-login of all users         |
| Fonnte token       | Rotate if WhatsApp number changes                       |
| Database password  | Rotate annually                                         |
| All API tokens     | Rotate immediately if any employee leaves               |

Document each rotation in the operator's runbook (not in the repo).
