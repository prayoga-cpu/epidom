-- AlterTable
ALTER TABLE "user" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "purgeAt" TIMESTAMP(3);
