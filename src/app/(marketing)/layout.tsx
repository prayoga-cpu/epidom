import type { Metadata } from "next";
import { headers } from "next/headers";
import { SiteHeader } from "@/features/marketing/shared/components/site-header";
import { SiteFooter } from "@/features/marketing/shared/components/site-footer";
import { Suspense } from "react";
import type { Locale } from "@/components/lang/i18n-provider";
import { SeededI18nProvider } from "@/components/lang/seeded-i18n-provider";
import { CookieConsentBar } from "@/features/marketing/shared/components/cookie-consent-bar";
import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingPage } from "@/features/loading/loading-page";
import {
  WebsiteStructuredData,
  OrganizationStructuredData,
} from "@/components/seo/structured-data";
import { LOCALE_HEADER, DEFAULT_LOCALE } from "@/lib/i18n-routing";
import { Jost, IM_Fell_French_Canon, Oswald } from "next/font/google";

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

// The light condensed face under the Bebas headline (.epi-display-light): Bebas
// Neue on Google Fonts has one weight only, Oswald is its light-weight cousin.
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["300"],
  variable: "--font-oswald",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Epidom",
  description:
    "Epidom — a menu page, online orders and a POS cashier for F&B businesses. Storefront free forever; POS with a 14-day free trial.",
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
      className={`${jost.variable} ${imFell.variable} ${oswald.variable} epidom-dark-page`}
      style={{ fontFamily: "var(--epi-font-body)" }}
    >
      <WebsiteStructuredData locale={initialLocale} />
      <OrganizationStructuredData locale={initialLocale} />
      <ErrorBoundary>
        <Suspense fallback={<LoadingPage />}>
          <SeededI18nProvider locale={initialLocale}>
            <SiteHeader />
            {/* The one <main> landmark of every marketing page: pages wrap their own
                content in a <div>, never a second <main>. */}
            <main>{children}</main>
            <SiteFooter />
            <CookieConsentBar />
          </SeededI18nProvider>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
