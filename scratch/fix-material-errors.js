const fs = require('fs');
const path = 'd:/Projects/epidom/src/lib/services/material.service.ts';
let content = fs.readFileSync(path, 'utf8');

// Add imports
if (!content.includes('import { NotFoundError')) {
  content = content.replace('import { Material, MovementType } from "@prisma/client";', 'import { Material, MovementType } from "@prisma/client";\nimport { NotFoundError, DuplicateError, ForbiddenError, ValidationError } from "@/lib/errors";');
}

// Replace strings
content = content.replace(/throw new Error\("Material not found"\);/g, 'throw new NotFoundError("Material");');
content = content.replace(/throw new Error\("A material with this SKU already exists in your store"\);/g, 'throw new DuplicateError("Material", "SKU", data.sku!);');
content = content.replace(/throw new Error\("Only one supplier can be marked as preferred"\);/g, 'throw new ValidationError("Only one supplier can be marked as preferred");');
content = content.replace(/throw new Error\("Either materialId or productId must be provided"\);/g, 'throw new ValidationError("Either materialId or productId must be provided");');
content = content.replace(/throw new Error\("Product stock adjustment not yet implemented"\);/g, 'throw new ValidationError("Product stock adjustment not yet implemented");');
content = content.replace(/throw new Error\("Material does not belong to this store"\);/g, 'throw new ForbiddenError("Material does not belong to this store");');
content = content.replace(/throw new Error\("Stock cannot be negative"\);/g, 'throw new ValidationError("Stock cannot be negative");');
content = content.replace(/throw new Error\("Some materials do not belong to this store"\);/g, 'throw new ForbiddenError("Some materials do not belong to this store");');
content = content.replace(/throw new Error\("Supplier not found or does not belong to this store"\);/g, 'throw new NotFoundError("Supplier");');
content = content.replace(/throw new Error\("Supplier is already linked to this material"\);/g, 'throw new DuplicateError("MaterialSupplier", "supplierId", supplierId);');

fs.writeFileSync(path, content, 'utf8');
console.log('material.service.ts errors replaced');
