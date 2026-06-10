const fs = require('fs');
const path = 'd:/Projects/epidom/src/lib/services/product.service.ts';
let content = fs.readFileSync(path, 'utf8');

// Add imports
if (!content.includes('import { NotFoundError')) {
  content = content.replace('import { Product, Prisma } from "@prisma/client";', 'import { Product, Prisma } from "@prisma/client";\nimport { NotFoundError, DuplicateError, ForbiddenError, ValidationError } from "@/lib/errors";');
}

// Replace strings
content = content.replace(/throw new Error\(\`Product with SKU \"\$\{data\.sku\}\" already exists in this store\`\);/g, 'throw new DuplicateError("Product", "SKU", data.sku!);');
content = content.replace(/throw new Error\(\`Product with name \"\$\{data\.name\}\" already exists in this store\`\);/g, 'throw new DuplicateError("Product", "name", data.name!);');
content = content.replace(/throw new Error\("Selling price cannot be less than cost price"\);/g, 'throw new ValidationError("Selling price cannot be less than cost price");');
content = content.replace(/throw new Error\("Product not found"\);/g, 'throw new NotFoundError("Product");');
content = content.replace(/throw new Error\("Product does not belong to this store"\);/g, 'throw new ForbiddenError("Product does not belong to this store");');
content = content.replace(/throw new Error\("One or more products do not belong to this store"\);/g, 'throw new ForbiddenError("One or more products do not belong to this store");');

fs.writeFileSync(path, content, 'utf8');
console.log('product.service.ts errors replaced');
