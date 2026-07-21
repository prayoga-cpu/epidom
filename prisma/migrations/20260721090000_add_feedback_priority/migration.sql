-- CreateEnum
CREATE TYPE "FeedbackPriority" AS ENUM ('URGENT', 'HIGH', 'MEDIUM', 'LOW');

-- AlterTable
ALTER TABLE "feedback" ADD COLUMN "priority" "FeedbackPriority" NOT NULL DEFAULT 'MEDIUM';

-- CreateIndex
CREATE INDEX "feedback_priority_idx" ON "feedback"("priority");
