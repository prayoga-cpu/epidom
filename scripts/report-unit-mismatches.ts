/**
 * Read-only report: recipe ingredients whose unit is INCOMPATIBLE with the unit
 * its material is stocked in.
 *
 * `convertUnit` (src/lib/utils/unit-conversion.ts) converts within mass and
 * within volume, and for anything else RETURNS ITS INPUT UNCHANGED — which is
 * correct for "piece"/"unit", but silently wrong across dimensions. A recipe
 * calling for "500 g" of a material stocked in "L" deducts 500 litres.
 * `areUnitsCompatible` exists to catch exactly this and is currently called
 * from nowhere in `src/`.
 *
 * This became urgent with the two-tier stock model: made-to-order sales draw
 * raw materials on every single order, so a mismatch that used to be dormant
 * now drains a real balance all day.
 *
 * DELIBERATELY A REPORT, NOT A FIX. Guessing what a merchant meant is worse
 * than the bug — a hard block on new links, and conversion inside
 * completeProduction, should only ship once this report comes back clean.
 *
 * Strictly read-only. `--dry-run` is accepted and ignored, to match the other
 * scripts in this directory.
 *
 * Usage: pnpm tsx --env-file=.env scripts/report-unit-mismatches.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl } from "../src/lib/db/connection-string";
import { isMassUnit, isVolumeUnit } from "../src/lib/utils/unit-conversion";

const adapter = new PrismaPg({ connectionString: databaseUrl() });
const prisma = new PrismaClient({ adapter });

type Dimension = "mass" | "volume" | "count";

function dimensionOf(unit: string): Dimension {
  if (isMassUnit(unit)) return "mass";
  if (isVolumeUnit(unit)) return "volume";
  return "count";
}

/**
 * Whether a unit pair converts CORRECTLY, which is a weaker test than
 * `areUnitsCompatible`.
 *
 * `areUnitsCompatible` returns false for "units" vs "piece" — but both are
 * dimensionless counts, `convertUnit` passes the quantity through unchanged,
 * and that is the RIGHT answer. Reporting those would bury the real defects
 * under dozens of false alarms (this report found 41 of them on live-shaped
 * data, every one a count synonym), and a report that cries wolf never comes
 * back clean, so the hard block it gates would never ship.
 *
 * A genuine mismatch is a CROSS-DIMENSION one: mass↔volume, or either of those
 * against a count. Those silently subtract a number measured in one dimension
 * from a balance kept in another.
 */
function convertsSafely(from: string, to: string): boolean {
  return dimensionOf(from) === dimensionOf(to);
}

async function main() {
  console.log("Unit mismatch report");
  console.log("====================");

  // 1. Recipe ingredient unit vs the material's stock unit.
  const ingredients = await prisma.recipeIngredient.findMany({
    select: {
      unit: true,
      quantity: true,
      recipe: { select: { name: true, storeId: true } },
      material: { select: { name: true, unit: true } },
    },
  });

  const mismatched = ingredients.filter((ing) => !convertsSafely(ing.unit, ing.material.unit));

  console.log(`\nScanned ${ingredients.length} recipe ingredients.`);
  if (mismatched.length === 0) {
    console.log("OK — every ingredient unit is compatible with its material's stock unit.");
  } else {
    console.log(
      `FLAG — ${mismatched.length} ingredient(s) convert as a silent no-op ` +
        `(the recipe quantity is subtracted from a different dimension):\n`
    );
    for (const ing of mismatched) {
      console.log(
        `  store ${ing.recipe.storeId}\n` +
          `    ${ing.recipe.name} → ${ing.material.name}\n` +
          `    recipe says ${String(ing.quantity)} ${ing.unit}, material stocked in ${ing.material.unit}`
      );
    }
  }

  // 2. Recipe yield unit vs the linked product's unit. completeProduction adds
  //    `actualQuantity` to Product.currentStock with NO conversion at all, so a
  //    recipe yielding "5 L" credits 5 "piece" to a product sold by the piece.
  const products = await prisma.product.findMany({
    where: { primaryRecipeId: { not: null } },
    select: {
      name: true,
      unit: true,
      storeId: true,
      primaryRecipe: { select: { name: true, yieldUnit: true } },
    },
  });

  const yieldMismatched = products.filter(
    (p) => p.primaryRecipe && !convertsSafely(p.primaryRecipe.yieldUnit, p.unit)
  );

  console.log(`\nScanned ${products.length} products with a primary recipe.`);
  if (yieldMismatched.length === 0) {
    console.log("OK — every primary recipe's yield unit is compatible with its product's unit.");
  } else {
    console.log(
      `FLAG — ${yieldMismatched.length} product(s) credit finished goods in a different unit ` +
        `than they are sold in:\n`
    );
    for (const p of yieldMismatched) {
      console.log(
        `  store ${p.storeId}\n` +
          `    ${p.name} (sold in ${p.unit}) ← ${p.primaryRecipe!.name} ` +
          `(yields ${p.primaryRecipe!.yieldUnit})`
      );
    }
  }

  const total = mismatched.length + yieldMismatched.length;
  console.log(
    `\n${total === 0 ? "PASS — no unit mismatches." : `FAIL — ${total} mismatch(es) to resolve with the merchant.`}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
