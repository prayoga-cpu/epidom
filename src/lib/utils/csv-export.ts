/**
 * CSV Export Utility
 * Simple utility for generating CSV files from data arrays
 */

/**
 * Escapes a value for CSV export
 * Wraps strings containing commas, quotes, or newlines in double quotes
 * Escapes double quotes by doubling them
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Converts an array of objects to CSV format
 * @param data - Array of data objects
 * @param headers - Array of header labels
 * @param columns - Array of functions to extract values from each object
 * @returns CSV string
 *
 * @example
 * const data = [{ name: "John", age: 30 }];
 * const csv = arrayToCSV(
 *   data,
 *   ["Name", "Age"],
 *   [(item) => item.name, (item) => item.age]
 * );
 */
export function arrayToCSV<T>(
  data: T[],
  headers: string[],
  columns: Array<(item: T) => unknown>
): string {
  // Validate input
  if (headers.length !== columns.length) {
    throw new Error("Headers and columns arrays must have the same length");
  }

  // Build CSV header row
  const headerRow = headers.map(escapeCSVValue).join(",");

  // Build CSV data rows
  const dataRows = data.map((item) => {
    const row = columns.map((column) => {
      const value = column(item);
      return escapeCSVValue(value);
    });
    return row.join(",");
  });

  // Combine header and data rows
  return [headerRow, ...dataRows].join("\n");
}

/**
 * Creates a CSV download response for Next.js API routes
 * @param csvContent - CSV string content
 * @param filename - Name of the file (without .csv extension)
 * @returns Response object ready to be returned from API route
 *
 * @example
 * export async function GET() {
 *   const csv = arrayToCSV(...);
 *   return createCSVResponse(csv, "products-export");
 * }
 */
export function createCSVResponse(csvContent: string, filename: string): Response {
  const date = new Date().toISOString().split("T")[0];
  const fullFilename = `${filename}-${date}.csv`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fullFilename}"`,
      "Cache-Control": "no-cache",
    },
  });
}
