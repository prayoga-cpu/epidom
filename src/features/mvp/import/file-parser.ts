/**
 * MVP File Parser Utility
 *
 * Handles client-side parsing of CSV and XLSX files
 */

import * as XLSX from 'xlsx';
import type { ParsedData, ParsedRow, ColumnMapping } from './types';

/**
 * Parse a file (CSV or XLSX) and return structured data
 */
export async function parseFile(file: File): Promise<ParsedData> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    return parseCSV(file);
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseExcel(file);
  } else {
    throw new Error(`Unsupported file format: ${extension}. Please use CSV or XLSX.`);
  }
}

/**
 * Parse CSV file
 */
async function parseCSV(file: File): Promise<ParsedData> {
  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    throw new Error('File is empty');
  }

  // Parse headers (first line)
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every(v => !v)) continue; // Skip empty rows

    const row: ParsedRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? null;
    });
    rows.push(row);
  }

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parse Excel file (XLSX/XLS)
 */
async function parseExcel(file: File): Promise<ParsedData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Get the first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Excel file has no sheets');
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error('Could not read sheet');
  }

  // Convert to JSON
  const jsonData = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as unknown as unknown[][];

  if (jsonData.length === 0) {
    throw new Error('Sheet is empty');
  }

  // First row is headers
  const headers = (jsonData[0] as unknown[]).map(h => String(h ?? '').trim()).filter(h => h);

  // Rest are data rows
  const rows: ParsedRow[] = [];
  for (let i = 1; i < jsonData.length; i++) {
    const rowData = jsonData[i] as unknown[];
    if (!rowData || rowData.every(cell => cell === null || cell === '')) continue;

    const row: ParsedRow = {};
    headers.forEach((header, index) => {
      const value = rowData[index];
      if (typeof value === 'number') {
        row[header] = value;
      } else if (value !== null && value !== undefined) {
        row[header] = String(value).trim();
      } else {
        row[header] = null;
      }
    });
    rows.push(row);
  }

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
}

/**
 * Auto-detect column mappings based on header names
 */
export function autoDetectMappings(headers: string[]): ColumnMapping {
  const mappings: ColumnMapping = {
    sku: null,
    name: null,
    costPrice: null,
    sellingPrice: null,
    currentStock: null,
    category: null,
    unit: null,
  };

  const patterns: Record<string, RegExp[]> = {
    sku: [/sku/i, /kode/i, /code/i, /barcode/i, /product.?code/i],
    name: [/name/i, /nama/i, /product/i, /produk/i, /item/i],
    costPrice: [/cost/i, /cogs/i, /hpp/i, /modal/i, /beli/i, /purchase/i],
    sellingPrice: [/sell/i, /price/i, /harga/i, /jual/i],
    currentStock: [/stock/i, /stok/i, /qty/i, /quantity/i, /jumlah/i],
    category: [/category/i, /kategori/i, /type/i, /tipe/i],
    unit: [/unit/i, /satuan/i, /uom/i],
  };

  headers.forEach(header => {
    const lowerHeader = header.toLowerCase();

    for (const [field, regexes] of Object.entries(patterns)) {
      const key = field as keyof ColumnMapping;
      if (mappings[key]) continue; // Already mapped

      for (const regex of regexes) {
        if (regex.test(lowerHeader)) {
          mappings[key] = header;
          break;
        }
      }
    }
  });

  return mappings;
}
