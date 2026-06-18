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
import { Metadata } from "next";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`font-sans ${bebasNeue.variable} ${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
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
