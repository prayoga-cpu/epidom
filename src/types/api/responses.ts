/**
 * Standardized API response types
 *
 * All API endpoints should return responses conforming to these types
 * to ensure consistency across the application.
 */

// Error codes for better error handling
export enum ApiErrorCode {
  // Authentication errors (401)
  UNAUTHORIZED = "UNAUTHORIZED",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",

  // Authorization errors (403)
  FORBIDDEN = "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",

  // Validation errors (400)
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  MISSING_FIELD = "MISSING_FIELD",

  // Resource errors (404)
  NOT_FOUND = "NOT_FOUND",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  BUSINESS_NOT_FOUND = "BUSINESS_NOT_FOUND",
  STORE_NOT_FOUND = "STORE_NOT_FOUND",
  PRODUCT_NOT_FOUND = "PRODUCT_NOT_FOUND",

  // Conflict errors (409)
  CONFLICT = "CONFLICT",
  EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS",
  SKU_ALREADY_EXISTS = "SKU_ALREADY_EXISTS",

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",

  // Server errors (500)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",

  // Business logic errors (422)
  BUSINESS_LOGIC_ERROR = "BUSINESS_LOGIC_ERROR",
  INSUFFICIENT_STOCK = "INSUFFICIENT_STOCK",

  // Subscription errors (403)
  SUBSCRIPTION_LIMIT_EXCEEDED = "SUBSCRIPTION_LIMIT_EXCEEDED",
  SUBSCRIPTION_REQUIRED = "SUBSCRIPTION_REQUIRED",
  SUBSCRIPTION_INACTIVE = "SUBSCRIPTION_INACTIVE",
  SUBSCRIPTION_FEATURE_LOCKED = "SUBSCRIPTION_FEATURE_LOCKED",
}

// Error detail for validation errors
export interface ValidationError {
  field: string;
  message: string;
}

// Standard error response
export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: ValidationError[] | Record<string, unknown>;
}

// Success response (with data)
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

// Error response
export interface ApiErrorResponse {
  success: false;
  error: ApiError;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

// Union type for all API responses
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// Paginated response
export interface PaginatedData<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export type PaginatedApiResponse<T> = ApiSuccessResponse<PaginatedData<T>>;

// Helper type guards
export function isApiError(response: ApiResponse): response is ApiErrorResponse {
  return response.success === false;
}

export function isApiSuccess<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

// Helper function to create success response
export function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

// Helper function to create error response
export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  details?: ValidationError[] | Record<string, unknown>
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

// Helper function to create paginated response
export function createPaginatedResponse<T>(
  items: T[],
  page: number,
  limit: number,
  total: number
): PaginatedApiResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}
