const fs = require('fs');

let f = 'd:/Projects/epidom/src/features/dashboard/data/materials/hooks/use-materials.ts';
let c = fs.readFileSync(f, 'utf8');

// Replace all MaterialWithSuppliers that aren't preceded by 'import', 'SerializeDecimal<', or 'type '
c = c.replace(/(?<!import\s*\{\s*)(?<!import\s+type\s*\{\s*)(?<!SerializeDecimal<)MaterialWithSuppliers(?!>)/g, 'SerializeDecimal<MaterialWithSuppliers>');

fs.writeFileSync(f, c, 'utf8');
console.log('Fixed use-materials.ts MaterialWithSuppliers');
