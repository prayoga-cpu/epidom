-- CreateTable
CREATE TABLE "customer_display_settings" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "themeColor" TEXT,
    "backgroundStyle" TEXT NOT NULL DEFAULT 'GRADIENT',
    "backgroundImageUrl" TEXT,
    "backgroundDim" INTEGER NOT NULL DEFAULT 45,
    "backgroundBlur" INTEGER NOT NULL DEFAULT 0,
    "panelStyle" TEXT NOT NULL DEFAULT 'GLASS',
    "fontStyle" TEXT,
    "logoUrl" TEXT,
    "logoSize" TEXT NOT NULL DEFAULT 'M',
    "orderSide" TEXT NOT NULL DEFAULT 'RIGHT',
    "welcomeTitle" TEXT,
    "welcomeMessage" TEXT,
    "thankYouTitle" TEXT,
    "thankYouMessage" TEXT,
    "thankYouSeconds" INTEGER NOT NULL DEFAULT 12,
    "showReviewQr" BOOLEAN NOT NULL DEFAULT true,
    "showWifi" BOOLEAN NOT NULL DEFAULT true,
    "showInstagramQr" BOOLEAN NOT NULL DEFAULT false,
    "qrisImageUrl" TEXT,
    "idleSlideshow" BOOLEAN NOT NULL DEFAULT true,
    "bannersDuringOrder" BOOLEAN NOT NULL DEFAULT true,
    "slideSeconds" INTEGER NOT NULL DEFAULT 8,
    "banners" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_display_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_display_settings_storeId_key" ON "customer_display_settings"("storeId");

-- AddForeignKey
ALTER TABLE "customer_display_settings" ADD CONSTRAINT "customer_display_settings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
