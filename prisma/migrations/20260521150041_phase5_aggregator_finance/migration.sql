-- CreateEnum
CREATE TYPE "AggregatorPlatform" AS ENUM ('GOFOOD', 'GRABFOOD', 'SHOPEEFOOD', 'TOKOPEDIA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderSource" ADD VALUE 'GOFOOD';
ALTER TYPE "OrderSource" ADD VALUE 'GRABFOOD';
ALTER TYPE "OrderSource" ADD VALUE 'SHOPEEFOOD';
ALTER TYPE "OrderSource" ADD VALUE 'TOKOPEDIA';

-- CreateTable
CREATE TABLE "aggregator_connections" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "platform" "AggregatorPlatform" NOT NULL,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aggregator_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aggregator_emails" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "platform" "AggregatorPlatform",
    "fromAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "parsedOrderId" TEXT,
    "parseStatus" TEXT NOT NULL DEFAULT 'pending',
    "parseError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aggregator_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aggregator_connections_storeId_idx" ON "aggregator_connections"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "aggregator_connections_storeId_platform_key" ON "aggregator_connections"("storeId", "platform");

-- CreateIndex
CREATE INDEX "aggregator_emails_storeId_idx" ON "aggregator_emails"("storeId");

-- CreateIndex
CREATE INDEX "aggregator_emails_parseStatus_idx" ON "aggregator_emails"("parseStatus");

-- AddForeignKey
ALTER TABLE "aggregator_connections" ADD CONSTRAINT "aggregator_connections_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aggregator_emails" ADD CONSTRAINT "aggregator_emails_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
