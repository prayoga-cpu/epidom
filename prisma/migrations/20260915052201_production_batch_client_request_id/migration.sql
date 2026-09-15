-- AlterTable
ALTER TABLE "production_batches" ADD COLUMN     "clientRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "production_batches_clientRequestId_key" ON "production_batches"("clientRequestId");
