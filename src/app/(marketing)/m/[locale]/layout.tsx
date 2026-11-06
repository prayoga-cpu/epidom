import type { Metadata } from "next";
import { SiteHeader } from "@/features/marketing/shared/components/site-header";
import { SiteFooter } from "@/features/marketing/shared/components/site-footer";
import { Suspense } from "react";
import Script from "next/script";
import type { Locale } from "@/components/lang/i18n-provider";
import { SeededI18nProvider } from "@/components/lang/seeded-i18n-provider";
import { CookieConsentBar } from "@/features/marketing/shared/components/cookie-consent-bar";
import { ReferralBanner } from "@/features/referrals/components/referral-banner";
import { RevealRoot } from "@/features/marketing/shared/components/reveal-root";
import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingPage } from "@/features/loading/loading-page";
import {
  WebsiteStructuredData,
  OrganizationStructuredData,
} from "@/components/seo/structured-data";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/i18n-routing";
import { Inter, Instrument_Serif } from "next/font/google";

/**
 * The marketing site's two typefaces (the type rules are in globals.css,
 * "Marketing typography"): Inter for everything, headings included, as one
 * variable file with its optical-size axis, so large headings get Inter's
 * display cut; Instrument Serif for the few warm accent words (.epi-script,
 * the hero tagline). latin-ext for French and Indonesian. The app and the
 * storefronts keep their own fonts: these are scoped to .epidom-dark-page.
 */
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
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
      className={`${inter.variable} ${instrumentSerif.variable} epidom-dark-page overflow-x-clip`}
      style={{ fontFamily: "var(--epi-font-body)" }}
    >
      {/* Sets <html lang> (the root layout can't). next/script, not a raw <script>:
          React 19 warns on a script tag rendered in a client component. The
          wrapper div above already carries lang for the content itself. */}
      <Script id="set-html-lang" strategy="afterInteractive">
        {`document.documentElement.lang=${JSON.stringify(initialLocale)}`}
      </Script>
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
            {/* Scroll reveal for every [data-reveal] element (see reveal-root.tsx). */}
            <RevealRoot />
          </SeededI18nProvider>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
