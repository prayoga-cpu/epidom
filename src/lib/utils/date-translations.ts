/**
 * Date Translation Utilities
 *
 * Provides translation maps and formatting functions for chart date displays.
 * Extracted from chart component to avoid recreation on every render.
 */

type TranslationFunction = (key: string) => string;

/**
 * Creates day name translation map
 */
export function createDayMap(t: TranslationFunction): Record<string, string> {
  return {
    Mon: t("chart.days.mon"),
    Tue: t("chart.days.tue"),
    Wed: t("chart.days.wed"),
    Thu: t("chart.days.thu"),
    Fri: t("chart.days.fri"),
    Sat: t("chart.days.sat"),
    Sun: t("chart.days.sun"),
  };
}

/**
 * Creates month name translation map
 */
export function createMonthMap(t: TranslationFunction): Record<string, string> {
  return {
    Jan: t("chart.months.jan"),
    Feb: t("chart.months.feb"),
    Mar: t("chart.months.mar"),
    Apr: t("chart.months.apr"),
    May: t("chart.months.may"),
    Jun: t("chart.months.jun"),
    Jul: t("chart.months.jul"),
    Aug: t("chart.months.aug"),
    Sep: t("chart.months.sep"),
    Oct: t("chart.months.oct"),
    Nov: t("chart.months.nov"),
    Dec: t("chart.months.dec"),
  };
}

/**
 * Formats date value with translation support
 * Handles day names, month names, and week numbers
 */
export function formatDateValue(
  dateValue: string,
  t: TranslationFunction,
  dayMap: Record<string, string>,
  monthMap: Record<string, string>
): string {
  // Check if it's a day name (Mon, Tue, etc.)
  if (dayMap[dateValue]) {
    return dayMap[dateValue];
  }

  // Check if it's a month name
  if (monthMap[dateValue]) {
    return monthMap[dateValue];
  }

  // Check if it's a week format (Week 1, Week 2, etc.)
  // Support both English "Week " and translated week prefix
  const weekPrefix = t("chart.week");
  const weekPrefixEn = "Week "; // English fallback for parsing legacy data

  if (dateValue.startsWith(weekPrefixEn) || dateValue.startsWith(weekPrefix)) {
    const weekNum = dateValue.replace(weekPrefixEn, "").replace(weekPrefix, "").trim();
    return `${weekPrefix} ${weekNum}`;
  }

  // Return as is if no translation found
  return dateValue;
}
