/**
 * Error Handling Utilities
 *
 * Provides consistent error handling and user-friendly error messages
 * across the entire dashboard application.
 */

import { ApiErrorCode, ApiErrorResponse, ApiResponse, isApiError } from "@/types/api/responses";
import { toast } from "@/hooks/use-toast";

/**
 * User-friendly error messages for each error code
 */
const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  // Authentication errors
  [ApiErrorCode.UNAUTHORIZED]: "You need to sign in to continue",
  [ApiErrorCode.INVALID_CREDENTIALS]: "Invalid email or password. Please try again.",
  [ApiErrorCode.TOKEN_EXPIRED]: "Your session has expired. Please sign in again.",

  // Authorization errors
  [ApiErrorCode.FORBIDDEN]: "You don't have permission to perform this action.",
  [ApiErrorCode.INSUFFICIENT_PERMISSIONS]: "You don't have the required permissions.",

  // Validation errors
  [ApiErrorCode.VALIDATION_ERROR]: "Please check your input and try again.",
  [ApiErrorCode.INVALID_INPUT]: "The information you entered is invalid.",
  [ApiErrorCode.MISSING_FIELD]: "Please fill in all required fields.",

  // Resource errors
  [ApiErrorCode.NOT_FOUND]: "The requested resource was not found.",
  [ApiErrorCode.USER_NOT_FOUND]: "User not found.",
  [ApiErrorCode.BUSINESS_NOT_FOUND]: "Business information not found.",
  [ApiErrorCode.STORE_NOT_FOUND]: "Store not found.",
  [ApiErrorCode.PRODUCT_NOT_FOUND]: "Product not found.",

  // Conflict errors
  [ApiErrorCode.CONFLICT]: "This action conflicts with existing data.",
  [ApiErrorCode.EMAIL_ALREADY_EXISTS]: "This email is already registered.",
  [ApiErrorCode.SKU_ALREADY_EXISTS]: "This SKU already exists. Please use a different SKU.",

  // Rate limiting
  [ApiErrorCode.RATE_LIMIT_EXCEEDED]: "Too many requests. Please wait a moment and try again.",

  // Server errors
  [ApiErrorCode.INTERNAL_ERROR]: "Something went wrong. Please try again later.",
  [ApiErrorCode.DATABASE_ERROR]: "Database error occurred. Please try again.",

  // Business logic errors
  [ApiErrorCode.BUSINESS_LOGIC_ERROR]: "Unable to complete this action.",
  [ApiErrorCode.INSUFFICIENT_STOCK]: "Insufficient stock available.",

  // Subscription errors
  [ApiErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED]: "You've reached your plan limit. Please upgrade to continue.",
  [ApiErrorCode.SUBSCRIPTION_REQUIRED]: "A subscription is required to use this feature.",
  [ApiErrorCode.SUBSCRIPTION_INACTIVE]: "Your subscription is inactive. Please renew to continue.",
  [ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED]: "This feature is not available in your current plan. Please upgrade to access it.",
};

/**
 * Extract error message from various error types
 */
export function extractErrorMessage(error: unknown): string {
  // Handle API error response
  if (error && typeof error === "object" && "success" in error && isApiError(error as ApiResponse)) {
    const apiError = error as ApiErrorResponse;
    return apiError.error.message || ERROR_MESSAGES[apiError.error.code] || "An error occurred";
  }

  // Handle Error object
  if (error instanceof Error) {
    return error.message;
  }

  // Handle string errors
  if (typeof error === "string") {
    return error;
  }

  // Handle fetch Response errors
  if (error instanceof Response) {
    return `Request failed with status ${error.status}`;
  }

  // Default fallback
  return "An unexpected error occurred. Please try again.";
}

/**
 * Extract error code from various error types
 */
export function extractErrorCode(error: unknown): ApiErrorCode | null {
  if (error && typeof error === "object" && "success" in error && isApiError(error as ApiResponse)) {
    const apiError = error as ApiErrorResponse;
    return apiError.error.code;
  }

  // Try to extract from error object
  if (error instanceof Error && "code" in error) {
    const code = (error as { code: string }).code;
    if (Object.values(ApiErrorCode).includes(code as ApiErrorCode)) {
      return code as ApiErrorCode;
    }
  }

  return null;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  const errorCode = extractErrorCode(error);

  if (errorCode && ERROR_MESSAGES[errorCode]) {
    return ERROR_MESSAGES[errorCode];
  }

  // Try to get message from error
  const message = extractErrorMessage(error);

  // If message is too technical, use generic message
  if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND")) {
    return "Unable to connect to the server. Please check your internet connection.";
  }

  if (message.includes("timeout") || message.includes("TIMEOUT")) {
    return "The request took too long. Please try again.";
  }

  if (message.includes("NetworkError") || message.includes("Failed to fetch")) {
    return "Network error. Please check your connection and try again.";
  }

  return message;
}

/**
 * Check if error is a validation error with field details
 */
export function isValidationError(error: unknown): error is ApiErrorResponse & {
  error: { details: Array<{ field: string; message: string }> };
} {
  if (!error || typeof error !== "object" || !("success" in error)) return false;
  if (!isApiError(error as ApiResponse)) return false;

  const apiError = error as ApiErrorResponse;
  return (
    apiError.error.code === ApiErrorCode.VALIDATION_ERROR &&
    Array.isArray(apiError.error.details) &&
    apiError.error.details.length > 0
  );
}

/**
 * Get validation errors by field
 */
export function getValidationErrors(error: unknown): Record<string, string> {
  if (!isValidationError(error)) {
    return {};
  }

  const errors: Record<string, string> = {};
  const apiError = error as ApiErrorResponse & {
    error: { details: Array<{ field: string; message: string }> };
  };
  apiError.error.details.forEach((detail) => {
    errors[detail.field] = detail.message;
  });

  return errors;
}

/**
 * Show error toast notification
 */
export function showErrorToast(error: unknown, customTitle?: string) {
  const message = getUserFriendlyErrorMessage(error);
  const errorCode = extractErrorCode(error);

  toast({
    variant: "destructive",
    title: customTitle || "Error",
    description: message,
  });

  // Log error for debugging (only in development)
  if (process.env.NODE_ENV === "development") {
  }
}

/**
 * Handle API error response
 */
export function handleApiError(error: unknown): {
  message: string;
  code: ApiErrorCode | null;
  isValidationError: boolean;
  validationErrors: Record<string, string>;
} {
  const message = getUserFriendlyErrorMessage(error);
  const code = extractErrorCode(error);
  const isValidation = isValidationError(error);
  const validationErrors = getValidationErrors(error);

  return {
    message,
    code,
    isValidationError: isValidation,
    validationErrors,
  };
}

