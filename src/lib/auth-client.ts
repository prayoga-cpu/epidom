"use client";

import { createAuthClient } from "better-auth/react";
import { useState, useEffect, useCallback, useRef } from "react";

// Create auth client for signIn, signOut, signUp operations
export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});

// Export auth operations
export const { signIn, signOut, signUp } = authClient;

// Session type matching our server-side getSession
interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionData {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  };
  user: SessionUser;
}

interface UseSessionResult {
  data: SessionData | null;
  isPending: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Custom useSession hook that uses our working /api/session endpoint
 * instead of better-auth's /api/auth/get-session
 *
 * Features:
 * - AbortController for cleanup on unmount
 * - Stale-while-revalidate pattern
 * - Error boundary friendly
 */
export function useSession(): UseSessionResult {
  const [data, setData] = useState<SessionData | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setIsPending(true);
      setError(null);

      const response = await fetch("/api/session", {
        credentials: "include",
        signal: abortControllerRef.current.signal,
        // Cache control for better performance
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        // Don't throw for auth-related errors (401, 403)
        if (response.status === 401 || response.status === 403) {
          setData(null);
          return;
        }
        throw new Error(`Session fetch failed: ${response.status}`);
      }

      const result = await response.json();

      // Handle standardized response format { success: true, data: ... }
      if (result.success && result.data) {
        setData(result.data);
      } else if (result.session && result.user) {
        // Fallback for legacy format
        setData(result);
      } else {
        // Standard response with null data, or invalid format
        setData(null);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err : new Error("Failed to fetch session"));
      setData(null);
    } finally {
      setIsPending(false);
    }
  }, []);

  useEffect(() => {
    refetch();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [refetch]);

  return {
    data,
    isPending,
    error,
    refetch,
  };
}

/**
 * Custom useUser hook that provides a simplified user interface
 */
export function useUser() {
  const { data: session, isPending } = useSession();
  return {
    user: session?.user ?? null,
    loading: isPending,
    session,
  };
}
