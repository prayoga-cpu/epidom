import type { Metadata } from "next";
import { SiteHeader } from "@/features/marketing/shared/components/site-header";
import { SiteFooter } from "@/features/marketing/shared/components/site-footer";
import { Suspense } from "react";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { CookieConsentBar } from "@/features/marketing/shared/components/cookie-consent-bar";
import { ErrorBoundary } from "@/components/error-boundary";
import { LoadingPage } from "@/features/loading/loading-page";
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
  description: "Epidom — menu page, online orders, and POS cashier for F&B businesses. Free forever.",
  generator: "Next.js",
};

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${jost.variable} ${imFell.variable} epidom-dark-page`}
      style={{ fontFamily: "var(--epi-font-body)" }}
    >
      <ErrorBoundary>
        <Suspense fallback={<LoadingPage />}>
          <I18nProvider>
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
