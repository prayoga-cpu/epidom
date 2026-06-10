const fs = require('fs');
let f = 'd:/Projects/epidom/src/features/dashboard/data/materials/hooks/use-materials.ts';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(/ApiSuccessResponse<MaterialWithSuppliers>/g, 'ApiSuccessResponse<SerializeDecimal<MaterialWithSuppliers>>');
c = c.replace(/getQueryData<MaterialWithSuppliers>/g, 'getQueryData<SerializeDecimal<MaterialWithSuppliers>>');
c = c.replace(/setQueryData<MaterialWithSuppliers>/g, 'setQueryData<SerializeDecimal<MaterialWithSuppliers>>');
c = c.replace(/previousMaterial: MaterialWithSuppliers \| undefined;/g, 'previousMaterial: SerializeDecimal<MaterialWithSuppliers> | undefined;');
c = c.replace(/return useQuery<MaterialWithSuppliers>\(\{/g, 'return useQuery<SerializeDecimal<MaterialWithSuppliers>>({');
c = c.replace(/\} as unknown as MaterialWithSuppliers/g, '} as unknown as SerializeDecimal<MaterialWithSuppliers>');
c = c.replace(/\} as MaterialWithSuppliers\)/g, '} as SerializeDecimal<MaterialWithSuppliers>)');

fs.writeFileSync(f, c, 'utf8');
console.log('Fixed MaterialWithSuppliers!');
