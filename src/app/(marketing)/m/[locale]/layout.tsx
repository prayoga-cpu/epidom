import type { Metadata } from "next";
import { SiteHeader } from "@/features/marketing/shared/components/site-header";
import { SiteFooter } from "@/features/marketing/shared/components/site-footer";
import { Suspense } from "react";
import type { Locale } from "@/components/lang/i18n-provider";
import { SeededI18nProvider } from "@/components/lang/seeded-i18n-provider";
import { CookieConsentBar } from "@/features/marketing/shared/components/cookie-consent-bar";
import { ReferralBanner } from "@/features/referrals/components/referral-banner";
import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingPage } from "@/features/loading/loading-page";
import {
  WebsiteStructuredData,
  OrganizationStructuredData,
} from "@/components/seo/structured-data";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/i18n-routing";
import { Jost, IM_Fell_French_Canon, Oswald } from "next/font/google";

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});

// Italic only: its one user, `.epi-script` (globals.css), is always italic, and
// every face listed here is preloaded on every marketing page.
const imFell = IM_Fell_French_Canon({
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
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

/**
 * The three site languages, prerendered. The proxy rewrites every public
 * marketing URL to this segment (`/pricing` → `/m/fr/pricing`, `/id/pricing`
 * → `/m/id/pricing`), so the language comes from the path, not a request
 * header, and every marketing page can be static (served from the CDN)
 * instead of rendered on each request. `/m/*` itself is never a public URL:
 * the proxy sends direct visits to the real address.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const dynamicParams = false;

function toLocale(value: string): Locale {
  return (LOCALES as readonly string[]).includes(value) ? (value as Locale) : DEFAULT_LOCALE;
}

export default async function LandingLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const initialLocale = toLocale((await params).locale);

  return (
    <div
      lang={initialLocale}
      className={`${jost.variable} ${imFell.variable} ${oswald.variable} epidom-dark-page`}
      style={{ fontFamily: "var(--epi-font-body)" }}
    >
      {/* Sets <html lang> while the page parses (the root layout can't). */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang=${JSON.stringify(initialLocale)}`,
        }}
      />
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
            {/* "Bob's referral: 10% off" for a visitor who came through a partner's link. */}
            <ReferralBanner />
          </SeededI18nProvider>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
