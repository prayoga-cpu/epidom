"use client";
import { PlaceholderPage, PlaceholderSection } from "@/features/marketing/shared/components/placeholder-page";
export function CookiePolicyClient() {
  return (
    <PlaceholderPage
      eyebrow="Cookie Policy"
      title="Cookies we use and why."
      body="We use cookies sparingly. This page lists every cookie Epidom sets, its purpose, and how long it lives in your browser."
    >
      <PlaceholderSection
        title="Essential cookies"
        items={[
          "session — keeps you logged in; expires when you close the browser",
          "csrf_token — prevents cross-site request forgery; session-scoped",
          "locale — remembers your language preference; 1 year",
        ]}
      />
      <PlaceholderSection
        title="Analytics cookies (with consent)"
        items={[
          "We use anonymised, self-hosted analytics — no third-party trackers",
          "You can opt out at any time from Settings → Privacy",
        ]}
      />
      <PlaceholderSection
        title="Third-party cookies"
        items={[
          "Stripe may set cookies on payment pages — see stripe.com/privacy",
          "No advertising or social-media tracking cookies are used",
        ]}
      />
    </PlaceholderPage>
  );
}
