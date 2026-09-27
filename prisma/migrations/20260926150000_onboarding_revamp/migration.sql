-- Onboarding revamp (3.3.0): setup-wizard progress, the owner's goals and
-- business type on Business; the in-app guide's per-user state on User.
-- Additive only: nullable columns or a default, so every existing row and
-- every running client keeps working.

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN "onboardingStep" INTEGER;
ALTER TABLE "businesses" ADD COLUMN "onboardingGoals" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "businesses" ADD COLUMN "businessType" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN "guideState" JSONB;
