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
| Sentry        | Error tracking         | Phase 1     |
| Upstash Redis | Rate limiting          | Phase 1     |
| Feature flags | Hiding legacy surfaces | Phase 0     |
| Web Push      | Order/low-stock push notifications | Maintenance |

---

## Core app

```bash
# Public URL of your app
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/epidom"
# For local dev with SQLite fallback (not recommended)
# DATABASE_URL="file:./dev.db"

# Operator email (used for low-level system notifications)
EPIDOM_OWNER_EMAIL=owner@epidom.fr
```

---

## Authentication (Better Auth)

```bash
# Generate with: openssl rand -hex 32
BETTER_AUTH_SECRET=<random-hex-string>

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

# Client-side
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Price IDs, one per tier per cadence
STRIPE_PRICE_POS_MONTHLY_IDR=price_...
STRIPE_PRICE_POS_ANNUAL_IDR=price_...
STRIPE_PRICE_OPS_MONTHLY_IDR=price_...
STRIPE_PRICE_OPS_ANNUAL_IDR=price_...
STRIPE_PRICE_ENT_MONTHLY_IDR=price_...
STRIPE_PRICE_ENT_ANNUAL_IDR=price_...
```

**Where to get keys:**

1. Stripe dashboard → Developers → API keys
2. Use test mode keys for local development
3. Webhook secret: Stripe → Developers → Webhooks → click your endpoint → reveal signing secret

**Setting up webhooks for local dev:**

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The CLI prints the webhook secret. Paste it into `STRIPE_WEBHOOK_SECRET`.

---

## Xendit (customer payments, Phase 2+)

```bash
XENDIT_SECRET_KEY=xnd_development_...
XENDIT_WEBHOOK_TOKEN=<from-xendit-dashboard>
XENDIT_CALLBACK_URL=https://your-tunnel-url.com/api/webhooks/xendit
```

**Where to get keys:**

1. Sign up at xendit.co
2. Get test mode API keys from Dashboard → Settings → Developers → API Keys
3. Configure webhooks at Dashboard → Settings → Webhooks
4. Set `XENDIT_WEBHOOK_TOKEN` to the verification token shown

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
  360dialog) — see the section below. Requires a verified Meta Business
  account and per-template message approval, but won't get your number
  banned and is the actual production-grade path.
- **Twilio WhatsApp API** specifically — same BSP category as above, but
  worth calling out on its own since it's the easiest of the three to get a
  sandbox running same-day (Twilio's WhatsApp sandbox needs no Meta Business
  verification to start testing), then graduate to a paid Twilio WhatsApp
  Sender once ready for production.

---

## WhatsApp Business API (Phase 4+, migration target)

Official Meta Cloud API, accessed through a BSP partner:

```bash
WHATSAPP_PHONE_NUMBER_ID=<from-meta-business>
WHATSAPP_BUSINESS_ACCOUNT_ID=<from-meta-business>
WHATSAPP_ACCESS_TOKEN=<system-user-token>
WHATSAPP_WEBHOOK_VERIFY_TOKEN=<your-own-secret>
```

Requires:

- Verified Meta Business account
- WhatsApp Business API access (apply through a BSP partner like Twilio, MessageBird, or 360dialog)
- Per-template message approval

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

## Sentry (error tracking, Phase 1+)

```bash
SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=<for-source-map-uploads>
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

**Where to get keys:**

1. Sign up at sentry.io
2. Create a Next.js project
3. Run `npx @sentry/wizard@latest -i nextjs` (one-time setup)

---

## Upstash Redis (rate limiting, Phase 1+)

```bash
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=<from-upstash-console>
```

**Where to get keys:**

1. Sign up at upstash.com
2. Create a Redis database in Singapore region
3. Copy REST URL and token

Used for: public order endpoint rate limiting, OTP throttling.

---

## Feature flags (Phase 0+)

```bash
# Legacy inventory / production surfaces, hidden until Phase 4
NEXT_PUBLIC_FEATURE_LEGACY_INVENTORY=false

# Storefront editor (Phase 1 development toggle)
NEXT_PUBLIC_FEATURE_STOREFRONT_EDITOR=false

# Aggregator dashboard (Phase 5 development toggle)
NEXT_PUBLIC_FEATURE_AGGREGATOR=false
```

Flag values are read at build time in client code (`NEXT_PUBLIC_*` prefix) and at request time on the server.

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

Example structure:

```bash
# === Core app ===
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://user:pass@localhost:5432/epidom

# === Authentication ===
BETTER_AUTH_SECRET=generate-with-openssl-rand-hex-32
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# === Stripe (SaaS billing) ===
STRIPE_SECRET_KEY=sk_test_
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_
STRIPE_WEBHOOK_SECRET=whsec_
# Price IDs for each tier
STRIPE_PRICE_POS_MONTHLY_IDR=
STRIPE_PRICE_POS_ANNUAL_IDR=
STRIPE_PRICE_OPS_MONTHLY_IDR=
STRIPE_PRICE_OPS_ANNUAL_IDR=
STRIPE_PRICE_ENT_MONTHLY_IDR=
STRIPE_PRICE_ENT_ANNUAL_IDR=

# === Xendit (customer payments, Phase 2) ===
XENDIT_SECRET_KEY=
XENDIT_WEBHOOK_TOKEN=
XENDIT_CALLBACK_URL=

# === Inngest (background jobs, Phase 2) ===
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# === Resend (email) ===
RESEND_API_KEY=re_
EMAIL_FROM=Epidom <noreply@epidom.fr>

# === Sentry (error tracking, Phase 1) ===
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
NEXT_PUBLIC_SENTRY_DSN=

# === Upstash Redis (rate limiting, Phase 1) ===
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# === Feature flags ===
NEXT_PUBLIC_FEATURE_LEGACY_INVENTORY=false
NEXT_PUBLIC_FEATURE_STOREFRONT_EDITOR=false
NEXT_PUBLIC_FEATURE_AGGREGATOR=false

# === Operator ===
EPIDOM_OWNER_EMAIL=owner@epidom.fr
```

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
