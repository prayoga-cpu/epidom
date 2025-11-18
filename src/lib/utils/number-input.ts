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
export function createNumberInputHandler(
  onChange: (value: number | undefined) => void
) {
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



