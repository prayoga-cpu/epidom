/**
 * Read-only report: recipe ingredients whose PER-UNIT requirement rounds away to
 * 0.000 at `Decimal(10,3)`, and therefore silently deduct nothing on sale.
 *
 * Example: a recipe calling for 0.4 g of saffron, against a material stocked in
 * kilograms, needs 0.0004 kg per unit — which stores as 0.000. Before the
 * rounding discipline in src/lib/services/stock-precision.ts this wrote a
 * zero-quantity movement that looked like a successful deduction; now it is
 * skipped and logged, which makes it loud but still does not make it WORK.
 *
 * The fix is a merchant data change — stock that material in grams rather than
 * kilograms — not a code change. Silently guessing a merchant's units would be
 * worse than the bug, so this report exists to hand them the exact list.
 *
 * Strictly read-only. `--dry-run` is accepted and ignored, to match the other
 * scripts in this directory.
 *
 * Usage: pnpm tsx --env-file=.env scripts/report-below-precision-ingredients.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl } from "../src/lib/db/connection-string";
import { convertUnit } from "../src/lib/utils/unit-conversion";
import { roundsAwayToZero } from "../src/lib/services/stock-precision";

const adapter = new PrismaPg({ connectionString: databaseUrl() });
const prisma = new PrismaClient({ adapter });

async function main() {
  const recipes = await prisma.recipe.findMany({
    select: {
      id: true,
      name: true,
      storeId: true,
      yieldQuantity: true,
      ingredients: {
        select: {
          quantity: true,
          unit: true,
          material: { select: { id: true, name: true, unit: true } },
        },
      },
    },
  });

  const flagged: {
    store: string;
    recipe: string;
    material: string;
    perUnit: number;
    recipeUnit: string;
    materialUnit: string;
  }[] = [];

  for (const recipe of recipes) {
    const yieldQty = Number(recipe.yieldQuantity);
    if (yieldQty <= 0) continue;

    for (const ing of recipe.ingredients) {
      // Exactly the arithmetic the sale path performs for one finished unit.
      const perUnitInRecipeUnit = Number(ing.quantity) / yieldQty;
      const perUnit = convertUnit(perUnitInRecipeUnit, ing.unit, ing.material.unit);

      if (roundsAwayToZero(perUnit)) {
        flagged.push({
          store: recipe.storeId,
          recipe: recipe.name,
          material: ing.material.name,
          perUnit,
          recipeUnit: ing.unit,
          materialUnit: ing.material.unit,
        });
      }
    }
  }

  console.log("Below-precision ingredient report");
  console.log("=================================");
  console.log(`Scanned ${recipes.length} recipes.\n`);

  if (flagged.length === 0) {
    console.log("OK — every ingredient's per-unit requirement survives Decimal(10,3).");
    return;
  }

  console.log(
    `FLAG — ${flagged.length} ingredient(s) deduct NOTHING per unit sold.\n` +
      `Fix by re-stocking the material in a smaller unit (e.g. g instead of kg).\n`
  );
  for (const f of flagged) {
    console.log(
      `  store ${f.store}\n` +
        `    ${f.recipe} → ${f.material}\n` +
        `    needs ${f.perUnit} ${f.materialUnit} per unit ` +
        `(recipe states ${f.recipeUnit}, material stocked in ${f.materialUnit}) → rounds to 0.000`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
