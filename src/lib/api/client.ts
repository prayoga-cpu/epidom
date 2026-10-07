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
 * The request never got a proper answer from our API: no connection, a
 * timeout, or something in between answered instead (a captive portal's HTML
 * page, a gateway's 502 page). Unlike `ApiClientError`, the server may or may
 * not have acted on it — a caller that retries must send the same idempotency
 * key, or the retry can repeat the write.
 */
export class ApiNetworkError extends Error {
  constructor(
    message: string,
    /** True when our own `timeoutMs` gave up waiting, not the network. */
    public readonly timedOut: boolean = false,
    /** HTTP status of a non-JSON answer, when there was one. */
    public readonly status: number | null = null
  ) {
    super(message);
    this.name = "ApiNetworkError";
  }
}

export interface ApiRequestOptions {
  /** Give up after this long and throw `ApiNetworkError` with `timedOut`. */
  timeoutMs?: number;
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
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    { timeoutMs }: ApiRequestOptions = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const controller = timeoutMs ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    const config: RequestInit = {
      ...options,
      ...(controller ? { signal: controller.signal } : {}),
      headers: {
        ...this.headers,
        ...options.headers,
      },
    };

    let response: Response;
    try {
      response = await fetch(url, config);
    } catch (error) {
      if (timer) clearTimeout(timer);
      const timedOut = controller?.signal.aborted ?? false;
      throw new ApiNetworkError(
        timedOut
          ? "Request timed out"
          : error instanceof Error
            ? error.message
            : "Network error occurred",
        timedOut
      );
    }

    try {
      let data: ApiResponse<T>;
      try {
        data = await response.json();
      } catch (error) {
        // Not our API answering: a captive portal, a gateway error page, or a
        // body cut off by the timeout above.
        throw new ApiNetworkError(
          error instanceof Error ? error.message : "Unreadable response",
          controller?.signal.aborted ?? false,
          response.status
        );
      }

      // Check if response is an error
      if (isApiError(data)) {
        throw new ApiClientError(data, response.status);
      }

      // Return the data payload
      return data.data;
    } finally {
      if (timer) clearTimeout(timer);
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
  async post<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      },
      options
    );
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
  async delete<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "/api",
});
