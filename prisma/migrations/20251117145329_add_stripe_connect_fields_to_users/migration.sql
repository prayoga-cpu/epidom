-- Add missing Stripe Connect fields to users table
-- These fields were in the schema but missing from the initial migration

-- Add stripeConnectAccountId column (nullable, unique)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripeConnectAccountId" TEXT;

-- Add stripeConnectOnboarded column (default false)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripeConnectOnboarded" BOOLEAN NOT NULL DEFAULT false;

-- Create unique index for stripeConnectAccountId (only for non-null values)
-- Note: PostgreSQL doesn't enforce unique constraint on NULL values by default
CREATE UNIQUE INDEX IF NOT EXISTS "users_stripeConnectAccountId_key" ON "users"("stripeConnectAccountId") WHERE "stripeConnectAccountId" IS NOT NULL;

