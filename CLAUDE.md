# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EPIDOM** - A SaaS ERP platform for food businesses (restaurants/manufacturers).

- **Type:** Multi-tenant SaaS (Business -> Stores).
- **Core Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS 4, Shadcn/UI ("New York" style).
- **Database:** PostgreSQL + Prisma ORM (v6.17.1).
- **Auth:** **Better Auth** (migrated from NextAuth).
- **State:** TanStack Query v5 + React Context.
- **Payment:** Stripe (Connect & Billing).

## Development Commands

```bash
# Start development server (opens at http://localhost:3000)
# Uses Turbopack for faster HMR
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint

# Database Management
pnpm prisma generate      # Generate client
pnpm prisma migrate dev   # Run migrations
pnpm prisma studio       # Open database GUI
pnpm prisma db push      # Push schema without migration file (prototyping only)
```

## Environment Setup

Create a `.env` file based on `.env.example`:

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Authentication (Better Auth)
BETTER_AUTH_SECRET=generate-strong-key
# NEXTAUTH_SECRET is supported as fallback but deprecated

# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/epidom"
# Local dev option: "file:./dev.db"

# Services
RESEND_API_KEY=re_...
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
EPIDOM_OWNER_EMAIL=owner@epidom.com
```

## Architecture

### Route Structure (App Router)

- `src/app/(marketing)`: Public pages (Landing, Pricing). Uses `I18nProvider`.
- `src/app/(app)/`: Protected routes.
  - `(auth)`: Login/Register pages.
  - `(stores)`: Store selection after login.
  - `(dashboard)`: Main application interface (per-store scope).
- `src/app/api`: Backend routes (Auth, Webhooks, Data).

### Core Features & Implementation Status

| Feature            | Status            | Implementation Details                                                       |
| :----------------- | :---------------- | :--------------------------------------------------------------------------- |
| **Authentication** | ✅ **Active**     | **Better Auth**. Custom `useSession` hook in `src/lib/auth-client.ts`.       |
| **Database**       | ✅ **Active**     | **Prisma ORM**. Complex schema for Production/Inventory.                     |
| **Data Fetching**  | ✅ **Active**     | **Real API**. Uses `src/hooks/use-products` etc. which call `/api/stores/*`. |
| **Forms**          | 🔄 **Transition** | Moving from `FormData` to `react-hook-form` + `zod`.                         |
| **Payments**       | ✅ **Active**     | Stripe Connect & Subscriptions configured.                                   |
| **Testing**        | ❌ **Missing**    | Needs Unit & E2E tests (`src/test` is empty).                                |

### Authentication System (Better Auth)

The project uses **Better Auth** with a database adapter.

- **Config:** `src/lib/auth.ts`
- **Client Hook:** `src/lib/auth-client.ts`
  - Uses a custom `useSession` hook that fetches from `/api/session`.
  - Does **NOT** use the standard `better-auth/react` session hook directly for fetching, but uses `createAuthClient` for actions (`signIn`, `signUp`).
- **Session Provider:** `src/components/providers/session-provider.tsx` (Pass-through/Minimal).
- **Server Session:** `getSession()` from `src/lib/auth.ts`.
  - Verifies signed cookies manually for performance/security before DB query.

**Usage:**

```typescript
// Client Component
import { useUser } from "@/lib/auth-client";
const { user, loading } = useUser();

// Server Component / API Route
import { getSession } from "@/lib/auth";
const session = await getSession();
```

### Database & Models

**Key Models (`prisma/schema.prisma`):**

- **Hierarchy:** `User` -> `Business` -> `Store` (1:N).
- **Inventory:** `Product` (sellable) vs `Material` (ingredients).
- **Traceability:** `StockMovement` (Audit Log), `ProductionBatch`.

**Development Rule:**

- Always scope queries to `storeId`.
- Use `Decimal` for currency/quantities (Prisma `Decimal` type).

## Component Organization (FDA)

We follow **Feature Driven Architecture**:

```text
src/
├── features/              # FEATURE LOGIC (Hub of the app)
│   ├── dashboard/         # Dashboard Feature
│   │   ├── components/    # Shared Dashboard UI
│   │   ├── inventory/     # Inventory Page Logic
│   │   │   └── components/# Page-specific components
│   │   └── ...
│   ├── auth/              # Auth Feature
│   └── marketing/         # Marketing Feature
├── components/            # SHARED UI Utilities
│   ├── ui/                # Shadcn primitives
│   └── providers/         # Global Contexts
├── lib/                   # CORE LOGIC
│   ├── api/               # Fetch wrappers
│   ├── auth.ts            # Auth Config
│   └── validation/        # Zod Schemas
```

### Best Practices

1.  **Pages are Thin:** `page.tsx` should only fetch data (if server) and import the root feature component.
2.  **Shared vs Specific:** Put components in `src/components/ui` ONLY if they are generic (buttons, inputs). If they are domain-specific (e.g., "ProductCard"), put them in `src/features/...`.
3.  **Translation:** Use `useI18n()` hook.
    - Source strings in `src/locales/{en,fr,id}.ts`.

## Styling

- **Tailwind CSS 4**: Used for all styling.
- **Shadcn/UI**: Component library source is in `src/components/ui`.
- **Icons**: Lucide React.
- **Fonts**: Geist (App), Lato (Marketing).

## Documentation

- Place generated documentation in `/docs`.
