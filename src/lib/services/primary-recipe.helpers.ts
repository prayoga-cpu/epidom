import type { Prisma } from "@prisma/client";

/**
 * Prisma include fragment for "the one recipe that defines a unit of this
 * product".
 *
 * Replaces the hand-rolled `recipeProducts: { where: { isDefault: true } }`
 * includes that stock-deduction.service.ts and production-batch.service.ts each
 * carried their own copy of. Those matched *nothing* for any link the dashboard
 * created, because the only writer of that table
 * (productRepository.updateRecipes) has always written `isDefault: false` —
 * which silently disabled sale-time ingredient deduction and ORDER_SHORTFALL
 * drafting across the whole app.
 *
 * Kept in one place so the invariant can never drift apart again.
 */
export const primaryRecipeInclude = {
  primaryRecipe: {
    include: { ingredients: { include: { material: true } } },
  },
} satisfies Prisma.ProductInclude;

export type ProductWithPrimaryRecipe = Prisma.ProductGetPayload<{
  include: typeof primaryRecipeInclude;
}>;

export type PrimaryRecipe = NonNullable<ProductWithPrimaryRecipe["primaryRecipe"]>;
