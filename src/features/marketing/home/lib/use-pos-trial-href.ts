"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { POS_TRIAL_REGISTER_HREF } from "@/features/onboarding/lib/plan-intent";
import { useUser } from "@/lib/auth-client";
import { getLocalizedPath } from "@/lib/i18n-routing";

/**
 * Where every "14-day POS trial" button on the home page goes.
 *
 * - Signed out: sign up, then setup with the POS plan picked (its goal comes
 *   ticked), then straight on to the trial's Checkout once the store is
 *   published: a card, nothing charged for 14 days. See plan-intent.ts.
 * - Signed in: /pricing?trial=true#plans, which opens the POS trial confirm
 *   (or nothing, for someone already on POS). The server decides whether a
 *   trial really applies (first POS subscription only).
 *
 * While the session is still loading the signed-out link is used: it is the
 * common case, and /register sends a signed-in visitor to /stores anyway.
 */
export function usePosTrialHref(): string {
  const { locale } = useI18n();
  const { user } = useUser();
  return user
    ? `${getLocalizedPath("/pricing", locale)}?trial=true#plans`
    : POS_TRIAL_REGISTER_HREF;
}
