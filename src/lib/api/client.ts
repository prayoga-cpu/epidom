/**
 * API Client Utilities
 *
 * Centralized API client wrapper for consistent error handling.
 * Following DRY principle to avoid code duplication across hooks.
 */

import type { ApiSuccessResponse } from "@/types/api/responses";

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetch with standardized error handling
 *
 * @param url - API endpoint URL
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Promise with typed response data
 * @throws ApiError if request fails
 *
 * @example
 * const data = await fetchWithErrorHandling<MaterialsResponse>(
 *   `/api/stores/${storeId}/materials`,
 *   { method: "GET" }
 * );
 */
export async function fetchWithErrorHandling<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    let errorData: { error?: { message?: string; code?: string } } = {};
    try {
      errorData = await response.json();
    } catch {
      // If response is not JSON, use status text
      throw new ApiError(
        `Request failed with status ${response.status}`,
        response.status
      );
    }

    // Handle subscription feature locked error
    if (response.status === 403 && errorData.error?.code === "SUBSCRIPTION_FEATURE_LOCKED") {
      const error = new ApiError(
        errorData.error?.message || "This feature is only available in Pro and Enterprise plans",
        response.status,
        "SUBSCRIPTION_FEATURE_LOCKED",
        errorData
      );
      throw error;
    }

    // Handle other errors
    throw new ApiError(
      errorData.error?.message || "Request failed",
      response.status,
      errorData.error?.code,
      errorData
    );
  }

  // Parse response
  const data: ApiSuccessResponse<T> = await response.json();

  // Return data if response has success wrapper
  if (data.success && data.data !== undefined) {
    return data.data;
  }

  // If no wrapper, return data as-is (for backward compatibility)
  return data as T;
}

/**
 * Fetch JSON with error handling (for non-wrapped responses)
 *
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @returns Promise with typed response data
 * @throws ApiError if request fails
 *
 * @example
 * const data = await fetchJson<RecipesResponse>(
 *   `/api/stores/${storeId}/recipes`,
 *   { method: "GET" }
 * );
 */
export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    let errorData: { error?: { message?: string; code?: string } } = {};
    try {
      errorData = await response.json();
    } catch {
      throw new ApiError(
        `Request failed with status ${response.status}`,
        response.status
      );
    }

    const errorMessage =
      typeof errorData.error === "string"
        ? errorData.error
        : errorData.error?.message || "Request failed";

    throw new ApiError(
      errorMessage,
      response.status,
      typeof errorData.error === "object" ? errorData.error?.code : undefined,
      errorData
    );
  }

  return response.json();
}

/**
 * Simple API client for making HTTP requests
 * Wrapper around fetchWithErrorHandling for convenience
 */
export const apiClient = {
  async get<T>(url: string): Promise<T> {
    return fetchWithErrorHandling<T>(url, { method: "GET" });
  },

  async post<T>(url: string, data?: unknown): Promise<T> {
    return fetchWithErrorHandling<T>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  async put<T>(url: string, data?: unknown): Promise<T> {
    return fetchWithErrorHandling<T>(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  async patch<T>(url: string, data?: unknown): Promise<T> {
    return fetchWithErrorHandling<T>(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  async delete<T>(url: string): Promise<T> {
    return fetchWithErrorHandling<T>(url, { method: "DELETE" });
  },
};
