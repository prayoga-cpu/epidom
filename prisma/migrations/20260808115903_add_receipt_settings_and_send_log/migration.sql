-- CreateEnum
CREATE TYPE "OrderReceiptSendStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "store_receipt_settings" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "footerMessage" TEXT,
    "facebookUrl" TEXT,
    "showSocialLinks" BOOLEAN NOT NULL DEFAULT true,
    "autoSendWhatsappReceipt" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_receipt_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_receipt_sends" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "recipientPhone" TEXT NOT NULL,
    "status" "OrderReceiptSendStatus" NOT NULL,
    "fonnteMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_receipt_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_receipt_settings_storeId_key" ON "store_receipt_settings"("storeId");

-- CreateIndex
CREATE INDEX "order_receipt_sends_orderId_idx" ON "order_receipt_sends"("orderId");

-- AddForeignKey
ALTER TABLE "store_receipt_settings" ADD CONSTRAINT "store_receipt_settings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_receipt_sends" ADD CONSTRAINT "order_receipt_sends_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
