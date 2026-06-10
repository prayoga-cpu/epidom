const fs = require('fs');

// 1. material.service.ts - fix 'data.sku!'
let matPath = 'd:/Projects/epidom/src/lib/services/material.service.ts';
let mat = fs.readFileSync(matPath, 'utf8');
mat = mat.replace(/throw new DuplicateError\("Material", "SKU", data\.sku!\);/g, 'throw new DuplicateError("Material", "SKU", sku);');
fs.writeFileSync(matPath, mat, 'utf8');

// 2. product.service.ts - add imports
let prodPath = 'd:/Projects/epidom/src/lib/services/product.service.ts';
let prod = fs.readFileSync(prodPath, 'utf8');
if (!prod.includes('import { NotFoundError')) {
  prod = 'import { NotFoundError, DuplicateError, ForbiddenError, ValidationError } from "@/lib/errors";\n' + prod;
  fs.writeFileSync(prodPath, prod, 'utf8');
}

// 3. subscription.service.ts - add imports
let subPath = 'd:/Projects/epidom/src/lib/services/subscription.service.ts';
let sub = fs.readFileSync(subPath, 'utf8');
if (!sub.includes('import { NotFoundError')) {
  sub = 'import { NotFoundError, DuplicateError, ForbiddenError, ValidationError } from "@/lib/errors";\n' + sub;
  fs.writeFileSync(subPath, sub, 'utf8');
}

// 4. stripe-connect.service.ts - fix import path
let stripePath = 'd:/Projects/epidom/src/lib/services/stripe-connect.service.ts';
let stripeStr = fs.readFileSync(stripePath, 'utf8');
stripeStr = stripeStr.replace(/import \{ stripe \} from "@\/lib\/stripe\/config";/, 'import { stripe } from "@/lib/stripe";');
fs.writeFileSync(stripePath, stripeStr, 'utf8');

console.log('Fixes applied successfully');
