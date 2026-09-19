-- AlterEnum
ALTER TYPE "StorefrontEventType" ADD VALUE 'REVIEW_CLICK';

-- AlterTable
ALTER TABLE "storefronts" ADD COLUMN     "googlePlaceId" TEXT,
ADD COLUMN     "googleReviewEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "googleReviewUrl" TEXT;
