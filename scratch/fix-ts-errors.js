const fs = require('fs');

const filesToFix = [
  'd:/Projects/epidom/src/app/(app)/store/[storeId]/(dashboard)/data/page.tsx',
  'd:/Projects/epidom/src/app/(app)/store/[storeId]/(dashboard)/tracking/page.tsx',
  'd:/Projects/epidom/src/features/dashboard/data/components/data-view-client.tsx',
  'd:/Projects/epidom/src/features/dashboard/tracking/components/tracking-client.tsx',
  'd:/Projects/epidom/src/features/dashboard/tracking/components/stock-levels-tab.tsx',
  'd:/Projects/epidom/src/features/dashboard/data/materials/components/materials-section.tsx',
  'd:/Projects/epidom/src/features/dashboard/data/materials/hooks/use-materials.ts',
  'd:/Projects/epidom/src/features/dashboard/management/edit-stock/hooks/use-stock-adjustment.ts',
];

for (const path of filesToFix) {
  if (!fs.existsSync(path)) continue;
  let content = fs.readFileSync(path, 'utf8');
  let changed = false;

  if (content.includes('MaterialWithSuppliers') && !content.includes('SerializeDecimal')) {
    if (content.includes('import {')) {
      content = content.replace('import {', 'import type { SerializeDecimal } from "@/types/prisma";\nimport {');
    } else {
      content = 'import type { SerializeDecimal } from "@/types/prisma";\n' + content;
    }
    changed = true;
  }

  // Replace type usages
  const replacements = [
    { from: 'initialMaterials?: MaterialWithSuppliers[]', to: 'initialMaterials?: SerializeDecimal<MaterialWithSuppliers>[]' },
    { from: 'initialSuppliers?: SupplierWithRelations[]', to: 'initialSuppliers?: SerializeDecimal<SupplierWithRelations>[]' },
    { from: 'initialMaterials: MaterialWithSuppliers[]', to: 'initialMaterials: SerializeDecimal<MaterialWithSuppliers>[]' },
    { from: 'initialProducts?: Product[]', to: 'initialProducts?: SerializeDecimal<Product>[]' },
    
    // In use-materials.ts
    { from: 'as unknown as MaterialWithSuppliers', to: 'as unknown as SerializeDecimal<MaterialWithSuppliers>' },
    { from: 'as MaterialWithSuppliers', to: 'as SerializeDecimal<MaterialWithSuppliers>' },
    { from: 'useMutation<\n    MaterialWithSuppliers,', to: 'useMutation<\n    SerializeDecimal<MaterialWithSuppliers>,' },
    { from: 'useQuery<MaterialWithSuppliers>', to: 'useQuery<SerializeDecimal<MaterialWithSuppliers>>' },
    { from: 'previousMaterial: MaterialWithSuppliers | undefined', to: 'previousMaterial: SerializeDecimal<MaterialWithSuppliers> | undefined' },
    { from: 'ApiSuccessResponse<MaterialWithSuppliers>', to: 'ApiSuccessResponse<SerializeDecimal<MaterialWithSuppliers>>' },
    { from: 'getQueryData<MaterialWithSuppliers>', to: 'getQueryData<SerializeDecimal<MaterialWithSuppliers>>' },
    { from: 'setQueryData<MaterialWithSuppliers>', to: 'setQueryData<SerializeDecimal<MaterialWithSuppliers>>' },
  ];

  for (const r of replacements) {
    if (content.includes(r.from)) {
      content = content.split(r.from).join(r.to);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(path, content, 'utf8');
  }
}

console.log('Fixed more TS errors');
