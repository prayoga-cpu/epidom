-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "ReferralLanding" AS ENUM ('REGISTER', 'HOME');

-- CreateEnum
CREATE TYPE "PartnerCommissionKind" AS ENUM ('INVOICE', 'REFUND_ADJUSTMENT', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PartnerCommissionStatus" AS ENUM ('PENDING', 'PAID', 'VOID');

-- AlterEnum
ALTER TYPE "AuditGrantSource" ADD VALUE 'SECTION_GRANT';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "adminSections" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "signup_attributions" ADD COLUMN     "commissionMonths" INTEGER,
ADD COLUMN     "commissionRate" DECIMAL(5,2),
ADD COLUMN     "commissionWindowEnd" TIMESTAMP(3),
ADD COLUMN     "commissionWindowStart" TIMESTAMP(3),
ADD COLUMN     "discountPercent" DECIMAL(5,2),
ADD COLUMN     "discountRedeemedAt" TIMESTAMP(3),
ADD COLUMN     "firstPaidAt" TIMESTAMP(3),
ADD COLUMN     "firstPaidCurrency" TEXT,
ADD COLUMN     "firstPaidInterval" "BillingInterval",
ADD COLUMN     "firstPaidPlan" "SubscriptionPlan",
ADD COLUMN     "partnerId" TEXT,
ADD COLUMN     "selfReferralFlag" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "status" "PartnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "referralCode" TEXT,
    "referralLanding" "ReferralLanding" NOT NULL DEFAULT 'REGISTER',
    "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "commissionMonths" INTEGER NOT NULL DEFAULT 3,
    "customerDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_viewers" (
    "partnerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_viewers_pkey" PRIMARY KEY ("partnerId","userId")
);

-- CreateTable
CREATE TABLE "partner_sales_pages" (
    "page" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creditFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_sales_pages_pkey" PRIMARY KEY ("page")
);

-- CreateTable
CREATE TABLE "partner_commissions" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "attributionId" TEXT,
    "customerUserId" TEXT,
    "kind" "PartnerCommissionKind" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeRefundId" TEXT,
    "plan" "SubscriptionPlan",
    "billingInterval" "BillingInterval",
    "currency" TEXT NOT NULL,
    "invoiceAmount" DECIMAL(14,2) NOT NULL,
    "commissionableAmount" DECIMAL(14,2) NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "PartnerCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "earnedAt" TIMESTAMP(3) NOT NULL,
    "payableAt" TIMESTAMP(3) NOT NULL,
    "payoutId" TEXT,
    "reversesId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_payouts" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partners_userId_key" ON "partners"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "partners_referralCode_key" ON "partners"("referralCode");

-- CreateIndex
CREATE INDEX "partners_status_idx" ON "partners"("status");

-- CreateIndex
CREATE INDEX "partner_viewers_userId_idx" ON "partner_viewers"("userId");

-- CreateIndex
CREATE INDEX "partner_sales_pages_partnerId_idx" ON "partner_sales_pages"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_commissions_sourceKey_key" ON "partner_commissions"("sourceKey");

-- CreateIndex
CREATE INDEX "partner_commissions_partnerId_status_payableAt_idx" ON "partner_commissions"("partnerId", "status", "payableAt");

-- CreateIndex
CREATE INDEX "partner_commissions_stripePaymentIntentId_idx" ON "partner_commissions"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "partner_commissions_customerUserId_idx" ON "partner_commissions"("customerUserId");

-- CreateIndex
CREATE INDEX "partner_payouts_partnerId_paidAt_idx" ON "partner_payouts"("partnerId", "paidAt");

-- CreateIndex
CREATE INDEX "signup_attributions_partnerId_createdAt_idx" ON "signup_attributions"("partnerId", "createdAt");

-- AddForeignKey
ALTER TABLE "signup_attributions" ADD CONSTRAINT "signup_attributions_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_viewers" ADD CONSTRAINT "partner_viewers_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_viewers" ADD CONSTRAINT "partner_viewers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_sales_pages" ADD CONSTRAINT "partner_sales_pages_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "signup_attributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "partner_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

