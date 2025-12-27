# Installation Guide

## Prerequisites

- **Node.js** 18.x or higher
- **pnpm** (recommended) or npm
- **PostgreSQL** database (or Neon serverless)
- **Stripe** account (for payments)

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-org/epidom.git
cd epidom
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Configure the following required variables:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/epidom"

# Authentication
BETTER_AUTH_SECRET="your-secret-key-min-32-chars"
NEXTAUTH_SECRET="your-nextauth-secret"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Database Setup

Generate Prisma client and run migrations:

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:push
```

### 5. Start Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

---

## Available Scripts

| Script             | Description                             |
| ------------------ | --------------------------------------- |
| `pnpm dev`         | Start development server with Turbopack |
| `pnpm build`       | Build for production                    |
| `pnpm start`       | Start production server                 |
| `pnpm lint`        | Run ESLint                              |
| `pnpm test`        | Run unit tests                          |
| `pnpm db:generate` | Generate Prisma client                  |
| `pnpm db:push`     | Push schema to database                 |
| `pnpm db:studio`   | Open Prisma Studio                      |
| `pnpm db:seed`     | Seed database with sample data          |

---

## Troubleshooting

### Database Connection Issues

Ensure your `DATABASE_URL` is correctly formatted:

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

### Stripe Webhook Issues

For local development, use Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### Authentication Issues

Ensure `BETTER_AUTH_SECRET` is at least 32 characters.
