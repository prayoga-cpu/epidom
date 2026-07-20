import type { UseFormReturn } from "react-hook-form";
import { ApiClientError } from "@/lib/api/client";

/**
 * Applies server-reported field errors to a react-hook-form instance (so the
 * existing <FormMessage/> under each field shows the real reason) and
 * returns a human-readable summary to use as the toast message. Returns
 * null if `error` isn't a field-level validation error, so callers can fall
 * back to their existing generic message.
 *
 * Accepts either an `ApiClientError` (the shared `apiClient`'s error shape)
 * or any thrown object carrying a `details: {field, message}[]` property
 * directly (some hooks build a lightweight custom error with extra fields
 * like a rate-limit `.status`, rather than the full ApiClientError).
 */
export function applyServerFieldErrors(form: UseFormReturn<any>, error: unknown): string | null {
  let details: unknown;
  if (error instanceof ApiClientError) {
    details = error.response.error.details;
  } else if (error && typeof error === "object" && "details" in error) {
    details = (error as { details?: unknown }).details;
  }
  if (!Array.isArray(details) || details.length === 0) return null;

  const summaries: string[] = [];
  for (const d of details) {
    if (d && typeof d.field === "string" && typeof d.message === "string") {
      if (d.field) form.setError(d.field as any, { type: "server", message: d.message });
      summaries.push(d.field ? `${d.field}: ${d.message}` : d.message);
    }
  }
  return summaries.length > 0 ? summaries.join(" · ") : null;
}
