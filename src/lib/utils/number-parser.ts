/**
 * Smart Number Parser
 * Handles various number formats commonly found in CSV/Excel exports:
 * - Indonesian: 1.234.567,89 (dot as thousands, comma as decimal)
 * - US/UK: 1,234,567.89 (comma as thousands, dot as decimal)
 * - Plain: 1234567.89 or 1234567,89
 * - Currency prefixed: Rp 50.000, $1,500.00, IDR 100000
 * - Negative with parentheses: (5000) -> -5000
 * - Percentage: 10% -> 0.1 (optional)
 */

export interface ParseNumberOptions {
  /** If true, treat percentage values (10%) as decimals (0.1) */
  parsePercentage?: boolean;
  /** Default value if parsing fails */
  defaultValue?: number;
  /** If true, allow negative numbers */
  allowNegative?: boolean;
}

const DEFAULT_OPTIONS: ParseNumberOptions = {
  parsePercentage: false,
  defaultValue: 0,
  allowNegative: true,
};

/**
 * Detects the likely number format based on patterns in the string
 */
function detectFormat(value: string): "ID_EU" | "US_UK" | "PLAIN" {
  // Remove currency symbols and whitespace for analysis
  const cleaned = value.replace(/[^\d.,\-()]/g, "");

  // Count occurrences of dots and commas
  const dots = (cleaned.match(/\./g) || []).length;
  const commas = (cleaned.match(/,/g) || []).length;

  // If there's a comma after a dot, it's ID/EU format (1.234,56)
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");

  if (lastComma > lastDot && lastComma !== -1) {
    // Comma is the decimal separator (ID/EU format)
    return "ID_EU";
  } else if (lastDot > lastComma && dots === 1) {
    // Single dot at the end, likely US/UK decimal
    return "US_UK";
  } else if (dots > 1) {
    // Multiple dots = thousands separator (ID/EU)
    return "ID_EU";
  } else if (commas > 1) {
    // Multiple commas = thousands separator (US/UK)
    return "US_UK";
  }

  // Default to US/UK if ambiguous
  return cleaned.includes(".") ? "US_UK" : "PLAIN";
}

/**
 * Parse a string value into a number, handling various formats intelligently
 */
export function parseNumber(
  value: string | number | null | undefined,
  options?: ParseNumberOptions
): number {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Handle non-string inputs
  if (value === null || value === undefined || value === "") {
    return opts.defaultValue!;
  }

  if (typeof value === "number") {
    return isNaN(value) ? opts.defaultValue! : value;
  }

  let str = String(value).trim();

  // Handle percentage
  if (opts.parsePercentage && str.includes("%")) {
    str = str.replace("%", "");
    const num = parseNumber(str, { ...opts, parsePercentage: false });
    return num / 100;
  }

  // Check for negative in parentheses: (5000) -> -5000
  const isNegativeParens = str.startsWith("(") && str.endsWith(")");
  if (isNegativeParens) {
    str = str.slice(1, -1);
  }

  // Check for explicit negative sign
  const hasNegativeSign = str.startsWith("-");
  if (hasNegativeSign) {
    str = str.slice(1);
  }

  // Remove currency symbols and whitespace
  // Common currencies: Rp, IDR, $, €, £, ¥, etc.
  str = str.replace(/^[Rp$€£¥IDR\s]+/gi, "").trim();
  str = str.replace(/[Rp$€£¥IDR\s]+$/gi, "").trim();

  // Remove any remaining non-numeric characters except . , -
  const cleanedForAnalysis = str.replace(/[^\d.,\-]/g, "");

  if (cleanedForAnalysis === "") {
    return opts.defaultValue!;
  }

  // Detect format
  const format = detectFormat(cleanedForAnalysis);

  let normalized: string;

  if (format === "ID_EU") {
    // Indonesian/European: 1.234.567,89
    // Remove dots (thousands), replace comma with dot (decimal)
    normalized = cleanedForAnalysis.replace(/\./g, "").replace(",", ".");
  } else if (format === "US_UK") {
    // US/UK: 1,234,567.89
    // Remove commas (thousands), keep dot (decimal)
    normalized = cleanedForAnalysis.replace(/,/g, "");
  } else {
    // Plain number, just clean it
    normalized = cleanedForAnalysis.replace(/,/g, ".");
  }

  // Parse the normalized value
  const result = parseFloat(normalized);

  if (isNaN(result)) {
    return opts.defaultValue!;
  }

  // Apply negative sign
  const isNegative = (isNegativeParens || hasNegativeSign) && opts.allowNegative;
  return isNegative ? -Math.abs(result) : result;
}

/**
 * Parse an integer value, handling various formats
 */
export function parseInteger(
  value: string | number | null | undefined,
  options?: ParseNumberOptions
): number {
  const num = parseNumber(value, options);
  return Math.round(num);
}

/**
 * Safely parse a boolean from various string representations
 */
export function parseBoolean(value: string | boolean | null | undefined): boolean {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return false;

  const str = String(value).toLowerCase().trim();

  // True values
  if (["true", "yes", "y", "1", "ya", "benar", "aktif", "active", "on"].includes(str)) {
    return true;
  }

  // False values (explicit)
  if (["false", "no", "n", "0", "tidak", "salah", "nonaktif", "inactive", "off"].includes(str)) {
    return false;
  }

  // Default to false for unknown values
  return false;
}

/**
 * Format a number for display with thousand separators (Indonesian format)
 */
export function formatNumberID(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
