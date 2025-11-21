/**
 * Logger Utility
 *
 * Provides structured logging for the application.
 * In development: logs to console
 * In production: can be extended to send to error tracking service (e.g., Sentry, LogRocket)
 */

interface LogContext {
  [key: string]: unknown;
}

export const logger = {
  info: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[INFO] ${message}`, context ? JSON.stringify(context, null, 2) : "");
    }
    // In production, you can send to logging service
    // Example: logService.info(message, context);
  },

  warn: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[WARN] ${message}`, context ? JSON.stringify(context, null, 2) : "");
    }
    // In production, you can send to logging service
    // Example: logService.warn(message, context);
  },

  error: (message: string, error?: unknown, context?: LogContext) => {
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    };

    if (process.env.NODE_ENV === "development") {
      console.error(`[ERROR] ${message}`, errorDetails);
    }

    // In production, send to error tracking service
    // Example: Sentry.captureException(error, { extra: { message, ...context } });
    // Example: logService.error(message, errorDetails);
  },
};
