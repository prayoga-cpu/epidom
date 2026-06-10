const fs = require('fs');

const fixFile = (path, find, replace) => {
  if (!fs.existsSync(path)) return;
  let content = fs.readFileSync(path, 'utf8');
  if (content.includes(find)) {
    content = content.split(find).join(replace);
    fs.writeFileSync(path, content, 'utf8');
  }
};

const supplierPath = 'd:/Projects/epidom/src/features/dashboard/data/suppliers/hooks/use-suppliers.ts';
fixFile(supplierPath, 'Promise<SupplierWithRelations>', 'Promise<SerializeDecimal<SupplierWithRelations>>');
fixFile(supplierPath, 'useMutation<\n    SupplierWithRelations,', 'useMutation<\n    SerializeDecimal<SupplierWithRelations>,');
fixFile(supplierPath, 'useQuery<SupplierWithRelations>', 'useQuery<SerializeDecimal<SupplierWithRelations>>');
fixFile(supplierPath, 'getQueryData<SupplierWithRelations>', 'getQueryData<SerializeDecimal<SupplierWithRelations>>');
fixFile(supplierPath, 'setQueryData<SupplierWithRelations>', 'setQueryData<SerializeDecimal<SupplierWithRelations>>');
fixFile(supplierPath, 'as SupplierWithRelations', 'as SerializeDecimal<SupplierWithRelations>');
fixFile(supplierPath, 'previousSupplier: SupplierWithRelations | undefined', 'previousSupplier: SerializeDecimal<SupplierWithRelations> | undefined');


const productPath = 'd:/Projects/epidom/src/features/dashboard/data/products/hooks/use-products.ts';
fixFile(productPath, 'Promise<Product>', 'Promise<SerializeDecimal<Product>>');
fixFile(productPath, 'useMutation<\n    Product,', 'useMutation<\n    SerializeDecimal<Product>,');
fixFile(productPath, 'useQuery<Product>', 'useQuery<SerializeDecimal<Product>>');
fixFile(productPath, 'getQueryData<Product>', 'getQueryData<SerializeDecimal<Product>>');
fixFile(productPath, 'setQueryData<Product>', 'setQueryData<SerializeDecimal<Product>>');
fixFile(productPath, 'as Product', 'as SerializeDecimal<Product>');
fixFile(productPath, 'previousProduct: Product | undefined', 'previousProduct: SerializeDecimal<Product> | undefined');

const stockLevelsPath = 'd:/Projects/epidom/src/features/dashboard/tracking/components/stock-levels-tab.tsx';
fixFile(stockLevelsPath, 'initialProducts?: ProductWithRelations[];', 'initialProducts?: SerializeDecimal<Product>[];');

console.log('Hooks fixed perfectly');
