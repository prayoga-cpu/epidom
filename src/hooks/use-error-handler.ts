/**
 * useErrorHandler Hook
 *
 * Provides consistent error handling for TanStack Query mutations and queries.
 * Automatically shows user-friendly error messages via toast notifications.
 */

import { useCallback } from "react";
import { showErrorToast, handleApiError, getUserFriendlyErrorMessage } from "@/lib/utils/error-handler";
import { toast } from "@/hooks/use-toast";

/**
 * Hook for handling errors consistently across the application
 *
 * @example
 * ```tsx
 * const { handleError } = useErrorHandler();
 *
 * const mutation = useMutation({
 *   mutationFn: async (data) => {
 *     const response = await fetch('/api/endpoint', {
 *       method: 'POST',
 *       body: JSON.stringify(data),
 *     });
 *     if (!response.ok) {
 *       const error = await response.json();
 *       throw error;
 *     }
 *     return response.json();
 *   },
 *   onError: handleError,
 * });
 * ```
 */
export function useErrorHandler() {
  /**
   * Handle error and show user-friendly toast notification
   */
  const handleError = useCallback((error: unknown, customTitle?: string) => {
    showErrorToast(error, customTitle);
  }, []);

  /**
   * Handle error and return error details (without showing toast)
   * Useful when you want to handle the error display yourself
   */
  const getErrorDetails = useCallback((error: unknown) => {
    return handleApiError(error);
  }, []);

  /**
   * Get user-friendly error message without showing toast
   */
  const getErrorMessage = useCallback((error: unknown): string => {
    return getUserFriendlyErrorMessage(error);
  }, []);

  /**
   * Show success toast
   */
  const showSuccess = useCallback((message: string, title?: string) => {
    toast({
      variant: "default",
      title: title || "Success",
      description: message,
    });
  }, []);

  return {
    handleError,
    getErrorDetails,
    getErrorMessage,
    showSuccess,
  };
}

