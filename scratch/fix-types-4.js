const fs = require('fs');

// 1. dashboard-client.tsx
let f1 = 'd:/Projects/epidom/src/features/dashboard/dashboard/components/dashboard-client.tsx';
let c1 = fs.readFileSync(f1, 'utf8');

c1 = c1.replace(
  /initialStockLevels:\s*MaterialWithSuppliers\[\];/,
  'initialStockLevels: SerializeDecimal<MaterialWithSuppliers>[];'
);
c1 = c1.replace(
  /initialSuppliers:\s*SupplierWithRelations\[\];/,
  'initialSuppliers: SerializeDecimal<SupplierWithRelations>[];'
);
c1 = c1.replace(
  /initialProductionBatches:\s*ProductionBatchWithRelations\[\];/,
  'initialProductionBatches: SerializeDecimal<ProductionBatchWithRelations>[];'
);
if (!c1.includes('import type { SerializeDecimal }')) {
  c1 = c1.replace(
    'import type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";',
    'import type { SerializeDecimal } from "@/types/prisma";\nimport type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";'
  );
}

fs.writeFileSync(f1, c1, 'utf8');

// 2. materials-section.tsx
let f2 = 'd:/Projects/epidom/src/features/dashboard/data/materials/components/materials-section.tsx';
let c2 = fs.readFileSync(f2, 'utf8');

c2 = c2.replace(
  /material\.materialSuppliers\?\.find\(\(s\) => s\.isPreferred\)/,
  'material.materialSuppliers?.find((s: any) => s.isPreferred)'
);

c2 = c2.replace(
  /material=\{selectedMaterial\}/,
  'material={selectedMaterial}' // No change needed if it's already SerializeDecimal
);

fs.writeFileSync(f2, c2, 'utf8');

console.log('Fixed dashboard-client.tsx and materials-section.tsx (with regex!)');
