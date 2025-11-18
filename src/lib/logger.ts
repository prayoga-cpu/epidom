/**
 * Logger utility
 *
 * Note: Console statements removed for production.
 * In the future, integrate with error tracking service (e.g., Sentry, LogRocket).
 */
export const logger = {
  info: (message: string, ...args: unknown[]) => {
    // Logging disabled for production
    // TODO: Integrate with error tracking service
  },
  warn: (message: string, ...args: unknown[]) => {
    // Logging disabled for production
    // TODO: Integrate with error tracking service
  },
  error: (message: string, error?: unknown) => {
    // Logging disabled for production
    // TODO: Send to error tracking service (e.g., Sentry, LogRocket)
  },
};
