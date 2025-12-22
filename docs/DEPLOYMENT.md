# Deployment Guide

## Overview

EPIDOM is designed to be deployed on **Vercel** with a **PostgreSQL** database (Neon recommended).

---

## Prerequisites

- Vercel account
- PostgreSQL database (Neon, Supabase, or self-hosted)
- Stripe account with products configured
- (Optional) Resend account for emails

---

## Vercel Deployment

### 1. Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Select the `main` branch

### 2. Configure Environment Variables

Add the following in Vercel project settings:

```
# Required
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...
NEXTAUTH_SECRET=...
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Stripe Price IDs
NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER=price_...
NEXT_PUBLIC_STRIPE_PRICE_ID_PRO=price_...

# Optional
RESEND_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### 3. Deploy

Click "Deploy" and Vercel will:

1. Install dependencies
2. Build the application
3. Deploy to production

---

## Database Setup

### Neon (Recommended)

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string
3. Add to `DATABASE_URL` in Vercel

### Run Migrations

After deployment, run migrations:

```bash
# From local machine with production DATABASE_URL
DATABASE_URL="postgresql://..." pnpm db:push
```

---

## Stripe Webhook Setup

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://your-domain.com/api/webhooks/stripe`
4. Events to listen:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

---

## Custom Domain

1. In Vercel, go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. Update `NEXT_PUBLIC_APP_URL` to your domain

---

## Production Checklist

| Item                             | Status |
| -------------------------------- | ------ |
| Environment variables configured | ☐      |
| Database migrated                | ☐      |
| Stripe webhook configured        | ☐      |
| Custom domain (optional)         | ☐      |
| SSL certificate active           | ☐      |
| Error monitoring (Sentry)        | ☐      |
| Analytics enabled                | ☐      |

---

## Monitoring

### Vercel Analytics

Built-in analytics are enabled automatically.

### Error Tracking (Recommended)

Add Sentry for production error monitoring:

```typescript
// src/instrumentation.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
```

---

## Scaling Considerations

### Database Connection Pooling

For serverless, use connection pooling:

```
DATABASE_URL="postgresql://...?pgbouncer=true"
```

### Rate Limiting

Current implementation uses in-memory rate limiting. For multiple instances, consider Redis:

```bash
pnpm add @upstash/ratelimit @upstash/redis
```

---

## Rollback

To rollback to a previous deployment:

1. Go to Vercel → Deployments
2. Find the previous successful deployment
3. Click "..." → "Promote to Production"
