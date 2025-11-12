import { prisma } from "../src/lib/prisma";

/**
 * Check for duplicate SKU materials within the same store
 * This script will find any materials that have the same SKU and storeId
 * If duplicates are found, migration will fail
 */

interface DuplicateResult {
  storeId: string;
  sku: string;
  duplicate_count: number;
  material_ids: string;
  material_names: string;
}

async function checkMaterialSkuDuplicates() {
  console.log("🔍 Checking for duplicate SKU materials within the same store...\n");

  try {
    // Query to find duplicate SKU materials within the same store
    const duplicates = await prisma.$queryRaw<DuplicateResult[]>`
      SELECT
          "storeId",
          sku,
          COUNT(*)::int as duplicate_count,
          STRING_AGG(id::text, ', ') as material_ids,
          STRING_AGG(name, ', ') as material_names
      FROM "ingredients"
      GROUP BY "storeId", sku
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC, "storeId", sku;
    `;

    if (duplicates.length === 0) {
      console.log("✅ No duplicate SKU materials found!");
      console.log("✅ Migration is safe to run.\n");
      return true;
    } else {
      console.log(`❌ Found ${duplicates.length} duplicate SKU material(s):\n`);

      duplicates.forEach((dup, index) => {
        console.log(`${index + 1}. Store ID: ${dup.storeId}`);
        console.log(`   SKU: ${dup.sku}`);
        console.log(`   Duplicate Count: ${dup.duplicate_count}`);
        console.log(`   Material IDs: ${dup.material_ids}`);
        console.log(`   Material Names: ${dup.material_names}`);
        console.log("");
      });

      console.log("❌ Migration will fail due to duplicate SKU materials.");
      console.log("❌ Please resolve duplicates before running migration.\n");
      return false;
    }
  } catch (error) {
    console.error("❌ Error checking for duplicates:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkMaterialSkuDuplicates()
  .then((isSafe) => {
    process.exit(isSafe ? 0 : 1);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });

