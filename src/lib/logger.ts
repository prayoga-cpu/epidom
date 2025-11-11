export const logger = {
  info: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV === "development") {
      console.log(message, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV === "development") {
      console.warn(message, ...args);
    }
  },
  error: (message: string, error?: unknown) => {
    if (process.env.NODE_ENV === "development") {
      console.error(message, error);
    }
    // TODO: Send to error tracking service in production
  },
};
