const fs = require('fs');

const files = [
  'd:/Projects/epidom/src/features/dashboard/data/materials/hooks/use-materials.ts',
  'd:/Projects/epidom/src/features/dashboard/data/suppliers/hooks/use-suppliers.ts',
  'd:/Projects/epidom/src/features/dashboard/data/products/hooks/use-products.ts',
  'd:/Projects/epidom/src/features/dashboard/production/hooks/use-production-batches.ts',
  'd:/Projects/epidom/src/features/dashboard/tracking/hooks/use-tracking.ts', // If exists
];

for (const path of files) {
  if (!fs.existsSync(path)) continue;
  let content = fs.readFileSync(path, 'utf8');
  let changed = false;

  // Add import if missing
  if (!content.includes('SerializeDecimal')) {
    content = content.replace(
      'import {',
      'import type { SerializeDecimal } from "@/types/prisma";\nimport {'
    );
    changed = true;
  }

  // Material
  if (content.includes('materials: MaterialWithSuppliers[];')) {
    content = content.replace('materials: MaterialWithSuppliers[];', 'materials: SerializeDecimal<MaterialWithSuppliers>[];');
    changed = true;
  }

  // Supplier
  if (content.includes('suppliers: SupplierWithRelations[];')) {
    content = content.replace('suppliers: SupplierWithRelations[];', 'suppliers: SerializeDecimal<SupplierWithRelations>[];');
    changed = true;
  }

  // Product
  if (content.includes('products: ProductWithRelations[];')) {
    content = content.replace('products: ProductWithRelations[];', 'products: SerializeDecimal<ProductWithRelations>[];');
    changed = true;
  }
  
  if (content.includes('products: Product[];') && path.includes('use-products')) {
    // If it's the alias Product type in use-products.ts, we need to check how it's defined
  }

  // ProductionBatch
  if (content.includes('batches: ProductionBatchWithRelations[];')) {
    content = content.replace('batches: ProductionBatchWithRelations[];', 'batches: SerializeDecimal<ProductionBatchWithRelations>[];');
    changed = true;
  }

  if (changed) fs.writeFileSync(path, content, 'utf8');
}

console.log('Hooks fixed');
