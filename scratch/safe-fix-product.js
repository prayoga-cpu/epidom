const fs = require('fs');

function addImport(content) {
  if (!content.includes('import type { SerializeDecimal } from "@/types/prisma";')) {
    if (content.includes('import type { Product }')) {
      return content.replace('import type { Product }', 'import type { SerializeDecimal } from "@/types/prisma";\nimport type { Product }');
    }
    if (content.includes('import { Product }')) {
      return content.replace('import { Product }', 'import type { SerializeDecimal } from "@/types/prisma";\nimport { Product }');
    }
  }
  return content;
}

// 1. products-section.tsx
let f1 = 'd:/Projects/epidom/src/features/dashboard/data/products/components/products-section.tsx';
let c1 = fs.readFileSync(f1, 'utf8');
c1 = addImport(c1);
c1 = c1.replace('initialProducts?: Product[];', 'initialProducts?: SerializeDecimal<Product>[];');
c1 = c1.replace('useDialogState<Product>();', 'useDialogState<SerializeDecimal<Product>>();');
c1 = c1.replace('getStockStatus = (product: Product)', 'getStockStatus = (product: SerializeDecimal<Product>)');
c1 = c1.replace('getProfitMargin = (product: Product)', 'getProfitMargin = (product: SerializeDecimal<Product>)');
fs.writeFileSync(f1, c1, 'utf8');

// 2. product-details-dialog.tsx
let f2 = 'd:/Projects/epidom/src/features/dashboard/data/products/components/product-details-dialog.tsx';
let c2 = fs.readFileSync(f2, 'utf8');
c2 = addImport(c2);
c2 = c2.replace('product: Product | null;', 'product: SerializeDecimal<Product> | null;');
fs.writeFileSync(f2, c2, 'utf8');

// 3. edit-product-dialog.tsx
let f3 = 'd:/Projects/epidom/src/features/dashboard/data/products/components/edit-product-dialog.tsx';
let c3 = fs.readFileSync(f3, 'utf8');
c3 = addImport(c3);
c3 = c3.replace('product: Product | null;', 'product: SerializeDecimal<Product> | null;');
c3 = c3.replace('previousProduct: queryClient.getQueryData<Product>(', 'previousProduct: queryClient.getQueryData<SerializeDecimal<Product>>(');
fs.writeFileSync(f3, c3, 'utf8');

console.log('Fixed product UI safely!');
