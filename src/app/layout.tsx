import type React from "react";
import { Bebas_Neue } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { ConditionalAnalytics } from "@/components/analytics/conditional-analytics";
import { MetaPixelScript } from "@/components/analytics/meta-pixel-script";
import { MetaPixelConsentBridge } from "@/components/analytics/meta-pixel-consent-bridge";
import { GoogleAnalyticsScript } from "@/components/analytics/google-analytics-script";
import { GoogleAnalyticsConsentBridge } from "@/components/analytics/google-analytics-consent-bridge";
import { WebVitalsReporter } from "@/components/analytics/web-vitals-reporter";
import { QueryProvider } from "@/components/providers/query-provider";
import { PwaProvider } from "@/components/providers/pwa-provider";
import { ChunkErrorReloader } from "@/components/providers/chunk-error-reloader";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ZOOM_BOOT_SCRIPT } from "@/lib/app-zoom";
import { Toaster } from "sonner";
import "@/app/globals.css";
import { Metadata, Viewport } from "next";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "Epidom",
  icons: {
    icon: "/favicon.ico",
    // iOS ignores the manifest's icon list entirely when adding to the home
    // screen — it reads apple-touch-icon and nothing else. Without this an
    // iPad, the primary cashier device, installs a blurry screenshot of the
    // page as its icon.
    apple: "/images/icon-192.png",
  },
  // Safari also ignores `display: standalone` from the manifest; these meta
  // tags are how an iOS home-screen launch gets a chromeless window and a
  // status bar that matches the dark theme instead of a white strip.
  // "black" is opaque and sits *above* the page, unlike "black-translucent"
  // which would draw the page under the notch — the layout only reserves
  // safe-area insets at the bottom (mobile nav), not the top.
  appleWebApp: {
    capable: true,
    title: "Epidom",
    statusBarStyle: "black",
  },
};

// Lock the viewport: no pinch-zoom / user scaling anywhere (app feel on mobile).
// viewportFit: "cover" enables env(safe-area-inset-*) used by the mobile nav.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Kept equal to the manifest's theme_color. A single value, not a
  // prefers-color-scheme pair: the app picks its own theme (ThemeProvider
  // defaults to dark) independently of the OS, so a light/dark media pair
  // would tint the browser chrome to the opposite of what is on screen for
  // anyone whose system preference disagrees with their app preference.
  themeColor: "#18181b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Applies the device's saved UI zoom before first paint, so a 70%
            or 150% preference doesn't render at 100% and snap on hydration.
            See src/lib/app-zoom.ts. */}
        <script dangerouslySetInnerHTML={{ __html: ZOOM_BOOT_SCRIPT }} />
        <MetaPixelScript />
        <MetaPixelConsentBridge />
      </head>
      <body
        className={`font-sans ${bebasNeue.variable} ${GeistSans.variable} ${GeistMono.variable}`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <ErrorBoundary>
            <QueryProvider>
              <PwaProvider />
              <ChunkErrorReloader />
              <section>
                {children}
                <ConditionalAnalytics />
                <GoogleAnalyticsScript />
                <GoogleAnalyticsConsentBridge />
                <WebVitalsReporter />
              </section>
            </QueryProvider>
          </ErrorBoundary>
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
