-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "customPricePendingAt" TIMESTAMP(3),
ADD COLUMN     "customPricePlan" "SubscriptionPlan",
ADD COLUMN     "customPricePrevStatus" "SubscriptionStatus";
