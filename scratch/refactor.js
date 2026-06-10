const fs = require('fs');

let materialService = fs.readFileSync('src/lib/services/material.service.ts', 'utf8');

materialService = materialService.replace(
  /const supplier = await prisma\.supplier\.findUnique\(\{\s*where: \{ id: supplierId \},\s*select: \{ storeId: true \},\s*\}\);/,
  'const supplier = await supplierRepository.findById(supplierId);'
);

if (!materialService.includes('supplierRepository')) {
  materialService = materialService.replace(
    'import { prisma } from "@/lib/prisma";',
    'import { supplierRepository } from "@/lib/repositories/supplier.repository";\nimport { prisma } from "@/lib/prisma";'
  );
}

materialService = materialService.replace(/export interface CreateMaterialInput \{[\s\S]*?\}\n\n/g, '');
materialService = materialService.replace(/export interface UpdateMaterialInput \{[\s\S]*?\}\n\n/g, '');
materialService = materialService.replace(/export interface UpdateSupplierInput \{[\s\S]*?\}\n\n/g, '');

materialService = materialService.replace(
  'import { toDecimal } from "@/lib/utils/types.server";',
  'import { toDecimal } from "@/lib/utils/types.server";\nimport type { CreateMaterialInput, UpdateMaterialInput, UpdateMaterialSupplierInput } from "@/lib/validation/inventory.schemas";'
);

materialService = materialService.replace(/UpdateSupplierInput/g, 'UpdateMaterialSupplierInput');
fs.writeFileSync('src/lib/services/material.service.ts', materialService);

let entitiesTs = fs.readFileSync('src/types/entities.ts', 'utf8');
entitiesTs = entitiesTs.replace(/export interface CreateMaterialDto \{[\s\S]*?\}\n\n/g, '');
entitiesTs = entitiesTs.replace(/export interface UpdateMaterialDto \{[\s\S]*?\}\n\n/g, '');
fs.writeFileSync('src/types/entities.ts', entitiesTs);

console.log('Done');
