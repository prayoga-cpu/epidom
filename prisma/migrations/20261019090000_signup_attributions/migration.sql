-- CreateEnum
CREATE TYPE "SignupSource" AS ENUM ('REFERRAL_LINK', 'SALES_PAGE');

-- CreateTable
CREATE TABLE "signup_attributions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "SignupSource",
    "sourceAt" TIMESTAMP(3),
    "refCode" TEXT,
    "salesPage" TEXT,
    "salesPageLocale" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "adClick" TEXT,
    "fbc" TEXT,
    "landingPath" TEXT,
    "referrerHost" TEXT,
    "touchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signup_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "signup_attributions_userId_key" ON "signup_attributions"("userId");

-- CreateIndex
CREATE INDEX "signup_attributions_salesPage_createdAt_idx" ON "signup_attributions"("salesPage", "createdAt");

-- CreateIndex
CREATE INDEX "signup_attributions_source_createdAt_idx" ON "signup_attributions"("source", "createdAt");

-- CreateIndex
CREATE INDEX "signup_attributions_createdAt_idx" ON "signup_attributions"("createdAt");

-- AddForeignKey
ALTER TABLE "signup_attributions" ADD CONSTRAINT "signup_attributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

