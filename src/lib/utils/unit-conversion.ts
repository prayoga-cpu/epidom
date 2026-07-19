/**
 * Unit Conversion Utilities
 *
 * Handles conversion between different measurement units for materials and recipes.
 * Supports mass units (g, kg, mg, oz, lb) and volume units (ml, l, cl, dl).
 */

// Conversion factors to base unit (g for mass, ml for volume)
const MASS_TO_BASE: Record<string, number> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

const VOLUME_TO_BASE: Record<string, number> = {
  ml: 1,
  cl: 10,
  dl: 100,
  l: 1000,
};

// Unit type detection
const MASS_UNITS = new Set(Object.keys(MASS_TO_BASE));
const VOLUME_UNITS = new Set(Object.keys(VOLUME_TO_BASE));

/**
 * Check if a unit is a mass unit
 */
export function isMassUnit(unit: string): boolean {
  return MASS_UNITS.has(unit.toLowerCase());
}

/**
 * Check if a unit is a volume unit
 */
export function isVolumeUnit(unit: string): boolean {
  return VOLUME_UNITS.has(unit.toLowerCase());
}

/**
 * Check if two units are compatible (same type)
 */
export function areUnitsCompatible(unit1: string, unit2: string): boolean {
  const u1 = unit1.toLowerCase();
  const u2 = unit2.toLowerCase();

  // Same unit is always compatible
  if (u1 === u2) return true;

  // Both mass units
  if (isMassUnit(u1) && isMassUnit(u2)) return true;

  // Both volume units
  if (isVolumeUnit(u1) && isVolumeUnit(u2)) return true;

  return false;
}

/**
 * Convert a quantity from one unit to another
 * @param quantity - The quantity to convert
 * @param fromUnit - Source unit
 * @param toUnit - Target unit
 * @returns Converted quantity, or original quantity if units are incompatible
 */
export function convertUnit(quantity: number, fromUnit: string, toUnit: string): number {
  const from = fromUnit.toLowerCase();
  const to = toUnit.toLowerCase();

  // No conversion needed if same unit
  if (from === to) return quantity;

  // Mass conversion
  if (isMassUnit(from) && isMassUnit(to)) {
    const baseValue = quantity * MASS_TO_BASE[from];
    return baseValue / MASS_TO_BASE[to];
  }

  // Volume conversion
  if (isVolumeUnit(from) && isVolumeUnit(to)) {
    const baseValue = quantity * VOLUME_TO_BASE[from];
    return baseValue / VOLUME_TO_BASE[to];
  }

  // Incompatible units - return original
  // This handles cases like "piece", "unit", etc.
  return quantity;
}

/**
 * Convert material stock to recipe ingredient unit
 * @param materialStock - Current stock in material's unit
 * @param materialUnit - Material's unit (e.g., "kg")
 * @param ingredientUnit - Recipe ingredient's unit (e.g., "g")
 * @returns Stock converted to ingredient unit
 */
export function convertStockToIngredientUnit(
  materialStock: number,
  materialUnit: string,
  ingredientUnit: string
): number {
  return convertUnit(materialStock, materialUnit, ingredientUnit);
}

/**
 * Get display-friendly unit conversion info
 * @param quantity - Quantity in source unit
 * @param fromUnit - Source unit
 * @param toUnit - Target unit
 * @returns Object with converted value and formatted string
 */
export function getConversionInfo(
  quantity: number,
  fromUnit: string,
  toUnit: string
): {
  originalValue: number;
  originalUnit: string;
  convertedValue: number;
  convertedUnit: string;
  formatted: string;
} {
  const convertedValue = convertUnit(quantity, fromUnit, toUnit);

  return {
    originalValue: quantity,
    originalUnit: fromUnit,
    convertedValue,
    convertedUnit: toUnit,
    formatted: `${quantity} ${fromUnit} = ${convertedValue.toFixed(2)} ${toUnit}`,
  };
}

/**
 * Format quantity with appropriate decimal places based on unit
 * @param quantity - The quantity to format
 * @param unit - The unit
 * @returns Formatted string
 */
export function formatQuantityWithUnit(quantity: number, unit: string): string {
  const u = unit.toLowerCase();

  // For small units like mg, ml - use more decimal places
  if (u === "mg" || u === "ml") {
    return `${quantity.toFixed(1)} ${unit}`;
  }

  // For large units like kg, l - use fewer decimal places
  if (u === "kg" || u === "l") {
    return `${quantity.toFixed(3)} ${unit}`;
  }

  // Default: 2 decimal places
  return `${quantity.toFixed(2)} ${unit}`;
}
