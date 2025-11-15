"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";

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
            // Time before data is considered stale (increased for better caching)
            // Dashboard data doesn't change frequently, so we can cache longer
            staleTime: 2 * 60 * 1000, // 2 minutes (optimized for dashboard)

            // Time before inactive queries are garbage collected
            gcTime: 10 * 60 * 1000, // 10 minutes (increased for better cache persistence)

            // Retry failed requests
            retry: 1,

            // Refetch on window focus disabled to avoid unnecessary requests
            refetchOnWindowFocus: false,

            // Refetch on reconnect to ensure data freshness after connection loss
            refetchOnReconnect: true,
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
          },
        },
      })
  );

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
