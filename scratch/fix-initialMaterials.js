const fs = require('fs');

const file = 'd:/Projects/epidom/src/features/dashboard/tracking/components/stock-levels-tab.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('initialMaterials?: MaterialWithSuppliers[];', 'initialMaterials?: SerializeDecimal<MaterialWithSuppliers>[];');

fs.writeFileSync(file, content, 'utf8');

console.log('Fixed initialMaterials in stock-levels-tab.tsx');
