import type { Locale } from "@/components/lang/i18n-provider";
import { ApiClientError } from "@/lib/api/client";
import { unwrapApiData } from "@/lib/api/unwrap";
import { LOCALE_HEADER } from "@/lib/i18n-routing";
import type {
  OnboardingCompleteResult,
  OnboardingGoal,
  OnboardingState,
  SlugCheckResult,
} from "@/lib/onboarding/contracts";
import type {
  OnboardingStoreStepInput,
  OnboardingStorefrontStepInput,
} from "@/lib/validation/onboarding.schemas";
import { ApiErrorCode, type ApiErrorResponse } from "@/types/api/responses";

/**
 * Browser calls to the setup wizard's API (src/app/api/onboarding/*). Every
 * success arrives in the usual `{ success, data }` envelope and is unwrapped
 * here; every failure is thrown as an `ApiClientError` carrying the status and
 * the error envelope, so `conflictReason()` can read `error.details.reason`.
 */

/**
 * `error.details.reason` values on the wizard's 409s. The same strings as
 * ONBOARDING_CONFLICT_REASON in src/lib/services/onboarding.service.ts, which
 * can't be imported client-side (it pulls in Prisma); a test keeps them equal.
 */
export const ONBOARDING_CONFLICT = {
  stepOrder: "step_order",
  slugTaken: "slug_taken",
  alreadyCompleted: "already_completed",
} as const;
export type OnboardingConflictReason =
  (typeof ONBOARDING_CONFLICT)[keyof typeof ONBOARDING_CONFLICT];

function isErrorEnvelope(body: unknown): body is ApiErrorResponse {
  return (
    !!body &&
    typeof body === "object" &&
    (body as { success?: unknown }).success === false &&
    typeof (body as { error?: unknown }).error === "object"
  );
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || isErrorEnvelope(body)) {
    const envelope: ApiErrorResponse = isErrorEnvelope(body)
      ? body
      : {
          success: false,
          error: {
            code: ApiErrorCode.INTERNAL_ERROR,
            message: response.statusText || "Request failed",
          },
        };
    throw new ApiClientError(envelope, response.status);
  }

  return unwrapApiData<T>(body);
}

/** The 409 reason of a wizard error, if it is one. */
export function conflictReason(error: unknown): OnboardingConflictReason | null {
  if (!(error instanceof ApiClientError) || error.status !== 409) return null;
  const details = error.response.error.details;
  if (!details || Array.isArray(details)) return null;
  const reason = (details as Record<string, unknown>).reason;
  return Object.values(ONBOARDING_CONFLICT).includes(reason as OnboardingConflictReason)
    ? (reason as OnboardingConflictReason)
    : null;
}

/** `details.suggestion` of a slug_taken 409: a free alternative link. */
export function conflictSuggestion(error: unknown): string | null {
  if (!(error instanceof ApiClientError)) return null;
  const details = error.response.error.details;
  if (!details || Array.isArray(details)) return null;
  const suggestion = (details as Record<string, unknown>).suggestion;
  return typeof suggestion === "string" && suggestion ? suggestion : null;
}

export type SaveStoreStepBody = OnboardingStoreStepInput;
export type SaveStorefrontStepBody = OnboardingStorefrontStepInput;

export const onboardingApi = {
  getState: () => request<OnboardingState>("/api/onboarding/state"),

  /**
   * Step 1. The UI language rides along in the x-epidom-locale header: the
   * server uses it for the customer-facing language of an "Other" country.
   */
  saveStore: (body: SaveStoreStepBody, locale: Locale) =>
    request<OnboardingState>("/api/onboarding/store", {
      method: "POST",
      headers: { [LOCALE_HEADER]: locale },
      body: JSON.stringify(body),
    }),

  saveStorefront: (body: Partial<SaveStorefrontStepBody>) =>
    request<OnboardingState>("/api/onboarding/storefront", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  complete: (goals: OnboardingGoal[]) =>
    request<OnboardingCompleteResult>("/api/onboarding/complete", {
      method: "POST",
      body: JSON.stringify({ goals }),
    }),

  checkSlug: (slug: string, signal?: AbortSignal) =>
    request<SlugCheckResult>(`/api/onboarding/slug-check?slug=${encodeURIComponent(slug)}`, {
      signal,
    }),
};
