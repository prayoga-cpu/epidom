const fs = require('fs');

const file = 'd:/Projects/epidom/src/features/dashboard/tracking/components/stock-levels-tab.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import type { Product } from "@prisma/client";')) {
  content = content.replace(
    'import type { ProductWithRelations } from "@/lib/repositories/product.repository";',
    'import type { ProductWithRelations } from "@/lib/repositories/product.repository";\nimport type { Product } from "@prisma/client";\nimport type { SerializeDecimal } from "@/types/prisma";'
  );
}

content = content.replace('initialProducts?: ProductWithRelations[];', 'initialProducts?: SerializeDecimal<Product>[];');

fs.writeFileSync(file, content, 'utf8');

console.log('Fixed stock-levels-tab.tsx');
