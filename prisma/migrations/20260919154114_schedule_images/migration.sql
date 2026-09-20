-- CreateTable
CREATE TABLE "schedule_images" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_images_storeId_endDate_idx" ON "schedule_images"("storeId", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_images_storeId_startDate_endDate_key" ON "schedule_images"("storeId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "schedule_images" ADD CONSTRAINT "schedule_images_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
