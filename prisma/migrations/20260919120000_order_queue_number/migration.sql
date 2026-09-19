-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "queueNumber" INTEGER;

-- CreateTable
CREATE TABLE "order_queue_counters" (
    "storeId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_queue_counters_pkey" PRIMARY KEY ("storeId","day")
);

-- AddForeignKey
ALTER TABLE "order_queue_counters" ADD CONSTRAINT "order_queue_counters_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
