This is a [Next.js](https://nextjs.org) 15 project with Next.js App Router, bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

**EPIDOM** - A complete restaurant & food business management platform with Stripe payment integration, multi-language support (EN/FR/ID), and subscription-based pricing.

## Tech Stack

- **Framework**: Next.js 15 (App Router with Turbopack)
- **Language**: TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: NextAuth.js (JWT strategy)
- **Payment**: Stripe (Checkout Sessions, Customer Portal, Connect for 80/20 split)
- **State Management**: TanStack Query (React Query)
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **Internationalization**: Custom i18n provider (EN/FR/ID)

## Developer Setup

### Prerequisites

- Node.js 18+ (recommended: 20 LTS)
- pnpm package manager
- PostgreSQL 14+ database
- Stripe account (for payment testing)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Setup Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/epidom"

# NextAuth Configuration
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

# Authentication Providers (Google OAuth)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Stripe Configuration
STRIPE_PUBLIC_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# File Upload (S3 or similar)
NEXT_PUBLIC_STORAGE_URL="http://localhost:3000/uploads"
```

### 3. Setup Database

```bash
# Create database schema and run migrations
pnpm prisma migrate dev

# (Optional) Open Prisma Studio to view data
pnpm prisma studio
```

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Available Scripts

```bash
# Development
pnpm dev              # Start development server with Turbopack

# Production
pnpm build            # Build for production
pnpm start            # Start production server

# Database
pnpm prisma migrate dev      # Create and run migrations
pnpm prisma migrate reset    # Reset database (DEVELOPMENT ONLY!)
pnpm prisma studio          # Open Prisma Studio UI

# Linting & Type Checking
pnpm lint             # Run ESLint
pnpm type-check       # Run TypeScript type checking
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/             # Protected routes (requires subscription)
│   ├── (marketing)/       # Public marketing routes
│   ├── api/               # API routes & webhooks
│   └── layout.tsx         # Root layout with providers
├── components/            # React components
├── features/              # Feature modules (auth, dashboard, etc.)
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities & services
│   ├── services/          # Business logic (subscription, payments)
│   ├── repositories/      # Database queries
│   ├── stripe.ts          # Stripe client configuration
│   └── auth.ts            # Authentication configuration
├── locales/               # i18n translations (EN/FR/ID)
├── types/                 # TypeScript type definitions
└── utils/                 # Helper utilities
```

## Key Features

### ✅ Authentication

- Google OAuth integration
- JWT-based session management
- Protected routes (app-level, subscription-gated)

### ✅ Payment System

- Stripe Checkout Sessions (2-tier pricing: Starter €29/mo, Pro €79/mo)
- 80/20 revenue split (via Stripe Connect)
- Subscription management (auto-renew, cancel, upgrade/downgrade)
- Webhook handling for payment events

### ✅ Store Management

- Multi-store support (based on subscription tier)
- Inventory/materials tracking
- Recipe & product management
- Production batch tracking

### ✅ Internationalization (i18n)

- English (EN), French (FR), Indonesian (ID)
- Language switcher on marketing pages
- App-level language preference storage

### ✅ Dashboard

- Owner profile & business setup
- Subscription status & billing
- Store creation & management
- Revenue analytics

## Testing Stripe Locally

### Test Cards

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

Any future date for expiry, any 3-digit CVC, any 5-digit postal code.

## Development Workflow

### Adding a New Page

1. Create route folder in `src/app/(app)/` or `src/app/(marketing)/`
2. Add `page.tsx` for the page component
3. Add i18n strings in `src/locales/*.ts` if needed
4. Wrap with layout if needed (e.g., ProfileNav, SiteHeader)

### Adding a New API Endpoint

1. Create file in `src/app/api/[path]/route.ts`
2. Implement handler: `export async function GET|POST|PUT|DELETE(req, { params })`
3. Add error handling and validation
4. Add webhook verification if needed (Stripe webhooks already implemented)

### Database Changes

1. Update `prisma/schema.prisma`
2. Run `pnpm prisma migrate dev --name describe_change`
3. Review generated migration SQL
4. Test with `pnpm prisma studio`

## Deployment

### Vercel (Recommended)

```bash
# Push to GitHub main/production branch
git push origin feat/payment

# Vercel auto-deploys on push
# Configure environment variables in Vercel dashboard
```

### Manual Deployment

```bash
pnpm build
pnpm start
```

Remember to:

- Set production environment variables
- Update `NEXTAUTH_URL` to production domain
- Configure Stripe webhook endpoint to production URL
- Run migrations on production database

## Troubleshooting

### Port 3000 already in use

```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (Windows)
taskkill /PID <PID> /F
```

### Database connection issues

```bash
# Check PostgreSQL is running
# Verify DATABASE_URL in .env.local
# Test connection: pnpm prisma studio
```

### Stripe webhook not working locally

Use Stripe CLI to forward webhooks:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### TypeScript errors after git pull

```bash
pnpm install
pnpm prisma generate
```

## Contributing

1. Create feature branch: `git checkout -b feat/feature-name`
2. Make changes and test locally: `pnpm dev`
3. Run type check: `pnpm lint`
4. Commit: `git commit -m "feat: description"`
5. Push and create Pull Request

## Support

For detailed documentation:

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)
- [Stripe Documentation](https://stripe.com/docs)
