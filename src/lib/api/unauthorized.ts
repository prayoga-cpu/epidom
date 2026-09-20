import { ApiClientError } from "./client";

/**
 * The server said there is no live account session behind this request — never
 * signed in, expired, or revoked. That is a 401 from `requireSessionApi`, as
 * opposed to a 403 (signed in, not allowed) or a domain error.
 *
 * A hook that reads `response.status` off a bare `fetch` throws this so the page
 * can send the person to sign in, instead of parking them on a "Failed to load
 * …: Unauthorized" screen whose "Try Again" can never succeed. Only use it for
 * routes behind `withApiHandler`: elsewhere in the API a 401 can mean something
 * narrower (a bad PIN, a bad webhook signature) that must NOT log anyone out.
 */
export class UnauthorizedError extends Error {
  readonly status = 401;

  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** True for the error above, and for an `ApiClientError` that carries a 401. */
export function isUnauthorizedError(error: unknown): boolean {
  return (
    error instanceof UnauthorizedError || (error instanceof ApiClientError && error.status === 401)
  );
}
