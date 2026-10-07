-- CreateEnum
CREATE TYPE "SalesPageEventType" AS ENUM ('VIEW', 'CTA_CLICK', 'SCROLL_50', 'SCROLL_90', 'SIGNUP');

-- CreateTable
CREATE TABLE "sales_page_events" (
    "id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "type" "SalesPageEventType" NOT NULL,
    "cta" TEXT,
    "visitorHash" TEXT,
    "userId" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_page_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_page_events_page_type_createdAt_idx" ON "sales_page_events"("page", "type", "createdAt");

-- CreateIndex
CREATE INDEX "sales_page_events_createdAt_idx" ON "sales_page_events"("createdAt");

-- CreateIndex
CREATE INDEX "sales_page_events_userId_idx" ON "sales_page_events"("userId");

-- AddForeignKey
ALTER TABLE "sales_page_events" ADD CONSTRAINT "sales_page_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

