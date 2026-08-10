-- CreateEnum
CREATE TYPE "StorefrontEventType" AS ENUM ('VIEW', 'MENU_VIEW', 'ITEM_VIEW', 'WHATSAPP_CLICK');

-- CreateTable
CREATE TABLE "storefront_events" (
    "id" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "type" "StorefrontEventType" NOT NULL,
    "menuItemId" TEXT,
    "menuItemName" TEXT,
    "visitorHash" TEXT NOT NULL,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storefront_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "storefront_events_storefrontId_type_createdAt_idx" ON "storefront_events"("storefrontId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "storefront_events_storefrontId_visitorHash_createdAt_idx" ON "storefront_events"("storefrontId", "visitorHash", "createdAt");

-- AddForeignKey
ALTER TABLE "storefront_events" ADD CONSTRAINT "storefront_events_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "storefronts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
