"use client";

/**
 * Cookie Consent Bar Component
 *
 * GDPR-compliant cookie consent notification with categories.
 * Fixed bottom banner, shows once until user makes a choice.
 * Stores user preference in localStorage with categories.
 *
 * @component
 */

import { useEffect, useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Container } from "./container";
import {
  hasConsentChoice,
  acceptAllCookies,
  rejectAllCookies,
  setCookiePreferences,
  getLanguagePreference,
  type CookiePreferences,
  type Locale,
} from "@/lib/cookie-consent";

export function CookieConsentBar() {
  const { t, locale } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);

  useEffect(() => {
    // Check if user has already made a choice
    if (!hasConsentChoice()) {
      setIsVisible(true);
      // Initialize with default preferences (all false except essential)
      // Use current language from I18nProvider
      const currentLanguage = getLanguagePreference();
      setPreferences({
        essential: true,
        analytics: false,
        marketing: false,
        language: currentLanguage,
        timestamp: Date.now(),
      });
    }
  }, []);

  const handleAccept = () => {
    // Save current language preference when accepting
    acceptAllCookies(locale);
    setIsVisible(false);
    // No reload needed - ConditionalAnalytics will reactively load analytics
    // This provides better UX (no page flicker, no loss of scroll position, etc.)
  };

  const handleReject = () => {
    // Save current language preference when rejecting
    rejectAllCookies(locale);
    setIsVisible(false);
    // No reload needed - ConditionalAnalytics won't load analytics if consent is rejected
  };

  const handleSaveSettings = () => {
    if (preferences) {
      // Ensure current language is saved with preferences
      setCookiePreferences({
        ...preferences,
        language: locale,
      });
      setIsVisible(false);
      // No reload needed - ConditionalAnalytics will reactively update based on consent
      // This allows users to enable/disable analytics without losing their place on the page
    }
  };

  const handleToggleCategory = (category: "analytics" | "marketing") => {
    if (preferences) {
      setPreferences({
        ...preferences,
        [category]: !preferences[category],
        language: locale, // Keep current language
      });
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed right-0 bottom-0 left-0 z-50 border-t shadow-2xl animate-slide-up backdrop-blur-xl" style={{ background: "rgba(6,15,27,0.92)", borderColor: "rgba(255,255,255,0.08)" }}>
      <Container maxWidth="7xl" className="py-6">
        {!showSettings ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <p className="mb-2 text-sm font-medium" style={{ color: "var(--epi-cream-50)" }}>{t("cookie.title")}</p>
              <p className="text-xs" style={{ color: "rgba(251,249,228,0.55)" }}>{t("cookie.description")}</p>
              <button
                onClick={() => setShowSettings(true)}
                className="mt-2 text-xs underline hover:opacity-80"
                style={{ color: "rgba(251,249,228,0.55)" }}
              >
                {t("cookie.customize")}
              </button>
            </div>

            <div className="flex flex-shrink-0 items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReject}
                className="whitespace-nowrap"
                style={{ background: "transparent", borderColor: "rgba(255,255,255,0.18)", color: "var(--epi-cream-50)" }}
              >
                {t("cookie.reject")}
              </Button>
              <Button size="sm" onClick={handleAccept} className="whitespace-nowrap" style={{ background: "var(--epi-gold-500)", color: "var(--epi-navy-900)", border: "none" }}>
                {t("cookie.accept")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium" style={{ color: "var(--epi-cream-50)" }}>{t("cookie.settingsTitle")}</p>
              <p className="text-xs" style={{ color: "rgba(251,249,228,0.55)" }}>{t("cookie.settingsDescription")}</p>
            </div>

            <div className="space-y-3">
              {/* Essential Cookies - Always enabled */}
              <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--epi-cream-50)" }}>{t("cookie.essential.title")}</p>
                  <p className="text-xs" style={{ color: "rgba(251,249,228,0.55)" }}>{t("cookie.essential.description")}</p>
                </div>
                <div className="text-sm font-medium" style={{ color: "rgba(251,249,228,0.4)" }}>Always</div>
              </div>

              {/* Analytics Cookies */}
              <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--epi-cream-50)" }}>{t("cookie.analytics.title")}</p>
                  <p className="text-xs" style={{ color: "rgba(251,249,228,0.55)" }}>{t("cookie.analytics.description")}</p>
                </div>
                <button
                  onClick={() => handleToggleCategory("analytics")}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    preferences?.analytics ? "bg-[var(--epi-gold-500)]" : "bg-[rgba(255,255,255,0.12)]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      preferences?.analytics ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Marketing Cookies */}
              <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--epi-cream-50)" }}>{t("cookie.marketing.title")}</p>
                  <p className="text-xs" style={{ color: "rgba(251,249,228,0.55)" }}>{t("cookie.marketing.description")}</p>
                </div>
                <button
                  onClick={() => handleToggleCategory("marketing")}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    preferences?.marketing ? "bg-[var(--epi-gold-500)]" : "bg-[rgba(255,255,255,0.12)]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      preferences?.marketing ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(false)}
                className="whitespace-nowrap"
                style={{ background: "transparent", borderColor: "rgba(255,255,255,0.18)", color: "var(--epi-cream-50)" }}
              >
                {t("cookie.back")}
              </Button>
              <Button size="sm" onClick={handleSaveSettings} className="whitespace-nowrap" style={{ background: "var(--epi-gold-500)", color: "var(--epi-navy-900)", border: "none" }}>
                {t("cookie.save")}
              </Button>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
