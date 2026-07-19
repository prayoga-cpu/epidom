/**
 * Utility functions for exporting data to various formats (CSV, Excel, PDF)
 */

import { isDate } from "@/lib/utils/types";
import { formatDate } from "@/lib/utils/format-date";

/**
 * Convert an array of objects to CSV string
 */
export function convertToCSV<T extends Record<string, any>>(
  data: T[],
  columns?: Array<{ key: keyof T; header: string }>
): string {
  if (data.length === 0) return "";

  // If no columns specified, use all keys from first object
  const cols = columns || Object.keys(data[0]).map((key) => ({ key: key as keyof T, header: key }));

  // Create header row
  const headers = cols.map((col) => col.header).join(",");

  // Create data rows
  const rows = data.map((row) => {
    return cols
      .map((col) => {
        const value = row[col.key];
        // Handle different data types
        if (value === null || value === undefined) return "";
        // Check for Date objects
        if (value && typeof value === "object" && "toISOString" in value) {
          return (value as Date).toISOString();
        }
        if (
          typeof value === "string" &&
          (value.includes(",") || value.includes('"') || value.includes("\n"))
        ) {
          // Escape quotes and wrap in quotes
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      })
      .join(",");
  });

  return [headers, ...rows].join("\n");
}

/**
 * Download CSV file
 */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
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

/**
 * Trigger a browser download for a data URL (e.g. a canvas `toDataURL()` PNG).
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export data to CSV file
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: Array<{ key: keyof T; header: string }>
): void {
  const csv = convertToCSV(data, columns);
  downloadCSV(csv, filename);
}

/**
 * Export data to Excel
 * Note: This is a simplified version. For full Excel support, use a library like 'xlsx'
 */
export async function exportToExcel<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: Array<{ key: keyof T; header: string }>
): Promise<void> {
  // Check if xlsx library is available
  if (typeof window === "undefined") {
    return;
  }

  try {
    // Dynamic import of xlsx library
    const XLSX = await import("xlsx");

    const cols =
      columns || Object.keys(data[0]).map((key) => ({ key: key as keyof T, header: key }));

    // Prepare data for Excel
    const worksheetData = [
      cols.map((col) => col.header), // Headers
      ...data.map((row) =>
        cols.map((col) => {
          const value = row[col.key];
          // Use type guard for Date conversion
          if (isDate(value)) {
            return value.toISOString();
          }
          return value;
        })
      ),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    // Write to file
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  } catch (error) {
    // Fallback to CSV
    exportToCSV(data, filename, columns);
  }
}

/**
 * Export data to PDF
 * Note: This requires a PDF library like jsPDF
 */
export async function exportToPDF<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: Array<{ key: keyof T; header: string }>,
  title?: string
): Promise<void> {
  try {
    // Dynamic import of jsPDF
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF();

    // Add title if provided
    if (title) {
      doc.setFontSize(16);
      doc.text(title, 14, 15);
    }

    const cols =
      columns || Object.keys(data[0]).map((key) => ({ key: key as keyof T, header: key }));

    // Prepare table data
    const headers = cols.map((col) => col.header);
    const body = data.map((row) =>
      cols.map((col) => {
        const value = row[col.key];
        // Use type guard for Date conversion
        if (isDate(value)) {
          return formatDate(value);
        }
        if (value === null || value === undefined) {
          return "";
        }
        return String(value);
      })
    );

    // Add table to PDF
    autoTable(doc, {
      head: [headers],
      body: body,
      startY: title ? 25 : 10,
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
    });

    // Save PDF
    doc.save(`${filename}.pdf`);
  } catch (error) {
    // Fallback to CSV
    exportToCSV(data, filename, columns);
  }
}

/**
 * Generic export function that handles all formats
 */
export async function exportData<T extends Record<string, any>>(
  data: T[],
  format: "csv" | "excel" | "pdf",
  filename: string,
  columns?: Array<{ key: keyof T; header: string }>,
  title?: string
): Promise<void> {
  switch (format) {
    case "csv":
      exportToCSV(data, filename, columns);
      break;
    case "excel":
      await exportToExcel(data, filename, columns);
      break;
    case "pdf":
      await exportToPDF(data, filename, columns, title);
      break;
    default:
  }
}

/**
 * Copy data to clipboard as CSV
 */
export async function copyToClipboard<T extends Record<string, any>>(
  data: T[],
  columns?: Array<{ key: keyof T; header: string }>
): Promise<void> {
  const csv = convertToCSV(data, columns);

  try {
    await navigator.clipboard.writeText(csv);
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = csv;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
    } catch (execCopyErr) {
      // execCommand is deprecated but used as last-resort fallback
      // Log for debugging but don't throw - clipboard failure is non-critical
      if (process.env.NODE_ENV === "development") {
        console.warn("Clipboard fallback failed:", execCopyErr);
      }
    }
    document.body.removeChild(textArea);
  }
}
