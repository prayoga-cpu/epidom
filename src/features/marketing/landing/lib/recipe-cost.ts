/**
 * The recipe cost calculator (coût de revient / HPP / food cost): what one
 * portion of a dish costs in ingredients, and the price that keeps ingredient
 * cost at a target share of it. Runs in the browser and stores nothing.
 *
 *   ingredient_cost  = pack_price / pack_size × quantity_used   (same unit)
 *   batch_cost       = Σ ingredient_cost
 *   cost_per_portion = batch_cost / portions + extra_per_portion   (packaging…)
 *   suggested_price  = cost_per_portion / target_food_cost
 *   food_cost_share  = cost_per_portion / selling_price
 *   gross_margin     = selling_price − cost_per_portion
 *
 * Prices are whatever the visitor types (with or without tax): the result is
 * in the same terms, and the page says so.
 */

export interface RecipeIngredient {
  name: string;
  /** What the pack costs. */
  packPrice: number;
  /** How much is in the pack (g, ml, pieces…). */
  packSize: number;
  /** How much of it the recipe uses, in the same unit as packSize. */
  quantityUsed: number;
}

export interface RecipeInputs {
  ingredients: RecipeIngredient[];
  /** Portions the recipe makes. */
  portions: number;
  /** Packaging or other per-portion cost (box, cup…). */
  extraPerPortion: number;
  /** Target ingredient share of the price, 0..1 (e.g. 0.3). */
  targetFoodCost: number;
  /** The price the dish sells at, if the visitor gave one. */
  sellingPrice?: number;
}

export interface RecipeResult {
  /** Cost of each ingredient line, in input order (0 when a line is incomplete). */
  ingredientCosts: number[];
  batchCost: number;
  costPerPortion: number;
  /** Null when the target share is not between 0 and 1. */
  suggestedPrice: number | null;
  /** Only when a selling price above 0 was given. */
  foodCostShare: number | null;
  grossMarginPerPortion: number | null;
  grossMarginShare: number | null;
}

const positive = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function ingredientCost({ packPrice, packSize, quantityUsed }: RecipeIngredient): number {
  const size = positive(packSize);
  if (size === 0) return 0;
  return (positive(packPrice) / size) * positive(quantityUsed);
}

export function computeRecipeCost(inputs: RecipeInputs): RecipeResult {
  const ingredientCosts = inputs.ingredients.map(ingredientCost);
  const batchCost = ingredientCosts.reduce((sum, c) => sum + c, 0);
  const portions = Math.max(1, Math.floor(positive(inputs.portions)) || 1);
  const costPerPortion = batchCost / portions + positive(inputs.extraPerPortion);

  const target = inputs.targetFoodCost;
  const suggestedPrice =
    Number.isFinite(target) && target > 0 && target < 1 ? costPerPortion / target : null;

  const price = positive(inputs.sellingPrice ?? 0);
  const hasPrice = price > 0;
  return {
    ingredientCosts,
    batchCost,
    costPerPortion,
    suggestedPrice,
    foodCostShare: hasPrice ? costPerPortion / price : null,
    grossMarginPerPortion: hasPrice ? price - costPerPortion : null,
    grossMarginShare: hasPrice ? (price - costPerPortion) / price : null,
  };
}
