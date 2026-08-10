"use client";

import { QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, useEffect, type ReactNode } from "react";
import { shouldPoll } from "@/lib/config/realtime.config";
import { queryPersister, isOfflinePersistedQueryKey } from "@/lib/pwa/query-persister";

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

            // Time before inactive queries are garbage collected. Must be >=
            // the persister's `maxAge` below (24h) — if a query is garbage
            // collected from memory first, it silently drops out of the next
            // IndexedDB dehydrate, defeating offline persistence for any
            // screen (e.g. POS menu) the cashier isn't currently viewing.
            gcTime: 24 * 60 * 60 * 1000,

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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        // 24h: generous enough to survive a weekend closed, short enough that
        // a long-stale menu/materials mirror doesn't linger indefinitely.
        maxAge: 24 * 60 * 60 * 1000,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            defaultShouldDehydrateQuery(query) && isOfflinePersistedQueryKey(query.queryKey),
        },
      }}
    >
      {children}
      {/* Show DevTools in development */}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </PersistQueryClientProvider>
  );
}
