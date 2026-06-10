const fs = require('fs');
const path = 'd:/Projects/epidom/src/lib/server/serialize.ts';
let content = fs.readFileSync(path, 'utf8');

// Add SerializeDecimal import
if (!content.includes('SerializeDecimal')) {
  content = content.replace(
    'import { decimalToNumber, type SerializedDecimal } from "@/types/prisma";',
    'import { decimalToNumber, type SerializedDecimal, type SerializeDecimal } from "@/types/prisma";'
  );
}

// Fix Material
content = content.replace(
  /export function serializeMaterial\(material: MaterialWithSuppliers\): MaterialWithSuppliers \{/g,
  'export function serializeMaterial(material: MaterialWithSuppliers): SerializeDecimal<MaterialWithSuppliers> {'
);
content = content.replace(
  /export function serializeMaterials\(materials: MaterialWithSuppliers\[\]\): MaterialWithSuppliers\[\] \{/g,
  'export function serializeMaterials(materials: MaterialWithSuppliers[]): SerializeDecimal<MaterialWithSuppliers>[] {'
);

// Fix Supplier
content = content.replace(
  /export function serializeSupplier\(supplier: SupplierWithRelations\): SupplierWithRelations \{/g,
  'export function serializeSupplier(supplier: SupplierWithRelations): SerializeDecimal<SupplierWithRelations> {'
);
content = content.replace(
  /export function serializeSuppliers\(suppliers: SupplierWithRelations\[\]\): SupplierWithRelations\[\] \{/g,
  'export function serializeSuppliers(suppliers: SupplierWithRelations[]): SerializeDecimal<SupplierWithRelations>[] {'
);

// Fix ProductionBatch
content = content.replace(
  /export function serializeProductionBatch\([\s\n]+batch: ProductionBatchWithRelations[\s\n]+\): ProductionBatchWithRelations \{/g,
  'export function serializeProductionBatch(\n  batch: ProductionBatchWithRelations\n): SerializeDecimal<ProductionBatchWithRelations> {'
);
content = content.replace(
  /export function serializeProductionBatches\([\s\n]+batches: ProductionBatchWithRelations\[\][\s\n]+\): ProductionBatchWithRelations\[\] \{/g,
  'export function serializeProductionBatches(\n  batches: ProductionBatchWithRelations[]\n): SerializeDecimal<ProductionBatchWithRelations>[] {'
);

// Fix Product
content = content.replace(
  /export function serializeProduct\(product: ProductWithRelations\): ProductWithRelations \{/g,
  'export function serializeProduct(product: ProductWithRelations): SerializeDecimal<ProductWithRelations> {'
);
content = content.replace(
  /export function serializeProducts\(products: ProductWithRelations\[\]\): ProductWithRelations\[\] \{/g,
  'export function serializeProducts(products: ProductWithRelations[]): SerializeDecimal<ProductWithRelations>[] {'
);

// Remove all `as any`
content = content.replace(/ as any/g, '');

fs.writeFileSync(path, content, 'utf8');
console.log('serialize.ts fixed');
