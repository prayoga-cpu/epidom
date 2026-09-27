"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { isUnauthorizedError } from "@/lib/api/unauthorized";
import { ONBOARDING_CONFLICT, conflictReason } from "../lib/onboarding-api";
import { ONBOARDING_EXIT_PATH } from "../lib/resolve-onboarding-redirect";

export const ONBOARDING_LOGIN_PATH = "/login?callbackUrl=/onboarding";

/**
 * What every step does with a failed save, apart from its own special cases:
 * signed out → sign in and come back; setup already finished (another tab,
 * another device) → /stores; a step saved out of order → `onStepOrder`
 * (the wizard goes back to step 1); anything else → a toast, the form stays
 * as typed so the owner can simply retry.
 */
export function useStepErrorHandler({ onStepOrder }: { onStepOrder?: () => void } = {}) {
  const { t } = useI18n();
  const router = useRouter();

  return useCallback(
    (error: unknown, fallbackKey = "onboarding.errors.saveFailed") => {
      if (isUnauthorizedError(error)) {
        window.location.assign(ONBOARDING_LOGIN_PATH);
        return;
      }
      const reason = conflictReason(error);
      if (reason === ONBOARDING_CONFLICT.alreadyCompleted) {
        toast.info(t("onboarding.errors.alreadyCompleted"));
        router.replace(ONBOARDING_EXIT_PATH);
        return;
      }
      if (reason === ONBOARDING_CONFLICT.stepOrder) {
        toast.error(t("onboarding.errors.stepOrder"));
        onStepOrder?.();
        return;
      }
      toast.error(t(fallbackKey));
    },
    [t, router, onStepOrder]
  );
}
