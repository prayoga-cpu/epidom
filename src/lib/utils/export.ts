/**
 * Export Utilities
 *
 * Centralized utilities for CSV export functionality.
 * Following DRY principle to avoid code duplication across hooks.
 */

/**
 * Download a CSV file from a blob response
 *
 * @param blob - Blob response from API
 * @param filename - Filename for the downloaded file (without extension)
 * @param prefix - Optional prefix for the filename (e.g., "materials", "products")
 *
 * @example
 * const response = await fetch(url);
 * const blob = await response.blob();
 * downloadCSV(blob, "export", "materials");
 * // Downloads: materials-export-2024-01-01.csv
 */
export function downloadCSV(blob: Blob, filename: string, prefix?: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  // Build filename with optional prefix
  const date = new Date().toISOString().split("T")[0];
  const fullFilename = prefix ? `${prefix}-${filename}-${date}.csv` : `${filename}-${date}.csv`;
  a.download = fullFilename;

  // Trigger download
  document.body.appendChild(a);
  a.click();

  // Cleanup
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Export data to CSV via API endpoint
 * Handles the full flow: fetch, error handling, and download
 *
 * @param url - API endpoint URL
 * @param filename - Filename for the downloaded file
 * @param prefix - Optional prefix for the filename
 * @param filters - Optional filters to append as query params
 *
 * @example
 * await exportToCSV(
 *   `/api/stores/${storeId}/materials/export`,
 *   "export",
 *   "materials",
 *   { search: "test", sortBy: "name" }
 * );
 */
export async function exportToCSV(
  url: string,
  filename: string,
  prefix?: string,
  filters?: Record<string, unknown>
): Promise<void> {
  // Build query string from filters if provided
  let fullUrl = url;
  if (filters && Object.keys(filters).length > 0) {
    const queryString = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        queryString.append(key, String(value));
      }
    });
    fullUrl = `${url}?${queryString.toString()}`;
  }

  // Fetch the CSV file
  const response = await fetch(fullUrl);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to export data");
  }

  // Download the blob
  const blob = await response.blob();
  downloadCSV(blob, filename, prefix);
}

/**
 * Export data to CSV/Excel/PDF format
 * Client-side export utility for ExportButton component
 *
 * @param data - Array of data objects to export
 * @param format - Export format: "csv" | "excel" | "pdf"
 * @param filename - Base filename (without extension)
 * @param columns - Optional column definitions for custom headers
 * @param title - Optional title for PDF exports
 */
export async function exportData<T extends Record<string, any>>(
  data: T[],
  format: "csv" | "excel" | "pdf",
  filename: string,
  columns?: Array<{ key: keyof T; header: string }>,
  title?: string
): Promise<void> {
  if (data.length === 0) {
    throw new Error("No data to export");
  }

  // Get headers from columns or use object keys
  const headers = columns
    ? columns.map((col) => col.header)
    : Object.keys(data[0]);

  // Get data rows
  const rows = data.map((item) => {
    if (columns) {
      return columns.map((col) => {
        const value = item[col.key];
        return value !== null && value !== undefined ? String(value) : "";
      });
    }
    return Object.values(item).map((value) =>
      value !== null && value !== undefined ? String(value) : ""
    );
  });

  // Build CSV content
  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

  // Add BOM for Excel compatibility
  const BOM = "\uFEFF";
  const csvWithBOM = BOM + csvContent;

  // Create blob
  let blob: Blob;
  let extension: string;

  if (format === "csv" || format === "excel") {
    blob = new Blob([csvWithBOM], { type: "text/csv;charset=utf-8;" });
    extension = format === "excel" ? "xlsx" : "csv";
  } else {
    // PDF export - for now, just export as CSV
    // TODO: Implement proper PDF generation if needed
    blob = new Blob([csvWithBOM], { type: "text/csv;charset=utf-8;" });
    extension = "csv";
  }

  // Download file
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().split("T")[0];
  a.download = `${filename}-${date}.${extension}`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
