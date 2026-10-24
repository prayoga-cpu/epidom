"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ONBOARDING_PATH,
  SIGNUP_GOOGLE_VALUE,
  SIGNUP_PARAM,
  VERIFIED_PARAM,
  VERIFIED_VALUE,
} from "@/features/auth/register/lib/verification-landing";
import { trackEmailVerified, trackGoogleSignUp } from "../lib/onboarding-analytics";

/** Better Auth appends `error=<CODE>` to the callback URL when a verification link is bad. */
export const VERIFICATION_ERROR_PARAM = "error";

/**
 * Reads how the visitor arrived (see verification-landing.ts) once, fires
 * the matching analytics, then strips those params from the address bar so a
 * reload or a shared URL doesn't replay them.
 *
 * - `verified=1` without `error`: the email was just confirmed →
 *   `email_verified` (once per browser session).
 * - `verified=1` with `error`: the link was expired or already used → the
 *   returned `verificationError` drives a friendly notice.
 * - `signup=google` on a brand-new account (no business yet) → the `sign_up`
 *   conversion Google signups never fired (once per browser session). An
 *   existing user who pressed Google on the register page isn't counted.
 *
 * Either way, a brand-new account that just finished signing up gets
 * `welcome`: the "Congratulations on choosing Epidom" banner. The params are
 * stripped right after, so a reload doesn't show it again.
 */
export function useOnboardingLanding({ isNewAccount }: { isNewAccount: boolean }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handled = useRef(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    if (handled.current || !searchParams) return;
    const verified = searchParams.get(VERIFIED_PARAM) === VERIFIED_VALUE;
    const signup = searchParams.get(SIGNUP_PARAM);
    if (!verified && signup === null) return;
    handled.current = true;

    let signedUp = false;
    if (verified) {
      const error = searchParams.get(VERIFICATION_ERROR_PARAM);
      if (error) setVerificationError(error);
      else {
        trackEmailVerified();
        signedUp = true;
      }
    }
    if (signup === SIGNUP_GOOGLE_VALUE && isNewAccount) {
      trackGoogleSignUp();
      signedUp = true;
    }
    if (signedUp && isNewAccount) setWelcome(true);

    const rest = new URLSearchParams(searchParams.toString());
    rest.delete(VERIFIED_PARAM);
    rest.delete(SIGNUP_PARAM);
    if (verified) rest.delete(VERIFICATION_ERROR_PARAM);
    const query = rest.toString();
    router.replace(query ? `${ONBOARDING_PATH}?${query}` : ONBOARDING_PATH, { scroll: false });
  }, [searchParams, router, isNewAccount]);

  const dismissVerificationError = useCallback(() => setVerificationError(null), []);
  const dismissWelcome = useCallback(() => setWelcome(false), []);

  return { verificationError, dismissVerificationError, welcome, dismissWelcome };
}
