-- CreateEnum
CREATE TYPE "FiscalEntryKind" AS ENUM ('SALE', 'REFUND', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "FiscalClosureKind" AS ENUM ('DAY', 'MONTH', 'YEAR');

-- CreateTable
CREATE TABLE "fiscal_chain_heads" (
    "storeId" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    "lastHash" TEXT NOT NULL DEFAULT '',
    "lastDay" TEXT NOT NULL DEFAULT '',
    "totalNet" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "totalAbsolute" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_chain_heads_pkey" PRIMARY KEY ("storeId","chain")
);

-- CreateTable
CREATE TABLE "fiscal_entries" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "kind" "FiscalEntryKind" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "businessDay" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "totalNet" DECIMAL(16,2) NOT NULL,
    "totalAbsolute" DECIMAL(16,2) NOT NULL,
    "payload" TEXT NOT NULL,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "signature" TEXT,
    "keyId" TEXT,
    "late" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_closures" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "kind" "FiscalClosureKind" NOT NULL,
    "period" TEXT NOT NULL,
    "firstEntrySeq" INTEGER NOT NULL,
    "lastEntrySeq" INTEGER NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "salesTotal" DECIMAL(16,2) NOT NULL,
    "refundsTotal" DECIMAL(16,2) NOT NULL,
    "cancellationsTotal" DECIMAL(16,2) NOT NULL,
    "net" DECIMAL(16,2) NOT NULL,
    "totalNet" DECIMAL(16,2) NOT NULL,
    "totalAbsolute" DECIMAL(16,2) NOT NULL,
    "payload" TEXT NOT NULL,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "signature" TEXT,
    "keyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_archives" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "firstEntrySeq" INTEGER NOT NULL,
    "lastEntrySeq" INTEGER NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "contentHash" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "signature" TEXT,
    "keyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_signing_keys" (
    "keyId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "firstUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_signing_keys_pkey" PRIMARY KEY ("keyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_entries_dedupeKey_key" ON "fiscal_entries"("dedupeKey");

-- CreateIndex
CREATE INDEX "fiscal_entries_storeId_businessDay_idx" ON "fiscal_entries"("storeId", "businessDay");

-- CreateIndex
CREATE INDEX "fiscal_entries_orderId_idx" ON "fiscal_entries"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_entries_storeId_seq_key" ON "fiscal_entries"("storeId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_closures_storeId_seq_key" ON "fiscal_closures"("storeId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_closures_storeId_kind_period_key" ON "fiscal_closures"("storeId", "kind", "period");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_archives_storeId_seq_key" ON "fiscal_archives"("storeId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_archives_storeId_period_key" ON "fiscal_archives"("storeId", "period");


-- Append-only: a fiscal record, once written, is never changed or removed
-- (CGI art. 286, I, 3° bis: inaltérabilité). The chain heads are the one
-- mutable table and are left out. Corrections are new records (a REFUND or
-- CANCELLATION entry), never edits. A future retention job that purges
-- records past their 6-year conservation period replaces this function in
-- its own migration.
CREATE OR REPLACE FUNCTION "fiscal_forbid_change"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'fiscal records are append-only: % on % refused', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "fiscal_entries_append_only" BEFORE UPDATE OR DELETE ON "fiscal_entries"
  FOR EACH ROW EXECUTE FUNCTION "fiscal_forbid_change"();
CREATE TRIGGER "fiscal_entries_no_truncate" BEFORE TRUNCATE ON "fiscal_entries"
  FOR EACH STATEMENT EXECUTE FUNCTION "fiscal_forbid_change"();

CREATE TRIGGER "fiscal_closures_append_only" BEFORE UPDATE OR DELETE ON "fiscal_closures"
  FOR EACH ROW EXECUTE FUNCTION "fiscal_forbid_change"();
CREATE TRIGGER "fiscal_closures_no_truncate" BEFORE TRUNCATE ON "fiscal_closures"
  FOR EACH STATEMENT EXECUTE FUNCTION "fiscal_forbid_change"();

CREATE TRIGGER "fiscal_archives_append_only" BEFORE UPDATE OR DELETE ON "fiscal_archives"
  FOR EACH ROW EXECUTE FUNCTION "fiscal_forbid_change"();
CREATE TRIGGER "fiscal_archives_no_truncate" BEFORE TRUNCATE ON "fiscal_archives"
  FOR EACH STATEMENT EXECUTE FUNCTION "fiscal_forbid_change"();

CREATE TRIGGER "fiscal_signing_keys_append_only" BEFORE UPDATE OR DELETE ON "fiscal_signing_keys"
  FOR EACH ROW EXECUTE FUNCTION "fiscal_forbid_change"();
CREATE TRIGGER "fiscal_signing_keys_no_truncate" BEFORE TRUNCATE ON "fiscal_signing_keys"
  FOR EACH STATEMENT EXECUTE FUNCTION "fiscal_forbid_change"();
