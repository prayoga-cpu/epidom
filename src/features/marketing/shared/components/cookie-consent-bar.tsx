"use client";

/**
 * Cookie Consent Bar Component
 *
 * GDPR-compliant cookie consent notification with categories.
 * Fixed bottom banner, shows until the visitor makes a choice, and again whenever
 * they reopen it from the footer's "Manage cookies" button (COOKIE_CONSENT_OPEN_EVENT),
 * which lands on the settings view with the toggles set to the saved choice, so
 * withdrawing is possible at any time.
 * Stores user preference in localStorage with categories.
 *
 * @component
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { getLocalizedPath } from "@/lib/i18n-routing";
import { Container } from "./container";
import {
  COOKIE_CONSENT_OPEN_EVENT,
  hasConsentChoice,
  getCookiePreferences,
  acceptAllCookies,
  rejectAllCookies,
  setCookiePreferences,
  getLanguagePreference,
  type CookiePreferences,
} from "@/lib/cookie-consent";

function defaultPreferences(): CookiePreferences {
  return {
    essential: true,
    analytics: false,
    marketing: false,
    language: getLanguagePreference(),
    timestamp: Date.now(),
  };
}

/** A real switch: 44px hit area around the 24px track, state exposed to assistive tech. */
function ConsentSwitch({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="flex h-11 w-14 flex-shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--epi-gold-500)]"
    >
      <span
        aria-hidden="true"
        className={`relative block h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-[var(--epi-gold-500)]" : "bg-[rgba(255,255,255,0.12)]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

export function CookieConsentBar() {
  const { t, locale } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);
  // True once a choice is saved: only then can the bar be dismissed unchanged.
  const [hasSavedChoice, setHasSavedChoice] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // Bumped each time the footer button reopens the bar, so focus can move in, and back out on close.
  const [openCount, setOpenCount] = useState(0);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // First visit (no saved choice): show the bar with everything off.
    if (!hasConsentChoice()) {
      setIsVisible(true);
      setPreferences(defaultPreferences());
    }

    // "Manage cookies" in the footer: reopen on the settings view, toggles = saved choice.
    const handleOpen = () => {
      const saved = getCookiePreferences();
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpenCount((n) => n + 1);
      setPreferences(saved ?? defaultPreferences());
      setHasSavedChoice(saved !== null);
      setShowSettings(true);
      setIsVisible(true);
    };

    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, handleOpen);
  }, []);

  // Keyboard users: land inside the reopened bar instead of staying behind it in the footer.
  useEffect(() => {
    if (openCount > 0) panelRef.current?.focus();
  }, [openCount]);

  const hide = () => {
    setIsVisible(false);
    returnFocusRef.current?.focus();
    returnFocusRef.current = null;
  };

  // A reopened bar can be dismissed with Escape, leaving the saved choice untouched.
  useEffect(() => {
    if (!isVisible || !hasSavedChoice) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isVisible, hasSavedChoice]);

  const handleAccept = () => {
    // Save current language preference when accepting
    acceptAllCookies(locale);
    hide();
    // No reload needed: the consent bridges load the vendors reactively on the
    // "cookie-consent-updated" event this dispatches.
  };

  const handleReject = () => {
    // Save current language preference when rejecting
    rejectAllCookies(locale);
    hide();
    // No reload needed: the bridges switch tracking off and clear its cookies.
  };

  const handleSaveSettings = () => {
    if (preferences) {
      // Ensure current language is saved with preferences
      setCookiePreferences({
        ...preferences,
        language: locale,
      });
      hide();
      // No reload needed: enabling and withdrawing both take effect immediately.
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

  // The description names what Accept switches on (analytics and advertising
  // measurement); the policy is where the detail lives, so it is one tap away in
  // both views. min-h-11 = the 44px touch target, like Customize.
  const policyLink = (
    <Link
      href={getLocalizedPath("/cookie-policy", locale)}
      className="inline-flex min-h-11 items-center px-2 text-xs underline hover:opacity-80"
      style={{ color: "rgba(251,249,228,0.55)" }}
    >
      {t("footer.linkCookies")}
    </Link>
  );

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={showSettings ? t("cookie.settingsTitle") : t("cookie.title")}
      tabIndex={-1}
      className="animate-slide-up fixed right-0 bottom-0 left-0 z-50 max-h-[calc(90dvh/var(--app-zoom,1))] overflow-y-auto border-t shadow-2xl backdrop-blur-xl outline-none"
      style={{ background: "rgba(6,15,27,0.92)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      <Container maxWidth="7xl" className="relative py-6">
        {hasSavedChoice && (
          <button
            type="button"
            onClick={hide}
            aria-label={t("cookie.close")}
            className="absolute top-1 right-0 flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-[var(--epi-gold-500)]"
            style={{ color: "rgba(251,249,228,0.55)" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
        {!showSettings ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className={`flex-1 ${hasSavedChoice ? "pr-10" : ""}`}>
              <p className="mb-2 text-sm font-medium" style={{ color: "var(--epi-cream-50)" }}>
                {t("cookie.title")}
              </p>
              <p className="text-xs" style={{ color: "rgba(251,249,228,0.55)" }}>
                {t("cookie.description")}
              </p>
              <div className="mt-1 -ml-2 flex flex-wrap items-center gap-x-1">
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="inline-flex min-h-11 items-center px-2 text-xs underline hover:opacity-80"
                  style={{ color: "rgba(251,249,228,0.55)" }}
                >
                  {t("cookie.customize")}
                </button>
                {policyLink}
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReject}
                className="h-11 px-5 whitespace-nowrap"
                style={{
                  background: "transparent",
                  borderColor: "rgba(255,255,255,0.18)",
                  color: "var(--epi-cream-50)",
                }}
              >
                {t("cookie.reject")}
              </Button>
              <Button
                size="sm"
                onClick={handleAccept}
                className="h-11 px-5 whitespace-nowrap"
                style={{
                  background: "var(--epi-gold-500)",
                  color: "var(--epi-navy-900)",
                  border: "none",
                }}
              >
                {t("cookie.accept")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={hasSavedChoice ? "pr-10" : ""}>
              <p className="mb-2 text-sm font-medium" style={{ color: "var(--epi-cream-50)" }}>
                {t("cookie.settingsTitle")}
              </p>
              <p className="text-xs" style={{ color: "rgba(251,249,228,0.55)" }}>
                {t("cookie.settingsDescription")}
              </p>
              <div className="mt-1 -ml-2">{policyLink}</div>
            </div>

            <div className="space-y-3">
              {/* Essential Cookies - Always enabled */}
              <div
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--epi-cream-50)" }}>
                    {t("cookie.essential.title")}
                  </p>
                  <p className="text-xs" style={{ color: "rgba(251,249,228,0.55)" }}>
                    {t("cookie.essential.description")}
                  </p>
                </div>
                <div
                  className="text-sm font-medium whitespace-nowrap"
                  style={{ color: "rgba(251,249,228,0.4)" }}
                >
                  {t("cookie.always")}
                </div>
              </div>

              {/* Analytics Cookies */}
              <div
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--epi-cream-50)" }}>
                    {t("cookie.analytics.title")}
                  </p>
                  <p className="text-xs" style={{ color: "rgba(251,249,228,0.55)" }}>
                    {t("cookie.analytics.description")}
                  </p>
                </div>
                <ConsentSwitch
                  checked={!!preferences?.analytics}
                  label={t("cookie.analytics.title")}
                  onToggle={() => handleToggleCategory("analytics")}
                />
              </div>

              {/* Marketing Cookies */}
              <div
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--epi-cream-50)" }}>
                    {t("cookie.marketing.title")}
                  </p>
                  <p className="text-xs" style={{ color: "rgba(251,249,228,0.55)" }}>
                    {t("cookie.marketing.description")}
                  </p>
                </div>
                <ConsentSwitch
                  checked={!!preferences?.marketing}
                  label={t("cookie.marketing.title")}
                  onToggle={() => handleToggleCategory("marketing")}
                />
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(false)}
                className="h-11 px-5 whitespace-nowrap"
                style={{
                  background: "transparent",
                  borderColor: "rgba(255,255,255,0.18)",
                  color: "var(--epi-cream-50)",
                }}
              >
                {t("cookie.back")}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveSettings}
                className="h-11 px-5 whitespace-nowrap"
                style={{
                  background: "var(--epi-gold-500)",
                  color: "var(--epi-navy-900)",
                  border: "none",
                }}
              >
                {t("cookie.save")}
              </Button>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
