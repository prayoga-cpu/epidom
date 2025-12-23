# Environment Variables

## Required Variables

### Database

| Variable       | Description                  | Example                               |
| -------------- | ---------------------------- | ------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |

### Authentication

| Variable             | Description                           | Example                           |
| -------------------- | ------------------------------------- | --------------------------------- |
| `BETTER_AUTH_SECRET` | Auth encryption secret (min 32 chars) | `your-super-secret-key-here-32ch` |
| `NEXTAUTH_SECRET`    | NextAuth secret key                   | `another-secret-key`              |

### Stripe

| Variable                             | Description            | Example       |
| ------------------------------------ | ---------------------- | ------------- |
| `STRIPE_SECRET_KEY`                  | Stripe secret key      | `sk_test_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe public key      | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET`              | Webhook signing secret | `whsec_...`   |

### Application

| Variable              | Description     | Example                  |
| --------------------- | --------------- | ------------------------ |
| `NEXT_PUBLIC_APP_URL` | Application URL | `https://app.epidom.com` |
| `NEXT_PUBLIC_API_URL` | API base URL    | `/api`                   |

---

## Optional Variables

### Email (Resend)

| Variable         | Description    | Default              |
| ---------------- | -------------- | -------------------- |
| `RESEND_API_KEY` | Resend API key | -                    |
| `EMAIL_FROM`     | Sender email   | `noreply@epidom.com` |

### OAuth Providers

| Variable               | Description            |
| ---------------------- | ---------------------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret    |

### Feature Flags

| Variable         | Description            | Default      |
| ---------------- | ---------------------- | ------------ |
| `PROMO_END_DATE` | Promotional period end | `2025-12-31` |

---

## Example `.env` File

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/epidom?schema=public"

# Authentication
BETTER_AUTH_SECRET="your-32-character-secret-key-here"
NEXTAUTH_SECRET="your-nextauth-secret-key"

# Stripe
STRIPE_SECRET_KEY="sk_test_xxxxxxxxxxxx"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_xxxxxxxxxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxx"
NEXT_PUBLIC_STRIPE_PRICE_ID_STARTER="price_starter"
NEXT_PUBLIC_STRIPE_PRICE_ID_PRO="price_pro"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

# Email (optional)
RESEND_API_KEY=""
EMAIL_FROM="noreply@epidom.com"

# OAuth (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```
