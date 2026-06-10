const fs = require('fs');
const path = require('path');

const dir = 'd:/Projects/epidom/src/features/dashboard/data/suppliers/components';
const files = [
  'suppliers-section.tsx',
  'supplier-details-dialog.tsx',
  'edit-supplier-dialog.tsx',
  'add-supplier-dialog.tsx' // Add might not have it, but just in case
];

for (const file of files) {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('SupplierWithRelations') && !content.includes('SerializeDecimal<SupplierWithRelations>')) {
    if (!content.includes('import type { SerializeDecimal } from "@/types/prisma";')) {
      content = content.replace(
        'import type { SupplierWithRelations }',
        'import type { SerializeDecimal } from "@/types/prisma";\nimport type { SupplierWithRelations }'
      );
      content = content.replace(
        'import { SupplierWithRelations }',
        'import type { SerializeDecimal } from "@/types/prisma";\nimport { SupplierWithRelations }'
      );
    }
    
    // In edit-supplier-dialog.tsx, add-supplier-dialog.tsx, supplier-details-dialog.tsx, suppliers-section.tsx
    // we want to replace `SupplierWithRelations` with `SerializeDecimal<SupplierWithRelations>`
    // BUT only when it's used as a type (not in the import statement)
    
    // We can do a regex replace that avoids the import statement.
    const importRegex1 = /import type \{ SupplierWithRelations \} from "[^"]+";/g;
    const importRegex2 = /import \{ SupplierWithRelations \} from "[^"]+";/g;
    
    let imports = [];
    content = content.replace(importRegex1, (m) => { imports.push(m); return `__IMPORT_1__`; });
    content = content.replace(importRegex2, (m) => { imports.push(m); return `__IMPORT_2__`; });
    
    content = content.replace(/\bSupplierWithRelations\b/g, 'SerializeDecimal<SupplierWithRelations>');
    
    content = content.replace('__IMPORT_1__', imports[0] || '');
    content = content.replace('__IMPORT_2__', imports[1] || imports[0] || '');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${file}`);
  }
}
