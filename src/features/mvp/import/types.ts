/**
 * MVP Import Types
 *
 * Type definitions for the import module
 */

export interface ParsedRow {
  [key: string]: string | number | null;
}

export interface ParsedData {
  headers: string[];
  rows: ParsedRow[];
  totalRows: number;
}

export interface ColumnMapping {
  sku: string | null;
  name: string | null;
  costPrice: string | null;
  sellingPrice: string | null;
  currentStock: string | null;
  category: string | null;
  unit: string | null;
}

export interface ImportPreviewProduct {
  sku: string;
  name: string;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  category?: string;
  unit?: string;
}

export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: ImportValidationError[];
}

// Required fields for import
export const REQUIRED_FIELDS: (keyof ColumnMapping)[] = [
  'sku',
  'name',
  'costPrice',
  'sellingPrice',
  'currentStock',
];

// Optional fields
export const OPTIONAL_FIELDS: (keyof ColumnMapping)[] = [
  'category',
  'unit',
];

// All mappable fields
export const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

// Field labels for UI
export const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  sku: 'SKU / Product Code',
  name: 'Product Name',
  costPrice: 'Cost Price (COGS)',
  sellingPrice: 'Selling Price',
  currentStock: 'Initial Stock',
  category: 'Category (Optional)',
  unit: 'Unit (Optional)',
};
