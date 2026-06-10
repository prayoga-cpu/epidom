const fs = require('fs');

let matSrc = fs.readFileSync('src/lib/services/material.service.ts', 'utf8');

const splitMarker = 'export class MaterialService';
if (matSrc.includes('export interface CreateMaterialInput')) {
  matSrc = matSrc.split('export interface CreateMaterialInput')[0] +
           matSrc.substring(matSrc.indexOf(splitMarker));
}

matSrc = matSrc.replace(
  /const supplier = await prisma\.supplier\.findUnique\(\{\s*where: \{ id: supplierId \},\s*select: \{ storeId: true \},\s*\}\);/,
  'const supplier = await supplierRepository.findById(supplierId);'
);

if (!matSrc.includes('supplierRepository')) {
  matSrc = matSrc.replace(
    'import { prisma } from "@/lib/prisma";',
    'import { supplierRepository } from "@/lib/repositories/supplier.repository";\nimport { prisma } from "@/lib/prisma";'
  );
}

fs.writeFileSync('src/lib/services/material.service.ts', matSrc);

let schemas = fs.readFileSync('src/lib/validation/inventory.schemas.ts', 'utf8');
schemas = schemas.replace(/z\.input/g, 'z.infer');
fs.writeFileSync('src/lib/validation/inventory.schemas.ts', schemas);

let testSrc = fs.readFileSync('src/lib/services/__tests__/material.service.test.ts', 'utf8');
testSrc = testSrc.replace(/unitCost: 10/g, 'unitCost: 10, currentStock: 0, minStock: 0, maxStock: 0');
testSrc = testSrc.replace(/unitCost: 15/g, 'unitCost: 15, currentStock: 0, minStock: 0, maxStock: 0');
fs.writeFileSync('src/lib/services/__tests__/material.service.test.ts', testSrc);

console.log('Done');
