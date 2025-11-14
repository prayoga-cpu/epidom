import { prisma } from "../src/lib/prisma";

/**
 * Verify that Material SKU constraint is correctly set up
 * This script checks if the composite unique constraint (storeId, sku) exists
 */

interface ConstraintResult {
  constraint_name: string;
  table_name: string;
  column_names: string[];
}

async function verifyMaterialSkuConstraint() {
  console.log("🔍 Verifying Material SKU constraint...\n");

  try {
    // Query to check if the composite unique constraint exists
    const constraints = await prisma.$queryRaw<ConstraintResult[]>`
      SELECT
        con.conname as constraint_name,
        rel.relname as table_name,
        ARRAY_AGG(a.attname ORDER BY conkey.ordinality) as column_names
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY conkey(attnum, ordinality)
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = conkey.attnum
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'ingredients'
        AND con.contype = 'u'
        AND con.conname = 'ingredients_storeId_sku_key'
      GROUP BY con.conname, rel.relname
      ORDER BY con.conname;
    `;

    if (constraints.length === 0) {
      console.log("❌ Constraint 'ingredients_storeId_sku_key' not found!");
      return false;
    }

    const constraint = constraints[0];
    console.log("✅ Constraint found:");
    console.log(`   Name: ${constraint.constraint_name}`);
    console.log(`   Table: ${constraint.table_name}`);
    console.log(`   Columns: ${constraint.column_names.join(", ")}`);
    console.log("");

    // Verify that old global unique constraint is removed
    const oldConstraints = await prisma.$queryRaw<ConstraintResult[]>`
      SELECT
        con.conname as constraint_name,
        rel.relname as table_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'ingredients'
        AND con.contype = 'u'
        AND con.conname = 'ingredients_sku_key';
    `;

    if (oldConstraints.length > 0) {
      console.log("⚠️  Warning: Old global unique constraint 'ingredients_sku_key' still exists!");
      return false;
    } else {
      console.log("✅ Old global unique constraint 'ingredients_sku_key' has been removed.");
    }

    console.log("");
    console.log("✅ Migration verification successful!");
    console.log("✅ Material SKU is now unique per store (storeId, sku).");
    return true;
  } catch (error) {
    console.error("❌ Error verifying constraint:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifyMaterialSkuConstraint()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });

