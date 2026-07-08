/**
 * Number Input Utilities
 *
 * Helper functions for handling number inputs in forms.
 * Prevents UX issues with default value 0 that can't be easily cleared.
 */

/**
 * Convert input value to number or undefined
 * Empty string becomes undefined (better UX than 0)
 */
export function parseNumberInput(value: string): number | undefined {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Locale-aware decimal parsing — accepts either "," or "." as the decimal
 * separator (this app's only non-"." locale is French), unlike `parseFloat`
 * which stops at the first non-numeric character (`parseFloat("0,02") === 0`).
 * Strips anything else (thousand separators, stray characters), keeps the
 * LAST "," or "." typed as the decimal point.
 */
export function parseLocaleDecimal(value: string): number | undefined {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  const isNegative = value.trim().startsWith("-");
  // Keep only digits and separators to find the intended decimal point.
  const cleaned = value.replace(/[^0-9,.-]/g, "");
  const lastSeparatorIndex = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));

  let normalized: string;
  if (lastSeparatorIndex === -1) {
    normalized = cleaned.replace(/[-,.]/g, "");
  } else {
    const integerPart = cleaned.slice(0, lastSeparatorIndex).replace(/[-,.]/g, "");
    const fractionalPart = cleaned.slice(lastSeparatorIndex + 1).replace(/[-,.]/g, "");
    normalized = `${integerPart}.${fractionalPart}`;
  }

  const parsed = parseFloat((isNegative ? "-" : "") + normalized);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Format number for input display
 * undefined/null becomes empty string (allows user to clear field)
 */
export function formatNumberForInput(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "";
  }
  return value.toString();
}

/**
 * Get number value or default to 0 for API submission
 * Use this when you need to send 0 to the API instead of undefined
 */
export function getNumberValue(value: number | undefined | null, defaultValue: number = 0): number {
  if (value === undefined || value === null || isNaN(value)) {
    return defaultValue;
  }
  return value;
}

/**
 * Create onChange handler for number inputs
 * Handles empty string correctly and prevents "012" issue
 */
export function createNumberInputHandler(onChange: (value: number | undefined) => void) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string (user is clearing the field)
    if (value === "") {
      onChange(undefined);
      return;
    }
    // Parse the number
    const parsed = parseNumberInput(value);
    onChange(parsed);
  };
}
