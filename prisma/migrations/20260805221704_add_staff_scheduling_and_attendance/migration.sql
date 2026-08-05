-- CreateEnum
CREATE TYPE "ProductionTriggerType" AS ENUM ('MANUAL', 'ORDER_SHORTFALL');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AttendanceType" AS ENUM ('CLOCK_IN', 'CLOCK_OUT', 'ABSENCE');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "productionBatchId" TEXT;

-- AlterTable
ALTER TABLE "production_batches" ADD COLUMN     "triggerType" "ProductionTriggerType" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "standardWorkMinutesPerDay" INTEGER NOT NULL DEFAULT 480;

-- CreateTable
CREATE TABLE "schedule_shifts" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_schedules" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "scheduleShiftId" TEXT,
    "customStartTime" TEXT,
    "customEndTime" TEXT,
    "department" "Department",
    "notes" TEXT,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "staffScheduleId" TEXT,
    "type" "AttendanceType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selfieUrl" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "locationLabel" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_shifts_storeId_idx" ON "schedule_shifts"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_shifts_storeId_name_key" ON "schedule_shifts"("storeId", "name");

-- CreateIndex
CREATE INDEX "staff_schedules_storeId_date_idx" ON "staff_schedules"("storeId", "date");

-- CreateIndex
CREATE INDEX "staff_schedules_staffMemberId_idx" ON "staff_schedules"("staffMemberId");

-- CreateIndex
CREATE INDEX "staff_schedules_scheduleShiftId_idx" ON "staff_schedules"("scheduleShiftId");

-- CreateIndex
CREATE INDEX "attendance_records_storeId_idx" ON "attendance_records"("storeId");

-- CreateIndex
CREATE INDEX "attendance_records_staffMemberId_timestamp_idx" ON "attendance_records"("staffMemberId", "timestamp");

-- CreateIndex
CREATE INDEX "attendance_records_staffScheduleId_idx" ON "attendance_records"("staffScheduleId");

-- CreateIndex
CREATE INDEX "order_items_productionBatchId_idx" ON "order_items"("productionBatchId");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productionBatchId_fkey" FOREIGN KEY ("productionBatchId") REFERENCES "production_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_shifts" ADD CONSTRAINT "schedule_shifts_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_schedules" ADD CONSTRAINT "staff_schedules_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_schedules" ADD CONSTRAINT "staff_schedules_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_schedules" ADD CONSTRAINT "staff_schedules_scheduleShiftId_fkey" FOREIGN KEY ("scheduleShiftId") REFERENCES "schedule_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "staff_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_staffScheduleId_fkey" FOREIGN KEY ("staffScheduleId") REFERENCES "staff_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
