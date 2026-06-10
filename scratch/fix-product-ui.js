const fs = require('fs');
const path = require('path');

const dir = 'd:/Projects/epidom/src/features/dashboard/data/products/components';
const files = [
  'products-section.tsx',
  'product-details-dialog.tsx',
  'edit-product-dialog.tsx',
  'add-product-dialog.tsx'
];

for (const file of files) {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if we already added it
  if (!content.includes('import type { SerializeDecimal } from "@/types/prisma";')) {
    if (content.includes('import type { Product }')) {
      content = content.replace(
        'import type { Product }',
        'import type { SerializeDecimal } from "@/types/prisma";\nimport type { Product }'
      );
    } else if (content.includes('import { Product }')) {
      content = content.replace(
        'import { Product }',
        'import type { SerializeDecimal } from "@/types/prisma";\nimport { Product }'
      );
    }
  }
  
  const importRegex1 = /import type \{ Product \} from "[^"]+";/g;
  const importRegex2 = /import \{ Product \} from "[^"]+";/g;
  
  let imports = [];
  content = content.replace(importRegex1, (m) => { imports.push(m); return `__IMPORT_1__`; });
  content = content.replace(importRegex2, (m) => { imports.push(m); return `__IMPORT_2__`; });
  
  // Also we want to preserve things like ProductResponse, ProductFilter, etc. 
  // We only replace exactly "Product" word boundary. 
  // But wait, there might be variables named `Product`! No, variable is `product`.
  content = content.replace(/\bProduct\b(?!Response|WithRelations|Input|Filter|FormValues|Skeleton|Grid|Dialog|Card|Item)/g, 'SerializeDecimal<Product>');
  
  // It might produce `SerializeDecimal<SerializeDecimal<Product>>` if it was already fixed
  content = content.replace(/SerializeDecimal<SerializeDecimal<Product>>/g, 'SerializeDecimal<Product>');
  
  content = content.replace('__IMPORT_1__', imports[0] || '');
  content = content.replace('__IMPORT_2__', imports[1] || imports[0] || '');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed ${file}`);
}

// Now fix use-products.ts useMutation<Product,
const hookPath = 'd:/Projects/epidom/src/features/dashboard/data/products/hooks/use-products.ts';
if (fs.existsSync(hookPath)) {
  let hookContent = fs.readFileSync(hookPath, 'utf8');
  hookContent = hookContent.replace(
    '  return useMutation<\n    Product,\n    Error,',
    '  return useMutation<\n    SerializeDecimal<Product>,\n    Error,'
  );
  fs.writeFileSync(hookPath, hookContent, 'utf8');
  console.log('Fixed use-products.ts');
}
