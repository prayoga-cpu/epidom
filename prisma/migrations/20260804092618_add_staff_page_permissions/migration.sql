-- AlterTable
ALTER TABLE "staff_members" ADD COLUMN     "allowedPages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "customRoleLabel" TEXT;
