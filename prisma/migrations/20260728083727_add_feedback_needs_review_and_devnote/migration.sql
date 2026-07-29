-- AlterEnum
ALTER TYPE "FeedbackStatus" ADD VALUE 'NEEDS_REVIEW';

-- AlterTable
ALTER TABLE "feedback" ADD COLUMN     "devNote" TEXT;
