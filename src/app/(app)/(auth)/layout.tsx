import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { geistMono } from "@/lib/fonts";
import { ConditionalAnalytics } from "@/components/analytics/conditional-analytics";
import { Suspense } from "react";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { SessionProvider } from "@/components/providers/session-provider";
import { LoadingPage } from "@/features/loading/loading-page";
import { CookieConsentBar } from "@/features/marketing/shared/components/cookie-consent-bar";
import { ReferralBanner } from "@/features/referrals/components/referral-banner";

export const metadata: Metadata = {
  title: "Epidom — Log In",
  description: "Log in to your Epidom dashboard to manage your store, orders, and menu.",
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`font-sans ${GeistSans.variable} ${geistMono.variable}`}>
      <ErrorBoundary>
        <Suspense fallback={<LoadingPage />}>
          <SessionProvider>
            <I18nProvider>
              {children}
              {/* Visitors from an ad or a sales page can land here first: without the
                  bar they could never allow the pixel, and their sign-up would never
                  reach Meta. Shown once per browser, like on the marketing site. */}
              <CookieConsentBar />
              {/* "Bob's referral: 10% off" for a visitor who came through a partner's link. */}
              <ReferralBanner />
            </I18nProvider>
          </SessionProvider>
        </Suspense>
      </ErrorBoundary>
      <ConditionalAnalytics />
    </div>
  );
}
