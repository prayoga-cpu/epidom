const fs = require('fs');
let f = 'd:/Projects/epidom/src/features/dashboard/data/products/components/edit-product-dialog.tsx';
let c = fs.readFileSync(f, 'utf8');

// Replace ProductWithRecipes definition with import
c = c.replace(
  'type ProductWithRecipes = Product & {\n  recipeProducts?: Array<RecipeProduct & { recipe: Recipe }>;\n};',
  'import type { ProductWithRelations } from "@/lib/repositories/product.repository";'
);

// Fix rp: any
c = c.replace(
  'const recipeIds = product.recipeProducts?.map((rp) => rp.recipeId) || [];',
  'const recipeIds = product.recipeProducts?.map((rp: any) => rp.recipeId) || [];'
);

fs.writeFileSync(f, c, 'utf8');
console.log('Fixed edit-product-dialog.tsx!');
