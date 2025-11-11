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
    <div className="bg-background border-border fixed right-0 bottom-0 left-0 z-50 border-t shadow-lg animate-slide-up">
      <Container maxWidth="7xl" className="py-6">
        {!showSettings ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <p className="text-foreground mb-2 text-sm font-medium">{t("cookie.title")}</p>
              <p className="text-muted-foreground text-xs">{t("cookie.description")}</p>
              <button
                onClick={() => setShowSettings(true)}
                className="text-muted-foreground hover:text-foreground mt-2 text-xs underline"
              >
                {t("cookie.customize")}
              </button>
            </div>

            <div className="flex flex-shrink-0 items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReject}
                className="bg-transparent whitespace-nowrap"
              >
                {t("cookie.reject")}
              </Button>
              <Button size="sm" onClick={handleAccept} className="whitespace-nowrap">
                {t("cookie.accept")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-foreground mb-2 text-sm font-medium">{t("cookie.settingsTitle")}</p>
              <p className="text-muted-foreground text-xs">{t("cookie.settingsDescription")}</p>
            </div>

            <div className="space-y-3">
              {/* Essential Cookies - Always enabled */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex-1">
                  <p className="text-foreground text-sm font-medium">{t("cookie.essential.title")}</p>
                  <p className="text-muted-foreground text-xs">{t("cookie.essential.description")}</p>
                </div>
                <div className="text-muted-foreground text-sm font-medium">Always</div>
              </div>

              {/* Analytics Cookies */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex-1">
                  <p className="text-foreground text-sm font-medium">{t("cookie.analytics.title")}</p>
                  <p className="text-muted-foreground text-xs">{t("cookie.analytics.description")}</p>
                </div>
                <button
                  onClick={() => handleToggleCategory("analytics")}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    preferences?.analytics ? "bg-primary" : "bg-muted"
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
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex-1">
                  <p className="text-foreground text-sm font-medium">{t("cookie.marketing.title")}</p>
                  <p className="text-muted-foreground text-xs">{t("cookie.marketing.description")}</p>
                </div>
                <button
                  onClick={() => handleToggleCategory("marketing")}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    preferences?.marketing ? "bg-primary" : "bg-muted"
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
                className="bg-transparent whitespace-nowrap"
              >
                {t("cookie.back")}
              </Button>
              <Button size="sm" onClick={handleSaveSettings} className="whitespace-nowrap">
                {t("cookie.save")}
              </Button>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
