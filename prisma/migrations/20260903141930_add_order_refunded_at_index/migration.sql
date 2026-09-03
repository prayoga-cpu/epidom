-- CreateIndex
CREATE INDEX "orders_storeId_refundedAt_idx" ON "orders"("storeId", "refundedAt");
