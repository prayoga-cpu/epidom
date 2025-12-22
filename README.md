**EPIDOM** - A complete restaurant & food business management platform with Stripe payment integration, multi-language support (EN/FR/ID), and subscription-based pricing.

## Tech Stack

- **Framework**: Next.js 15 (App Router with Turbopack)
- **Language**: TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: **Better Auth** (Email/Password + Google OAuth)
- **Payment**: Stripe (Checkout Sessions, Customer Portal, Connect for 80/20 split)
- **State Management**: TanStack Query (React Query)
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS 4
- **Internationalization**: Custom i18n provider (EN/FR/ID)
- **Email**: Resend

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

Create a `.env` file in the root directory (see `.env.example`):

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/epidom"

# Better Auth Configuration
BETTER_AUTH_SECRET="generate-strong-random-key"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Authentication Providers (Google OAuth)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Stripe Configuration
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email (Resend)
RESEND_API_KEY="re_..."
EMAIL_FROM="EPIDOM <noreply@yourdomain.com>"
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
├── components/            # Shared React components
├── features/              # Feature modules (auth, dashboard, etc.)
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities & services
│   ├── auth.ts            # Better Auth server config
│   ├── auth-client.ts     # Client auth hooks
│   ├── prisma.ts          # DB client
│   └── validation/        # Zod schemas
├── locales/               # i18n translations (EN/FR/ID)
├── types/                 # TypeScript type definitions
└── utils/                 # Helper utilities
```

## Key Features

### ✅ Authentication

- **Better Auth** integration
- Secure session management (HMAC signed cookies)
- Google OAuth & Credential login
- Protected routes middleware

### ✅ Payment System

- Stripe Checkout Sessions (Starter & Pro plans)
- 80/20 revenue split (via Stripe Connect)
- Webhook handling for payment events

### ✅ Store Management

- Multi-store support (Business -> Stores)
- Inventory/materials tracking
- Recipe & product management
- Production batch tracking

### ✅ Internationalization (i18n)

- English (EN), French (FR), Indonesian (ID)
- Language switcher on marketing pages

### ✅ Dashboard

- Revenue analytics & business insights
- Complete Inventory Management (Real-time sync)
- Production planning & batch tracking
- Role-based access control per store

## Development Workflow

### Adding a New Page

1. Create route folder in `src/app/(app)/` or `src/app/(marketing)/`
2. Add `page.tsx`
3. Import feature components from `src/features/...`

### Database Changes

1. Update `prisma/schema.prisma`
2. Run `pnpm prisma migrate dev --name describe_change`
3. Test with `pnpm prisma studio`
