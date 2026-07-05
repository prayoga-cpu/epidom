import type React from "react";
import { Bebas_Neue } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { ConditionalAnalytics } from "@/components/analytics/conditional-analytics";
import { WebVitalsReporter } from "@/components/analytics/web-vitals-reporter";
import { QueryProvider } from "@/components/providers/query-provider";
import { PwaProvider } from "@/components/providers/pwa-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/providers/theme-provider";
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
  icons: {
    icon: "/favicon.ico",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className={`font-sans ${bebasNeue.variable} ${GeistSans.variable} ${GeistMono.variable}`}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <ErrorBoundary>
            <QueryProvider>
              <PwaProvider />
              <section>
                {children}
                <ConditionalAnalytics />
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
