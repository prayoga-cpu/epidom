-- AlterTable
ALTER TABLE "businesses" ALTER COLUMN "currency" SET DEFAULT 'IDR',
ALTER COLUMN "timezone" SET DEFAULT 'Asia/Jakarta',
ALTER COLUMN "locale" SET DEFAULT 'id';

-- AlterTable
ALTER TABLE "staff_members" ADD COLUMN     "email" TEXT,
ADD COLUMN     "inviteStatus" TEXT;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "locale" SET DEFAULT 'id',
ALTER COLUMN "timezone" SET DEFAULT 'Asia/Jakarta',
ALTER COLUMN "currency" SET DEFAULT 'IDR';
