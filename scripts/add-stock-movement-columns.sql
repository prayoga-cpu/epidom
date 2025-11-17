-- Add reason and referenceId columns to stock_movements table
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "referenceId" TEXT;

