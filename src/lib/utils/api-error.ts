/**
 * Extract a human-readable string from an API response/error envelope.
 *
 * Our APIs return errors as `{ success: false, error: { code, message } }`, so
 * passing `result.error` straight into `new Error()` / a toast renders the
 * useless "[object Object]". This safely pulls the string message out of the
 * common shapes: `{ error: { message } }`, `{ error: "..." }`, `{ message }`.
 */
export function getApiErrorMessage(result: unknown, fallback: string): string {
  if (result && typeof result === "object") {
    const r = result as { error?: unknown; message?: unknown };
    if (typeof r.error === "string") return r.error;
    if (r.error && typeof r.error === "object") {
      const m = (r.error as { message?: unknown }).message;
      if (typeof m === "string") return m;
    }
    if (typeof r.message === "string") return r.message;
  }
  return fallback;
}
