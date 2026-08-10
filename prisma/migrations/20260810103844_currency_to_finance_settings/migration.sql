-- CreateEnum
CREATE TYPE "PaymentMarket" AS ENUM ('INDONESIA', 'FRANCE', 'INTERNATIONAL');

-- AlterTable: add currency/market/enabledPaymentMethods, defaulted so every
-- existing row gets a value immediately (backfilled to the real value below).
ALTER TABLE "business_finance_settings"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'IDR',
  ADD COLUMN "enabledPaymentMethods" "PaymentMethod"[] DEFAULT ARRAY['CASH', 'QRIS', 'GOPAY', 'OVO', 'DANA', 'SHOPEEPAY', 'BANK_TRANSFER', 'STRIPE_CARD']::"PaymentMethod"[],
  ADD COLUMN "market" "PaymentMarket" NOT NULL DEFAULT 'INDONESIA';

ALTER TABLE "store_finance_settings"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'IDR',
  ADD COLUMN "enabledPaymentMethods" "PaymentMethod"[] DEFAULT ARRAY['CASH', 'QRIS', 'GOPAY', 'OVO', 'DANA', 'SHOPEEPAY', 'BANK_TRANSFER', 'STRIPE_CARD']::"PaymentMethod"[],
  ADD COLUMN "market" "PaymentMarket" NOT NULL DEFAULT 'INDONESIA';

-- Data migration: currency used to live on User (business.user.currency was
-- the effective value read everywhere) and Business.currency was dead code.
-- Preserve every account's current displayed currency by copying
-- User.currency onto the store/business finance-settings row it now lives
-- on — creating that row where one doesn't exist yet (most stores/
-- businesses never touched Fees & Taxes, so have no row at all).
--
-- Market is seeded via the same currency+locale+country heuristic as
-- inferMarket() in src/config/payment-fees.config.ts — a one-time suggested
-- default, not a source of truth; merchants can change it freely afterward.

-- Backfill Business rows lacking a BusinessFinanceSettings row.
INSERT INTO "business_finance_settings"
  ("id", "businessId", "currency", "market", "enabledPaymentMethods", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  b."id",
  u."currency",
  CASE
    WHEN u."currency" = 'IDR' AND b."locale" = 'id' AND b."country" ILIKE '%indonesia%' THEN 'INDONESIA'::"PaymentMarket"
    WHEN u."currency" = 'EUR' AND b."locale" = 'fr' AND b."country" ILIKE '%france%' THEN 'FRANCE'::"PaymentMarket"
    ELSE 'INTERNATIONAL'::"PaymentMarket"
  END,
  ARRAY['CASH', 'QRIS', 'GOPAY', 'OVO', 'DANA', 'SHOPEEPAY', 'BANK_TRANSFER', 'STRIPE_CARD']::"PaymentMethod"[],
  now(),
  now()
FROM "businesses" b
JOIN "user" u ON u."id" = b."userId"
WHERE NOT EXISTS (
  SELECT 1 FROM "business_finance_settings" bfs WHERE bfs."businessId" = b."id"
);

-- Backfill currency/market on BusinessFinanceSettings rows that already existed.
UPDATE "business_finance_settings" bfs
SET
  "currency" = u."currency",
  "market" = CASE
    WHEN u."currency" = 'IDR' AND b."locale" = 'id' AND b."country" ILIKE '%indonesia%' THEN 'INDONESIA'::"PaymentMarket"
    WHEN u."currency" = 'EUR' AND b."locale" = 'fr' AND b."country" ILIKE '%france%' THEN 'FRANCE'::"PaymentMarket"
    ELSE 'INTERNATIONAL'::"PaymentMarket"
  END
FROM "businesses" b
JOIN "user" u ON u."id" = b."userId"
WHERE bfs."businessId" = b."id";

-- Backfill Store rows lacking a StoreFinanceSettings row. Currency/locale
-- come from the store's owning business/user; country prefers the store's
-- own address, falling back to the business's.
INSERT INTO "store_finance_settings"
  ("id", "storeId", "currency", "market", "enabledPaymentMethods", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  s."id",
  u."currency",
  CASE
    WHEN u."currency" = 'IDR' AND b."locale" = 'id' AND COALESCE(s."country", b."country") ILIKE '%indonesia%' THEN 'INDONESIA'::"PaymentMarket"
    WHEN u."currency" = 'EUR' AND b."locale" = 'fr' AND COALESCE(s."country", b."country") ILIKE '%france%' THEN 'FRANCE'::"PaymentMarket"
    ELSE 'INTERNATIONAL'::"PaymentMarket"
  END,
  ARRAY['CASH', 'QRIS', 'GOPAY', 'OVO', 'DANA', 'SHOPEEPAY', 'BANK_TRANSFER', 'STRIPE_CARD']::"PaymentMethod"[],
  now(),
  now()
FROM "stores" s
JOIN "businesses" b ON b."id" = s."businessId"
JOIN "user" u ON u."id" = b."userId"
WHERE NOT EXISTS (
  SELECT 1 FROM "store_finance_settings" sfs WHERE sfs."storeId" = s."id"
);

-- Backfill currency/market on StoreFinanceSettings rows that already existed.
UPDATE "store_finance_settings" sfs
SET
  "currency" = u."currency",
  "market" = CASE
    WHEN u."currency" = 'IDR' AND b."locale" = 'id' AND COALESCE(s."country", b."country") ILIKE '%indonesia%' THEN 'INDONESIA'::"PaymentMarket"
    WHEN u."currency" = 'EUR' AND b."locale" = 'fr' AND COALESCE(s."country", b."country") ILIKE '%france%' THEN 'FRANCE'::"PaymentMarket"
    ELSE 'INTERNATIONAL'::"PaymentMarket"
  END
FROM "stores" s
JOIN "businesses" b ON b."id" = s."businessId"
JOIN "user" u ON u."id" = b."userId"
WHERE sfs."storeId" = s."id";

-- AlterTable: drop the now-fully-replaced legacy currency fields.
ALTER TABLE "businesses" DROP COLUMN "currency";
ALTER TABLE "user" DROP COLUMN "currency";
