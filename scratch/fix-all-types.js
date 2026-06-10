const fs = require('fs');

// 1. materials-section.tsx
let f1 = 'd:/Projects/epidom/src/features/dashboard/data/materials/components/materials-section.tsx';
let c1 = fs.readFileSync(f1, 'utf8');
c1 = c1.replace('initialMaterials?: SerializeDecimal<MaterialWithSuppliers>[];', 'initialMaterials?: SerializeDecimal<MaterialWithSuppliers>[];'); // should be correct already
c1 = c1.replace('useDialogState<MaterialWithSuppliers>();', 'useDialogState<SerializeDecimal<MaterialWithSuppliers>>();');
fs.writeFileSync(f1, c1, 'utf8');

// 2. material-details-dialog.tsx
let f2 = 'd:/Projects/epidom/src/features/dashboard/data/materials/components/material-details-dialog.tsx';
let c2 = fs.readFileSync(f2, 'utf8');
if (!c2.includes('import type { SerializeDecimal }')) {
  c2 = c2.replace('"use client";', '"use client";\nimport type { SerializeDecimal } from "@/types/prisma";');
}
c2 = c2.replace('material: MaterialWithSuppliers;', 'material: SerializeDecimal<MaterialWithSuppliers>;');
fs.writeFileSync(f2, c2, 'utf8');

// 3. edit-material-dialog.tsx
let f3 = 'd:/Projects/epidom/src/features/dashboard/data/materials/components/edit-material-dialog.tsx';
let c3 = fs.readFileSync(f3, 'utf8');
if (!c3.includes('import type { SerializeDecimal }')) {
  c3 = c3.replace('"use client";', '"use client";\nimport type { SerializeDecimal } from "@/types/prisma";');
}
c3 = c3.replace('material: MaterialWithSuppliers | null;', 'material: SerializeDecimal<MaterialWithSuppliers> | null;');
c3 = c3.replace('material: MaterialWithSuppliers;', 'material: SerializeDecimal<MaterialWithSuppliers>;');
fs.writeFileSync(f3, c3, 'utf8');

// 4. use-products.ts
let f4 = 'd:/Projects/epidom/src/features/dashboard/data/products/hooks/use-products.ts';
let c4 = fs.readFileSync(f4, 'utf8');
if (!c4.includes('import type { ProductWithRelations }')) {
  c4 = c4.replace('import type { Product } from "@prisma/client";', 'import type { Product } from "@prisma/client";\nimport type { ProductWithRelations } from "@/lib/repositories/product.repository";');
}
c4 = c4.replace('products: SerializeDecimal<Product>[];', 'products: SerializeDecimal<ProductWithRelations>[];');
// useUpdateProduct
c4 = c4.replace('return useMutation<\n    SerializeDecimal<Product>,', 'return useMutation<\n    SerializeDecimal<ProductWithRelations>,');
c4 = c4.replace('previousProduct: SerializeDecimal<Product> | undefined;', 'previousProduct: SerializeDecimal<ProductWithRelations> | undefined;');
c4 = c4.replace('queryClient.getQueryData<SerializeDecimal<Product>>(', 'queryClient.getQueryData<SerializeDecimal<ProductWithRelations>>(');
fs.writeFileSync(f4, c4, 'utf8');

// 5. products-section.tsx
let f5 = 'd:/Projects/epidom/src/features/dashboard/data/products/components/products-section.tsx';
let c5 = fs.readFileSync(f5, 'utf8');
if (!c5.includes('import type { ProductWithRelations }')) {
  c5 = c5.replace('import { useFeatureAccess }', 'import type { ProductWithRelations } from "@/lib/repositories/product.repository";\nimport { useFeatureAccess }');
}
c5 = c5.replace('initialProducts?: SerializeDecimal<Product>[];', 'initialProducts?: SerializeDecimal<ProductWithRelations>[];');
c5 = c5.replace('useDialogState<SerializeDecimal<Product>>();', 'useDialogState<SerializeDecimal<ProductWithRelations>>();');
c5 = c5.replace('getStockStatus = (product: SerializeDecimal<Product>)', 'getStockStatus = (product: SerializeDecimal<ProductWithRelations>)');
c5 = c5.replace('getProfitMargin = (product: SerializeDecimal<Product>)', 'getProfitMargin = (product: SerializeDecimal<ProductWithRelations>)');
fs.writeFileSync(f5, c5, 'utf8');

// 6. product-details-dialog.tsx
let f6 = 'd:/Projects/epidom/src/features/dashboard/data/products/components/product-details-dialog.tsx';
let c6 = fs.readFileSync(f6, 'utf8');
c6 = c6.replace('product: ProductWithRelations;', 'product: SerializeDecimal<ProductWithRelations>;');
c6 = c6.replace('product: ProductWithRelations | null;', 'product: SerializeDecimal<ProductWithRelations> | null;');
fs.writeFileSync(f6, c6, 'utf8');

// 7. edit-product-dialog.tsx
let f7 = 'd:/Projects/epidom/src/features/dashboard/data/products/components/edit-product-dialog.tsx';
let c7 = fs.readFileSync(f7, 'utf8');
if (!c7.includes('import type { ProductWithRelations }')) {
  c7 = c7.replace('import type { Product, Recipe, RecipeProduct } from "@prisma/client";', 'import type { Product, Recipe, RecipeProduct } from "@prisma/client";\nimport type { ProductWithRelations } from "@/lib/repositories/product.repository";');
}
c7 = c7.replace('product: ProductWithRecipes;', 'product: SerializeDecimal<ProductWithRelations>;');
c7 = c7.replace('product: ProductWithRecipes | null;', 'product: SerializeDecimal<ProductWithRelations> | null;');
c7 = c7.replace('product: Product | null;', 'product: SerializeDecimal<ProductWithRelations> | null;');
c7 = c7.replace('queryClient.getQueryData<SerializeDecimal<Product>>(', 'queryClient.getQueryData<SerializeDecimal<ProductWithRelations>>(');
c7 = c7.replace('previousProduct: queryClient.getQueryData<SerializeDecimal<ProductWithRelations>>(', 'previousProduct: queryClient.getQueryData<SerializeDecimal<ProductWithRelations>>(');
fs.writeFileSync(f7, c7, 'utf8');

console.log('Fixed all mismatched types!');
