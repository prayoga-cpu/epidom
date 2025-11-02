"use client";

/**
 * Cookie Consent Bar Component
 *
 * GDPR-compliant cookie consent notification.
 * Fixed bottom banner, shows once per user session.
 * Stores user preference in localStorage.
 *
 * @component
 */

import { useEffect, useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";

export function CookieConsentBar() {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const cookieConsent = localStorage.getItem("cookie-consent");
    if (!cookieConsent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setIsVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem("cookie-consent", "rejected");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="bg-background border-border fixed right-0 bottom-0 left-0 z-50 border-t shadow-lg">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="text-foreground mb-2 text-sm font-medium">{t("cookie.title")}</p>
            <p className="text-muted-foreground text-xs">{t("cookie.description")}</p>
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
      </div>
    </div>
  );
}
