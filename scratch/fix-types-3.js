const fs = require('fs');

// 1. dashboard-client.tsx
let f1 = 'd:/Projects/epidom/src/features/dashboard/dashboard/components/dashboard-client.tsx';
let c1 = fs.readFileSync(f1, 'utf8');
c1 = c1.replace(
  'import type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";',
  'import type { SerializeDecimal } from "@/types/prisma";\nimport type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";'
);
c1 = c1.replace(
  'initialStockLevels: MaterialWithSuppliers[];\n  initialSuppliers: SupplierWithRelations[];\n  initialProductionBatches: ProductionBatchWithRelations[];',
  'initialStockLevels: SerializeDecimal<MaterialWithSuppliers>[];\n  initialSuppliers: SerializeDecimal<SupplierWithRelations>[];\n  initialProductionBatches: SerializeDecimal<ProductionBatchWithRelations>[];'
);
fs.writeFileSync(f1, c1, 'utf8');

// 2. material-details-dialog.tsx
let f2 = 'd:/Projects/epidom/src/features/dashboard/data/materials/components/material-details-dialog.tsx';
let c2 = fs.readFileSync(f2, 'utf8');
c2 = c2.replace(
  'material: MaterialWithSuppliers | null;',
  'material: SerializeDecimal<MaterialWithSuppliers> | null;'
);
c2 = c2.replace(
  'onEdit?: (material: MaterialWithSuppliers) => void;',
  'onEdit?: (material: SerializeDecimal<MaterialWithSuppliers>) => void;'
);
fs.writeFileSync(f2, c2, 'utf8');

console.log('Fixed dashboard-client.tsx and material-details-dialog.tsx!');
