-- CreateEnum
CREATE TYPE "CustomDevelopmentStatus" AS ENUM ('NEW', 'IN_REVIEW', 'QUOTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED');

-- CreateTable
CREATE TABLE "custom_development_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "storeId" TEXT,
    "company" TEXT,
    "phone" TEXT,
    "budget" TEXT,
    "timeline" TEXT,
    "description" TEXT NOT NULL,
    "status" "CustomDevelopmentStatus" NOT NULL DEFAULT 'NEW',
    "devNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_development_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_development_requests_status_idx" ON "custom_development_requests"("status");

-- CreateIndex
CREATE INDEX "custom_development_requests_createdAt_idx" ON "custom_development_requests"("createdAt");

-- AddForeignKey
ALTER TABLE "custom_development_requests" ADD CONSTRAINT "custom_development_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
