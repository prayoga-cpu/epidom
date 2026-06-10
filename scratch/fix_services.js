const fs = require('fs');

let matSrc = fs.readFileSync('src/lib/services/material.service.ts', 'utf8');

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

const oldInterfaces = `export interface CreateMaterialInput {
  storeId: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  unitCost: number;
  currentStock?: number;
  minStock?: number;
  maxStock?: number;
  suppliers?: Array<{
    supplierId: string;
    price: number;
    isPreferred?: boolean;
  }>;
}

export interface UpdateMaterialInput {
  sku?: string;
  name?: string;
  description?: string;
  category?: string;
  unit?: string;
  unitCost?: number;
  currentStock?: number;
  minStock?: number;
  maxStock?: number;
  suppliers?: Array<{
    supplierId: string;
    price: number;
    isPreferred?: boolean;
  }>;
}

export interface UpdateSupplierInput {
  price?: number;
  isPreferred?: boolean;
}`;

matSrc = matSrc.replace(oldInterfaces, '');

matSrc = matSrc.replace(
  'import { toDecimal } from "@/lib/utils/types.server";',
  'import { toDecimal } from "@/lib/utils/types.server";\nimport type { CreateMaterialInput, UpdateMaterialInput, UpdateMaterialSupplierInput, AddMaterialSupplierInput } from "@/lib/validation/inventory.schemas";'
);

matSrc = matSrc.replace(/UpdateSupplierInput/g, 'UpdateMaterialSupplierInput');
matSrc = matSrc.replace(/AddSupplierInput/g, 'AddMaterialSupplierInput');

fs.writeFileSync('src/lib/services/material.service.ts', matSrc);

let prodSrc = fs.readFileSync('src/lib/services/production-batch.service.ts', 'utf8');
const oldPrismaProd = `    const isLinked = await prisma.recipeProduct.findFirst({
      where: {
        productId: data.productId,
        recipeId: data.recipeId,
      },
    });`;

prodSrc = prodSrc.replace(
  oldPrismaProd,
  `    const isLinked = await recipeRepository.isProductLinked(data.productId, data.recipeId);`
);

fs.writeFileSync('src/lib/services/production-batch.service.ts', prodSrc);

console.log("Done");
