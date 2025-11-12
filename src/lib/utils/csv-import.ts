/**
 * CSV Import Utility
 * Simple utility for parsing CSV files
 */

/**
 * Parse CSV string into array of objects
 * @param csvContent - CSV string content
 * @param hasHeader - Whether the CSV has a header row (default: true)
 * @returns Array of objects with keys from header row
 */
export function parseCSV(csvContent: string, hasHeader = true): Record<string, string>[] {
  const lines = csvContent.split("\n").filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return [];
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  if (!hasHeader) {
    // If no header, use column indices as keys
    const maxColumns = Math.max(...lines.map((line) => parseCSVLine(line).length));
    return lines.map((line) => {
      const values = parseCSVLine(line);
      const obj: Record<string, string> = {};
      values.forEach((value, index) => {
        obj[`column_${index}`] = value;
      });
      return obj;
    });
  }

  // Parse data rows
  const data: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header.trim()] = values[index]?.trim() || "";
    });
    data.push(obj);
  }

  return data;
}

/**
 * Parse a single CSV line, handling quoted values
 * @param line - CSV line string
 * @returns Array of values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // End of value
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Add last value
  values.push(current);

  return values;
}

