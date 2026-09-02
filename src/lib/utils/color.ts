/**
 * Converts a hex color to a premium, clamped version.
 * - Caps saturation at 80% to avoid neon AI slop.
 * - Ensures lightness is at least 15% to avoid pure black.
 * - Ensures lightness is at most 90% to avoid pure white.
 */

// Simple hex to HSL and back converter
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  // Remove #
  hex = hex.replace(/^#/, "");

  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  let h = 0,
    s = 0,
    l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function HSLToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  const rHex = Math.round((r + m) * 255)
    .toString(16)
    .padStart(2, "0");
  const gHex = Math.round((g + m) * 255)
    .toString(16)
    .padStart(2, "0");
  const bHex = Math.round((b + m) * 255)
    .toString(16)
    .padStart(2, "0");

  return `#${rHex}${gHex}${bHex}`.toUpperCase();
}

export function getPremiumTheme(hex: string): string {
  try {
    const { h, s, l } = hexToHSL(hex);

    // Clamp saturation to 80%
    const newS = Math.min(s, 80);

    // Clamp lightness between 15% and 85%
    const newL = Math.max(15, Math.min(l, 85));

    return HSLToHex(h, newS, newL);
  } catch (e) {
    // Fallback if parsing fails
    return "#FF6B35";
  }
}

/** sRGB channel → linear light, per the WCAG relative-luminance definition. */
function srgbToLinear(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/**
 * WCAG relative luminance of a hex color: 0 (black) → 1 (white).
 * Returns 0 for anything unparseable, so callers fall back to treating it as
 * a dark background (light text) rather than throwing.
 */
export function getLuminance(hex: string): number {
  const normalized = hex.replace(/^#/, "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return 0;

  const r = parseInt(full.substring(0, 2), 16) / 255;
  const g = parseInt(full.substring(2, 4), 16) / 255;
  const b = parseInt(full.substring(4, 6), 16) / 255;

  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/**
 * Readable text/ink color to sit on top of `hex` — white on a dark ground,
 * near-black on a light one. Needed wherever a store's own themeColor paints
 * a large surface: getPremiumTheme() clamps lightness up to 85%, so a pale
 * brand color would leave hardcoded white text unreadable.
 */
export function getContrastingInk(hex: string): string {
  return getLuminance(hex) > 0.45 ? "#141210" : "#FFFFFF";
}
