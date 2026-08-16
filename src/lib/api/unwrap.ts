/**
 * Response-envelope helpers for client-side fetches.
 *
 * Every API route answers through `createSuccessResponse` / `createErrorResponse`
 * (`src/types/api/responses.ts`), which wrap the real payload:
 *
 *   success -> { success: true,  data:  <payload>,          meta: { timestamp } }
 *   failure -> { success: false, error: { code, message },  meta: { timestamp } }
 *
 * `withApiHandler` returns the handler's Response verbatim, so that envelope is
 * what reaches the browser. Client code that does `return response.json()` and
 * then reads `data.<key>` gets `undefined`, because the payload is one level
 * deeper — a failure mode that renders as a permanently empty list rather than
 * an error, which is why several of these survived so long unnoticed.
 *
 * Both helpers are deliberately TOLERANT: a payload that isn't enveloped passes
 * through untouched. That matters because not every route wraps (some return
 * bare `NextResponse.json({...})`), and because server-rendered `initialData` is
 * built directly and never enveloped. So these are safe to apply at a call site
 * without first auditing the route, and they stay correct if a route changes.
 */

/** Payload of a successful response, whether or not it arrived enveloped. */
export function unwrapApiData<T>(payload: unknown): T {
  const body = payload as { success?: boolean; data?: T } | null | undefined;
  return body?.success === true && body.data !== undefined ? body.data : (payload as T);
}

/**
 * `code` / `message` of a failed response, read from either the enveloped shape
 * or a bare `{ code, message }`. Reading `body.code` directly is what made the
 * `SUBSCRIPTION_FEATURE_LOCKED` checks silently never match, so callers got a
 * generic failure instead of the upgrade prompt.
 */
export function unwrapApiError(payload: unknown): { code?: string; message?: string } {
  const body = payload as
    | {
        code?: string;
        message?: string;
        error?: { code?: string; message?: string } | string;
      }
    | null
    | undefined;

  // Some older routes put a plain string in `error`.
  if (typeof body?.error === "string") {
    return { code: body.code, message: body.error };
  }

  return {
    code: body?.error?.code ?? body?.code,
    message: body?.error?.message ?? body?.message,
  };
}
