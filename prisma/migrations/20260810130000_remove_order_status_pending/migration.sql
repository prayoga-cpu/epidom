-- AlterEnum: PENDING is being removed from OrderStatus. Postgres has no
-- ALTER TYPE ... DROP VALUE, so this follows the same recreate-the-type
-- pattern as 20260521000000_rename_subscription_plans: build the new enum,
-- repoint the column through a USING cast (backfilling any existing PENDING
-- rows to CONFIRMED -- the same status resolveSettledOrderStatus() now sends
-- a newly-created order to in its place), drop the old type, rename the new
-- one into place. Idempotent/safe whether 0 or many rows are on PENDING.
CREATE TYPE "OrderStatus_new" AS ENUM ('CONFIRMED', 'IN_PRODUCTION', 'READY', 'DELIVERED', 'CANCELLED', 'HELD');

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;

-- AlterColumn with data mapping
ALTER TABLE "orders"
  ALTER COLUMN "status" TYPE "OrderStatus_new"
  USING (
    CASE
      WHEN status = 'PENDING' THEN 'CONFIRMED'::text
      ELSE status::text
    END
  )::"OrderStatus_new";

-- Drop old Enum
DROP TYPE "OrderStatus";

-- Rename new Enum to original name
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";

-- Re-add default
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';
