-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "clientRequestId" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "costPriceManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "costPriceOriginal" DECIMAL(10,2);

-- Deliberately NO backfill.
--
-- costPriceManual defaults false, meaning "let the primary recipe drive this
-- cost". That is the right default for existing rows: until now nothing ever
-- cascaded, so every stored costPrice is either recipe-derived already (the
-- product form auto-filled it) or a figure the owner typed. The first cascade
-- snapshots whatever was there into costPriceOriginal before overwriting, so
-- the distinction is recoverable per product rather than guessed at here.
--
-- costPriceOriginal stays NULL until that first cascade — a NULL means "never
-- been overwritten", which is exactly what the revert path needs to know.
--
-- clientRequestId stays NULL for every existing and every ONLINE order. Only
-- the offline replay path sets it. Postgres permits unlimited NULLs in a UNIQUE
-- index, so this constraint costs nothing for the 99% case.

-- CreateIndex
CREATE UNIQUE INDEX "orders_clientRequestId_key" ON "orders"("clientRequestId");

-- ---------------------------------------------------------------------------
-- Manual down-SQL (Prisma migrations are forward-only).
--   DROP INDEX "orders_clientRequestId_key";
--   ALTER TABLE "orders" DROP COLUMN "clientRequestId";
--   ALTER TABLE "products" DROP COLUMN "costPriceManual",
--                          DROP COLUMN "costPriceOriginal";
-- Reverting the cascade's EFFECT (not just the columns) means, per product:
--   UPDATE "products" SET "costPrice" = "costPriceOriginal"
--    WHERE "costPriceOriginal" IS NOT NULL;
-- Run that BEFORE dropping the columns, or the original figures are lost.
-- ---------------------------------------------------------------------------
