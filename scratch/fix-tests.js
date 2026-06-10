const fs = require('fs');

const matTestPath = 'd:/Projects/epidom/src/lib/services/__tests__/material.service.test.ts';
let mat = fs.readFileSync(matTestPath, 'utf8');
mat = mat.replace(/"A material with this SKU already exists"/g, '"Material with SKU \'EXISTING-SKU\' already exists"');
fs.writeFileSync(matTestPath, mat, 'utf8');

const prodTestPath = 'd:/Projects/epidom/src/lib/services/__tests__/product.service.test.ts';
let prod = fs.readFileSync(prodTestPath, 'utf8');
prod = prod.replace(/'Product with SKU "EXISTING-SKU" already exists in this store'/g, '"Product with SKU \'EXISTING-SKU\' already exists"');
prod = prod.replace(/'Product with name "Existing Name" already exists in this store'/g, '"Product with name \'Existing Name\' already exists"');
fs.writeFileSync(prodTestPath, prod, 'utf8');

const recipeTestPath = 'd:/Projects/epidom/src/lib/services/__tests__/recipe.service.test.ts';
let rec = fs.readFileSync(recipeTestPath, 'utf8');
rec = rec.replace(/'Recipe with name "Existing Recipe" already exists'/g, '"Recipe with name \'Existing Recipe\' already exists"');
rec = rec.replace(/"Recipe not found or does not belong to this store"/g, '"Recipe with id \'recipe-1\' not found"');
rec = rec.replace(/"Material not found or does not belong to this store"/g, '"Material with id \'mat-1\' not found"');
fs.writeFileSync(recipeTestPath, rec, 'utf8');

const subTestPath = 'd:/Projects/epidom/src/lib/services/__tests__/subscription.service.test.ts';
let sub = fs.readFileSync(subTestPath, 'utf8');
sub = sub.replace(/"No active subscription found"/g, '"Active Subscription not found"');
sub = sub.replace(/"No subscription found"/g, '"Subscription not found"');
fs.writeFileSync(subTestPath, sub, 'utf8');

console.log('Fixed test assertions');
