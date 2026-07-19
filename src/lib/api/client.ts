import { ApiResponse, ApiErrorResponse, isApiError } from "@/types/api";

/**
 * API Client Configuration
 */
interface ApiClientConfig {
  baseURL?: string;
  headers?: Record<string, string>;
}

/**
 * API Client Error
 *
 * Custom error class that wraps API error responses
 */
export class ApiClientError extends Error {
  constructor(
    public readonly response: ApiErrorResponse,
    public readonly status: number
  ) {
    super(response.error.message);
    this.name = "ApiClientError";
  }
}

/**
 * Base API Client
 *
 * Provides type-safe HTTP methods for making API calls.
 * Handles request/response transformation and error handling.
 *
 * Benefits:
 * - Type-safe API calls
 * - Centralized error handling
 * - Request/response interceptors
 * - Consistent API interface
 */
export class ApiClient {
  private baseURL: string;
  private headers: Record<string, string>;

  constructor(config: ApiClientConfig = {}) {
    this.baseURL = config.baseURL ?? "";
    this.headers = {
      "Content-Type": "application/json",
      ...config.headers,
    };
  }

  /**
   * Set authorization header
   */
  setAuthToken(token: string): void {
    this.headers["Authorization"] = `Bearer ${token}`;
  }

  /**
   * Remove authorization header
   */
  clearAuthToken(): void {
    delete this.headers["Authorization"];
  }

  /**
   * Make HTTP request
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const data: ApiResponse<T> = await response.json();

      // Check if response is an error
      if (isApiError(data)) {
        throw new ApiClientError(data, response.status);
      }

      // Return the data payload
      return data.data;
    } catch (error) {
      // If it's already an ApiClientError, rethrow it
      if (error instanceof ApiClientError) {
        throw error;
      }

      // Handle network errors or JSON parsing errors
      throw new Error(error instanceof Error ? error.message : "Network error occurred");
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return this.request<T>(`${endpoint}${query}`, {
      method: "GET",
    });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "/api",
});
