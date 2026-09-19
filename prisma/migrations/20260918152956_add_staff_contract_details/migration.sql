-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('FREELANCE', 'PART_TIME', 'FULL_TIME', 'CONTRACT');

-- AlterEnum
ALTER TYPE "PayType" ADD VALUE 'SALES';

-- AlterTable
ALTER TABLE "staff_members" ADD COLUMN     "contractType" "ContractType";

