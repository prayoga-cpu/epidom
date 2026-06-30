/**
 * Cookie Consent Utility
 *
 * Manages user cookie consent preferences and language preference.
 * Supports GDPR-compliant cookie consent with categories.
 *
 * Cookie Categories:
 * - Essential: Always enabled (session, authentication)
 * - Analytics: Analytics cookies (Vercel Analytics, Google Analytics)
 * - Marketing: Marketing and tracking cookies (conversion tracking, advertising)
 */

export type CookieCategory = "essential" | "analytics" | "marketing";
export type Locale = "en" | "fr" | "id";

export interface CookiePreferences {
  essential: boolean; // Always true, cannot be disabled
  analytics: boolean;
  marketing: boolean;
  language: Locale; // User's preferred language
  timestamp: number;
}

const COOKIE_CONSENT_KEY = "cookie-consent-preferences";
const COOKIE_CONSENT_VERSION = "1.0.0";

/**
 * Get current cookie preferences from localStorage
 */
export function getCookiePreferences(): CookiePreferences | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) return null;

    const preferences = JSON.parse(stored) as CookiePreferences & { version?: string };

    // Check if version matches (for future migrations)
    if (preferences.version !== COOKIE_CONSENT_VERSION) {
      return null;
    }

    // Validate language
    const validLanguages: Locale[] = ["en", "fr", "id"];
    const language = preferences.language && validLanguages.includes(preferences.language)
      ? preferences.language
      : "en"; // Default to English if invalid

    return {
      essential: true, // Always true
      analytics: preferences.analytics ?? false,
      marketing: preferences.marketing ?? false,
      language: language,
      timestamp: preferences.timestamp ?? Date.now(),
    };
  } catch (error) {
    return null;
  }
}

/**
 * Save cookie preferences to localStorage
 */
export function setCookiePreferences(preferences: Partial<CookiePreferences>): void {
  if (typeof window === "undefined") return;

  try {
    const current = getCookiePreferences();

    // Validate language
    const validLanguages: Locale[] = ["en", "fr", "id"];
    const language = preferences.language && validLanguages.includes(preferences.language)
      ? preferences.language
      : current?.language ?? "en"; // Default to English or current language

    const updated: CookiePreferences & { version: string } = {
      essential: true, // Always true
      analytics: preferences.analytics ?? current?.analytics ?? false,
      marketing: preferences.marketing ?? current?.marketing ?? false,
      language: language,
      timestamp: Date.now(),
      version: COOKIE_CONSENT_VERSION,
    };

    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(updated));

    // Also update legacy locale storage for backward compatibility
    localStorage.setItem("locale", language);
    localStorage.setItem("lang", language);

    // Dispatch custom event for other parts of the app to react to consent changes
    window.dispatchEvent(
      new CustomEvent("cookie-consent-updated", {
        detail: updated,
      })
    );
  } catch (error) {
  }
}

/**
 * Check if user has given consent for a specific category
 */
export function hasConsent(category: CookieCategory): boolean {
  const preferences = getCookiePreferences();

  if (!preferences) return false;

  // Essential cookies are always allowed
  if (category === "essential") return true;

  return preferences[category] ?? false;
}

/**
 * Check if user has made a consent choice
 */
export function hasConsentChoice(): boolean {
  return getCookiePreferences() !== null;
}

/**
 * Accept all cookies (analytics + marketing)
 */
export function acceptAllCookies(language?: Locale): void {
  const current = getCookiePreferences();
  setCookiePreferences({
    essential: true,
    analytics: true,
    marketing: true,
    language: language ?? current?.language ?? "en",
  });
}

/**
 * Reject all non-essential cookies
 */
export function rejectAllCookies(language?: Locale): void {
  const current = getCookiePreferences();
  setCookiePreferences({
    essential: true,
    analytics: false,
    marketing: false,
    language: language ?? current?.language ?? "en",
  });
}

/**
 * Get user's preferred language
 */
export function getLanguagePreference(): Locale {
  const preferences = getCookiePreferences();
  if (preferences?.language) {
    return preferences.language;
  }

  // Fallback to legacy localStorage
  if (typeof window !== "undefined") {
    const legacyLocale = localStorage.getItem("locale") || localStorage.getItem("lang");
    if (legacyLocale === "en" || legacyLocale === "fr" || legacyLocale === "id") {
      return legacyLocale;
    }
  }

  // No explicit preference stored — detect from the browser's language.
  if (typeof navigator !== "undefined" && navigator.language) {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith("id")) return "id";
    if (lang.startsWith("fr")) return "fr";
    if (lang.startsWith("en")) return "en";
  }

  return "en"; // Default to English
}

/**
 * Set user's preferred language
 */
export function setLanguagePreference(language: Locale): void {
  setCookiePreferences({ language });
}

/**
 * Clear all cookie preferences (for testing/debugging)
 */
export function clearCookiePreferences(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(COOKIE_CONSENT_KEY);
  window.dispatchEvent(new CustomEvent("cookie-consent-cleared"));
}

/**
 * Get consent status for analytics
 */
export function hasAnalyticsConsent(): boolean {
  return hasConsent("analytics");
}

/**
 * Get consent status for marketing
 */
export function hasMarketingConsent(): boolean {
  return hasConsent("marketing");
}

