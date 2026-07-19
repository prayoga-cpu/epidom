import { getRequestId } from "./request-context";

/**
 * Logger Utility
 *
 * Provides structured logging for the application.
 * - Development: logs to console with formatted output
 * - Production: logs in JSON format for log aggregation services
 * - Supports request ID tracking for distributed tracing
 */

interface LogContext {
  [key: string]: unknown;
}

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

/**
 * Format log entry as JSON (for production) or readable string (for development)
 */
function formatLogEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === "production") {
    return JSON.stringify(entry);
  }

  // Development format: readable string
  const timestamp = entry.timestamp;
  const level = entry.level.toUpperCase().padEnd(5);
  const requestId = entry.requestId ? `[${entry.requestId}]` : "";
  const contextStr = entry.context ? JSON.stringify(entry.context, null, 2) : "";
  const errorStr = entry.error
    ? `\nError: ${entry.error.message}${entry.error.stack ? `\n${entry.error.stack}` : ""}`
    : "";

  return `[${timestamp}] ${level} ${requestId} ${entry.message}${contextStr ? `\n${contextStr}` : ""}${errorStr}`;
}

/**
 * Get current request ID from global context (type-safe)
 */
function getCurrentRequestId(): string | undefined {
  return getRequestId();
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "debug",
      message,
      requestId: getCurrentRequestId(),
      context,
    };

    if (process.env.NODE_ENV === "development") {
      console.debug(formatLogEntry(entry));
    }
    // In production, send to logging service if needed
  },

  info: (message: string, context?: LogContext) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      message,
      requestId: getCurrentRequestId(),
      context,
    };

    if (process.env.NODE_ENV === "development") {
      console.log(formatLogEntry(entry));
    } else {
      // In production, log as JSON
      console.log(formatLogEntry(entry));
    }
  },

  warn: (message: string, context?: LogContext) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "warn",
      message,
      requestId: getCurrentRequestId(),
      context,
    };

    if (process.env.NODE_ENV === "development") {
      console.warn(formatLogEntry(entry));
    } else {
      // In production, log as JSON
      console.warn(formatLogEntry(entry));
    }

    // Warning logged (no external service integration)
  },

  error: (message: string, error?: unknown, context?: LogContext) => {
    const errorDetails =
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : {
            message: String(error),
          };

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "error",
      message,
      requestId: getCurrentRequestId(),
      context,
      error: errorDetails,
    };

    if (process.env.NODE_ENV === "development") {
      console.error(formatLogEntry(entry));
    } else {
      // In production, log as JSON
      console.error(formatLogEntry(entry));
    }

    // Error logged (no external service integration)
  },
};
