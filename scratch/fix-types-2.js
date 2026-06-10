const fs = require('fs');

// 1. use-materials.ts
let f1 = 'd:/Projects/epidom/src/features/dashboard/data/materials/hooks/use-materials.ts';
let c1 = fs.readFileSync(f1, 'utf8');
c1 = c1.replace(
  'export interface MaterialsResponse {\n  materials: MaterialWithSuppliers[];',
  'export interface MaterialsResponse {\n  materials: SerializeDecimal<MaterialWithSuppliers>[];'
);
fs.writeFileSync(f1, c1, 'utf8');

// 2. edit-product-dialog.tsx
let f2 = 'd:/Projects/epidom/src/features/dashboard/data/products/components/edit-product-dialog.tsx';
let c2 = fs.readFileSync(f2, 'utf8');
c2 = c2.replace(
  'const recipeIds = product.recipeProducts?.map((rp) => rp.recipeId) || [];',
  'const recipeIds = product.recipeProducts?.map((rp: any) => rp.recipeId) || [];'
);
fs.writeFileSync(f2, c2, 'utf8');

console.log('Fixed MaterialsResponse and rp any type!');
