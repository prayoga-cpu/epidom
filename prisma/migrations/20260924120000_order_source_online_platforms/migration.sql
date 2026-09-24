-- AlterEnum
-- Online delivery platforms a cashier can key in at the till ("Others" order
-- type). Additive only: every existing row and value is untouched.
ALTER TYPE "OrderSource" ADD VALUE 'UBER_EATS';
ALTER TYPE "OrderSource" ADD VALUE 'DELIVEROO';
ALTER TYPE "OrderSource" ADD VALUE 'JUST_EAT';
ALTER TYPE "OrderSource" ADD VALUE 'DOORDASH';
ALTER TYPE "OrderSource" ADD VALUE 'GRUBHUB';
ALTER TYPE "OrderSource" ADD VALUE 'OTHER_ONLINE';
