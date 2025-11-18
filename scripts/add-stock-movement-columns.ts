/**
 * Script to add reason and referenceId columns to stock_movements table
 * Run with: npx tsx scripts/add-stock-movement-columns.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Adding reason and referenceId columns to stock_movements table...");

  try {
    // Add reason column
    await prisma.$executeRaw`
      ALTER TABLE "stock_movements"
      ADD COLUMN IF NOT EXISTS "reason" TEXT;
    `;
    console.log("✅ Added 'reason' column");

    // Add referenceId column
    await prisma.$executeRaw`
      ALTER TABLE "stock_movements"
      ADD COLUMN IF NOT EXISTS "referenceId" TEXT;
    `;
    console.log("✅ Added 'referenceId' column");

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Error running migration:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

