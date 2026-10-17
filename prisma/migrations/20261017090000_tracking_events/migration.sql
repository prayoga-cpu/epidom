-- CreateEnum
CREATE TYPE "TrackingEventKind" AS ENUM ('PIXEL', 'CONSENT');

-- CreateTable
CREATE TABLE "tracking_events" (
    "id" TEXT NOT NULL,
    "kind" "TrackingEventKind" NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "locale" TEXT,
    "marketing" BOOLEAN,
    "analytics" BOOLEAN,
    "content" TEXT,
    "value" DECIMAL(14,2),
    "currency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracking_events_kind_createdAt_idx" ON "tracking_events"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "tracking_events_createdAt_idx" ON "tracking_events"("createdAt");
