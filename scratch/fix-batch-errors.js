const fs = require('fs');
const path = 'd:/Projects/epidom/src/lib/services/production-batch.service.ts';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('import { NotFoundError')) {
  content = content.replace(
    'import { prisma } from "../prisma";',
    'import { prisma } from "../prisma";\nimport { NotFoundError, DuplicateError, ForbiddenError, ValidationError, InsufficientStockError } from "@/lib/errors";'
  );
}

// Single-line replacements
content = content.replace(/throw new Error\("Recipe not found"\);/g, 'throw new NotFoundError("Recipe");');
content = content.replace(/throw new Error\("Recipe not found or does not belong to this store"\);/g, 'throw new NotFoundError("Recipe");');
content = content.replace(/throw new Error\("Product not found or does not belong to this store"\);/g, 'throw new NotFoundError("Product");');
content = content.replace(/throw new Error\(`Insufficient materials: \$\{insufficientMaterials\}`\);/g, 'throw new InsufficientStockError(insufficientMaterials, 0, 0);');
content = content.replace(/throw new Error\("Production batch not found or does not belong to this store"\);/g, 'throw new NotFoundError("ProductionBatch");');
content = content.replace(/throw new Error\("Production batch not found"\);/g, 'throw new NotFoundError("ProductionBatch");');
content = content.replace(/throw new Error\("Only batches in progress can be completed"\);/g, 'throw new ValidationError("Only batches in progress can be completed");');
content = content.replace(/throw new Error\("Product not found"\);/g, 'throw new NotFoundError("Product");');
content = content.replace(/throw new Error\("Cannot cancel completed batches"\);/g, 'throw new ValidationError("Cannot cancel completed batches");');
content = content.replace(/throw new Error\("Batch is already cancelled"\);/g, 'throw new ValidationError("Batch is already cancelled");');
content = content.replace(/throw new Error\("Can only delete planned batches\. Cancel in-progress batches instead\."\);/g, 'throw new ValidationError("Can only delete planned batches. Cancel in-progress batches instead.");');

// Multi-line replacements
content = content.replace(/throw new Error\([\s\n]+"Product and recipe are not linked\. Please link the product to this recipe first\."[\s\n]+\);/g, 'throw new ValidationError("Product and recipe are not linked. Please link the product to this recipe first.");');
content = content.replace(/throw new Error\([\s\n]+`Cannot start production: Material '\$\{ingredient\.material\?\.name \|\| ingredient\.materialId\}' not found\. Please check your recipe ingredients\.`[\s\n]+\);/g, 'throw new NotFoundError("Material", ingredient.material?.name || ingredient.materialId);');
content = content.replace(/throw new Error\([\s\n]+`Insufficient stock for material '\$\{material\.name\}'\. Required: \$\{deductionAmount\.toFixed\(2\)\} \$\{materialUnit\}, Available: \$\{currentStock\.toFixed\(2\)\} \$\{materialUnit\}\.`[\s\n]+\);/g, 'throw new InsufficientStockError(material.name, deductionAmount, currentStock);');
content = content.replace(/throw new Error\([\s\n]+`Production start failed due to database timeout\. This may be caused by high server load\. Please try again in a moment\.`[\s\n]+\);/g, 'throw new ValidationError("Production start failed due to database timeout. This may be caused by high server load. Please try again in a moment.");');
content = content.replace(/throw new Error\([\s\n]+`Database connection unavailable\. The server is currently busy\. Please try again shortly\.`[\s\n]+\);/g, 'throw new ValidationError("Database connection unavailable. The server is currently busy. Please try again shortly.");');
content = content.replace(/throw new Error\([\s\n]+`Production start took too long to complete\. Please try again or contact support if the issue persists\.`[\s\n]+\);/g, 'throw new ValidationError("Production start took too long to complete. Please try again or contact support if the issue persists.");');
content = content.replace(/throw new Error\([\s\n]+`Failed to start production batch\. Please check your materials and try again\. If the problem continues, contact support\.`[\s\n]+\);/g, 'throw new ValidationError("Failed to start production batch. Please check your materials and try again. If the problem continues, contact support.");');

fs.writeFileSync(path, content, 'utf8');
console.log('production-batch.service.ts errors replaced');
