-- CreateEnum
CREATE TYPE "SubscriptionPlan_new" AS ENUM ('FREE', 'POS', 'OPERATIONS', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "subscriptions" ALTER COLUMN "plan" DROP DEFAULT;

-- AlterColumn with data mapping
ALTER TABLE "subscriptions" 
  ALTER COLUMN "plan" TYPE "SubscriptionPlan_new" 
  USING (
    CASE 
      WHEN plan = 'STARTER' AND status IN ('ACTIVE', 'PAST_DUE') THEN 'POS'::text
      WHEN plan = 'STARTER' THEN 'FREE'::text
      WHEN plan = 'PRO' THEN 'OPERATIONS'::text
      WHEN plan = 'ENTERPRISE' THEN 'ENTERPRISE'::text
    END
  )::"SubscriptionPlan_new";

-- Drop old Enum
DROP TYPE "SubscriptionPlan";

-- Rename new Enum to original name
ALTER TYPE "SubscriptionPlan_new" RENAME TO "SubscriptionPlan";

-- Re-add default
ALTER TABLE "subscriptions" ALTER COLUMN "plan" SET DEFAULT 'FREE';
