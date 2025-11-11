-- Drop old unique constraints on subscriptions
DROP INDEX IF EXISTS "subscriptions_userId_key";
DROP INDEX IF EXISTS "subscriptions_stripeCustomerId_key";

-- Add indexes for performance
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- Add unique constraint to prevent multiple ACTIVE subscriptions for same plan
CREATE UNIQUE INDEX "subscriptions_userId_status_plan_key" ON "subscriptions"("userId", "status", "plan") WHERE "status" = 'ACTIVE';
