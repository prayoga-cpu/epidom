"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, useEffect, type ReactNode } from "react";
import { shouldPoll } from "@/lib/config/realtime.config";

/**
 * Query Provider
 *
 * Provides TanStack Query (React Query) context for data fetching,
 * caching, and state management.
 *
 * Features:
 * - Automatic caching and background refetching
 * - Request deduplication
 * - Optimistic updates
 * - Smart polling (hanya jika tab aktif & online)
 * - Real-time updates dengan tiered polling strategy
 * - DevTools for debugging (development only)
 */

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Create QueryClient inside component to ensure it's only created once
  // and maintains state across renders
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Default stale time - akan di-override oleh individual queries
            staleTime: 30 * 1000, // 30 seconds (reduced untuk real-time)

            // Time before inactive queries are garbage collected
            gcTime: 10 * 60 * 1000, // 10 minutes (increased for better cache persistence)

            // Retry failed requests
            retry: 1,

            // Smart refetch on window focus - hanya jika data stale
            refetchOnWindowFocus: true,

            // Refetch on reconnect to ensure data freshness after connection loss
            refetchOnReconnect: true,

            // Smart polling - hanya jika tab aktif dan online
            refetchInterval: (query) => {
              // Get polling interval from query meta
              const interval = query.meta?.refetchInterval as number | false | undefined;

              // Jika interval false atau undefined, tidak poll
              if (interval === false || interval === undefined) {
                return false;
              }

              // Hanya poll jika tab aktif dan online
              return shouldPoll() ? interval : false;
            },
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
          },
        },
      })
  );

  // Listen to visibility changes untuk smart polling
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Trigger refetch check when tab becomes visible
      if (document.visibilityState === "visible") {
        // TanStack Query akan otomatis check refetchInterval
        // ketika visibility berubah
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Show DevTools in development */}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
