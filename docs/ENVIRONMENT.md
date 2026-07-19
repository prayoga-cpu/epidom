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
| Fonnte        | WhatsApp notifications | Phase 2     |
| Inngest       | Background jobs        | Phase 2     |
| Resend        | Transactional email    | Existing    |
| Google OAuth  | Google login button    | Existing    |
| Sentry        | Error tracking         | Phase 1     |
| Upstash Redis | Rate limiting          | Phase 1     |
| Feature flags | Hiding legacy surfaces | Phase 0     |

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
EPIDOM_OWNER_EMAIL=owner@epidom.id
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

## Fonnte (WhatsApp notifications, Phase 2+)

```bash
FONNTE_API_TOKEN=<from-fonnte-dashboard>
FONNTE_SENDER_NUMBER=628xxxxxxxxx  # WA number connected to Fonnte
```

**Where to get a token:**

1. Sign up at fonnte.com
2. Connect a WhatsApp number (you'll scan a QR with the WA Web app)
3. Get the token from Dashboard → API
4. Important: this is unofficial and the account can be flagged by Meta. Plan migration to official WhatsApp Business API by 100 paying customers.

---

## WhatsApp Business API (Phase 4+, migration target)

When migrating from Fonnte to official Meta API:

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
EMAIL_FROM="Epidom <noreply@epidom.id>"
```

**Where to get a key:**

1. Sign up at resend.com
2. Add and verify your domain (`epidom.id`)
3. Create an API key under API Keys

DNS records required at the domain level:

- SPF
- DKIM
- DMARC (recommended)

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

# === Fonnte (WhatsApp, Phase 2) ===
FONNTE_API_TOKEN=
FONNTE_SENDER_NUMBER=

# === Inngest (background jobs, Phase 2) ===
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# === Resend (email) ===
RESEND_API_KEY=re_
EMAIL_FROM=Epidom <noreply@epidom.id>

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
EPIDOM_OWNER_EMAIL=owner@epidom.id
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
