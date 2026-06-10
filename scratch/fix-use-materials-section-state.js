const fs = require('fs');
let f = 'd:/Projects/epidom/src/features/dashboard/data/materials/hooks/use-material-section-state.ts';
let c = fs.readFileSync(f, 'utf8');

if (!c.includes('import type { SerializeDecimal }')) {
  c = c.replace(
    'import type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";',
    'import type { SerializeDecimal } from "@/types/prisma";\nimport type { MaterialWithSuppliers } from "@/lib/repositories/material.repository";'
  );
}

c = c.replace(/initialMaterials\?: MaterialWithSuppliers\[\];/g, 'initialMaterials?: SerializeDecimal<MaterialWithSuppliers>[];');
c = c.replace(/material: MaterialWithSuppliers \| null/g, 'material: SerializeDecimal<MaterialWithSuppliers> | null');

fs.writeFileSync(f, c, 'utf8');
console.log('Fixed use-material-section-state.ts!');
