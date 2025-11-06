import type React from "react";

import { Analytics } from "@vercel/analytics/next";
import { SessionProvider } from "@/components/providers/session-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "sonner";

import "@/app/globals.css";
import { Metadata } from "next";

export const metadata: Metadata = {
  icons: {
    icon: "./favicon.ico",
  },
};

/**
 * Root Layout
 *
 * Wraps the entire application with global providers:
 * - ErrorBoundary: Catches and handles errors gracefully
 * - QueryProvider: TanStack Query for data fetching and caching
 * - SessionProvider: NextAuth session management
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <ErrorBoundary>
          <QueryProvider>
            <SessionProvider>
              <section>
                {children}
                <Analytics />
              </section>
            </SessionProvider>
          </QueryProvider>
        </ErrorBoundary>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
