/**
 * CSV Export Utility
 *
 * Generate Google Sheets compatible CSV files
 */

/**
 * Convert array of objects to CSV string
 */
export function arrayToCSV<T extends Record<string, unknown>>(
  data: T[],
  headers?: { key: keyof T; label: string }[]
): string {
  if (data.length === 0) return "";

  // Use provided headers or auto-generate from first object
  const columns = headers || Object.keys(data[0]).map((key) => ({ key: key as keyof T, label: key }));

  // Header row
  const headerRow = columns.map((col) => escapeCSVValue(col.label)).join(",");

  // Data rows
  const dataRows = data.map((row) =>
    columns.map((col) => escapeCSVValue(formatValue(row[col.key]))).join(",")
  );

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Escape special characters for CSV
 */
function escapeCSVValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format value for CSV
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace("T", " ");
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/**
 * Download CSV file in browser
 */
export function downloadCSV(csv: string, filename: string): void {
  // Add BOM for Excel compatibility
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
