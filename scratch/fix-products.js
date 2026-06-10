const fs = require('fs');

const fixFile = (path, find, replace) => {
  if (!fs.existsSync(path)) return;
  let content = fs.readFileSync(path, 'utf8');
  if (content.includes(find)) {
    content = content.split(find).join(replace);
    fs.writeFileSync(path, content, 'utf8');
  }
};

const productPath = 'd:/Projects/epidom/src/features/dashboard/data/products/hooks/use-products.ts';
let content = fs.readFileSync(productPath, 'utf8');
if (!content.includes('SerializeDecimal')) {
  content = 'import type { SerializeDecimal } from "@/types/prisma";\n' + content;
  fs.writeFileSync(productPath, content, 'utf8');
}

fixFile(productPath, 'products: Product[];', 'products: SerializeDecimal<Product>[];');
fixFile(productPath, 'Promise<Product>', 'Promise<SerializeDecimal<Product>>');
fixFile(productPath, 'useMutation<\n    Product,', 'useMutation<\n    SerializeDecimal<Product>,');
fixFile(productPath, 'useQuery<Product>', 'useQuery<SerializeDecimal<Product>>');
fixFile(productPath, 'getQueryData<Product>', 'getQueryData<SerializeDecimal<Product>>');
fixFile(productPath, 'setQueryData<Product>', 'setQueryData<SerializeDecimal<Product>>');
fixFile(productPath, 'as Product', 'as SerializeDecimal<Product>');
fixFile(productPath, 'previousProduct: Product | undefined', 'previousProduct: SerializeDecimal<Product> | undefined');

console.log('Restored and fixed use-products');
