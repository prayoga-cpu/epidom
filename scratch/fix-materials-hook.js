const fs = require('fs');

let f = 'd:/Projects/epidom/src/features/dashboard/data/materials/hooks/use-materials.ts';
let c = fs.readFileSync(f, 'utf8');

// Replace useCreateMaterial generic
c = c.replace(
  '  return useMutation<\n    MaterialWithSuppliers,\n    Error,\n    Omit<CreateIngredientInput, "storeId">,',
  '  return useMutation<\n    SerializeDecimal<MaterialWithSuppliers>,\n    Error,\n    Omit<CreateIngredientInput, "storeId">,'
);

// Replace useUpdateMaterial generic
c = c.replace(
  '  return useMutation<\n    MaterialWithSuppliers,\n    Error,\n    UpdateIngredientInput,',
  '  return useMutation<\n    SerializeDecimal<MaterialWithSuppliers>,\n    Error,\n    UpdateIngredientInput,'
);

fs.writeFileSync(f, c, 'utf8');
console.log('Fixed use-materials.ts useMutation generics');
