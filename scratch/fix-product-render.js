const fs = require('fs');

// 1. edit-product-dialog.tsx
let f1 = 'd:/Projects/epidom/src/features/dashboard/data/products/components/edit-product-dialog.tsx';
let c1 = fs.readFileSync(f1, 'utf8');
c1 = c1.replace(
  'product: SerializeDecimal<ProductWithRelations> | null;',
  'product: SerializeDecimal<ProductWithRelations>;'
);
fs.writeFileSync(f1, c1, 'utf8');

// 2. products-section.tsx
let f2 = 'd:/Projects/epidom/src/features/dashboard/data/products/components/products-section.tsx';
let c2 = fs.readFileSync(f2, 'utf8');

// The original code has:
// <EditProductDialog
//   storeId={storeId}
//   product={selectedProduct}
//   open={editDialogOpen}
//   onOpenChange={setEditDialogOpen}
// />

c2 = c2.replace(
  /<EditProductDialog\s+storeId=\{storeId\}\s+product=\{selectedProduct\}\s+open=\{editDialogOpen\}\s+onOpenChange=\{setEditDialogOpen\}\s+\/>/g,
  '{selectedProduct && (\n            <EditProductDialog\n              storeId={storeId}\n              product={selectedProduct}\n              open={editDialogOpen}\n              onOpenChange={setEditDialogOpen}\n            />\n          )}'
);
fs.writeFileSync(f2, c2, 'utf8');

console.log('Fixed EditProductDialog and products-section.tsx!');
