import type { Metadata } from "next";
import { headers } from "next/headers";
import { SiteHeader } from "@/features/marketing/shared/components/site-header";
import { SiteFooter } from "@/features/marketing/shared/components/site-footer";
import { Suspense } from "react";
import { I18nProvider, type Locale } from "@/components/lang/i18n-provider";
import { CookieConsentBar } from "@/features/marketing/shared/components/cookie-consent-bar";
import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingPage } from "@/features/loading/loading-page";
import {
  WebsiteStructuredData,
  OrganizationStructuredData,
} from "@/components/seo/structured-data";
import { LOCALE_HEADER, DEFAULT_LOCALE } from "@/lib/i18n-routing";
import { Jost, IM_Fell_French_Canon } from "next/font/google";

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});

const imFell = IM_Fell_French_Canon({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-im-fell",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Epidom",
  description:
    "Epidom — menu page, online orders, and POS cashier for F&B businesses. Free forever.",
  generator: "Next.js",
};

export default async function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Set by src/middleware.ts from the URL (/, /id/*, /en/*) — falls back to
  // the default locale for any request middleware didn't intercept (e.g.
  // static export edge cases), never to the client's "en" default.
  const headersList = await headers();
  const initialLocale = (headersList.get(LOCALE_HEADER) as Locale | null) ?? DEFAULT_LOCALE;

  return (
    <div
      className={`${jost.variable} ${imFell.variable} epidom-dark-page`}
      style={{ fontFamily: "var(--epi-font-body)" }}
    >
      <WebsiteStructuredData />
      <OrganizationStructuredData />
      <ErrorBoundary>
        <Suspense fallback={<LoadingPage />}>
          <I18nProvider initialLocale={initialLocale}>
            <SiteHeader />
            <main>{children}</main>
            <SiteFooter />
            <CookieConsentBar />
          </I18nProvider>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
