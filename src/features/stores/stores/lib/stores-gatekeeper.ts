/**
 * The /stores gatekeeper: decides, from GET /api/user/profile, whether the
 * account belongs on Your Stores or has to (re)enter the setup wizard.
 *
 * It must agree with the /onboarding page guard, which sends an owner who has
 * a store back to /stores unless the wizard is still in progress. So /stores
 * only sends someone to /onboarding when:
 * - `no-store`: an owner (not a linked staff login) with no business or no
 *   store yet. The onboarding page never bounces an owner without a store.
 * - `wizard-unfinished`: an owner who has a store but whose setup wizard is
 *   still in progress (`hasOnboarded === false` and a non-null
 *   `business.onboardingStep`). The onboarding page keeps exactly these
 *   owners, so the two guards can't loop. `hasOnboarded` missing (an older
 *   response) never counts as unfinished.
 *
 * A linked staff login is never sent to onboarding: staff have no business by
 * design, and the wizard is the owner's merchant setup, not theirs. That
 * includes an owner who is also linked as staff at another business, even one
 * with zero stores of their own (/onboarding would take them, but the wizard
 * has no way back to the staff card here). /stores keeps Create a store for
 * them instead (StoresContainer: `hasBusiness`).
 */

export interface GatekeeperProfile {
  hasOnboarded?: boolean | null;
  business?: {
    stores?: unknown[] | null;
    onboardingStep?: number | null;
    country?: string | null;
    timezone?: string | null;
  } | null;
  staffLink?: { storeId: string; storeName: string } | null;
}

export type GatekeeperVerdict = "stay" | "no-store" | "wizard-unfinished";

export function gatekeeperVerdict(
  profile: GatekeeperProfile | null | undefined
): GatekeeperVerdict {
  if (!profile || profile.staffLink) return "stay";
  const business = profile.business;
  const hasStore = (business?.stores?.length ?? 0) > 0;
  if (!business || !hasStore) return "no-store";
  if (profile.hasOnboarded === false && business.onboardingStep != null) {
    return "wizard-unfinished";
  }
  return "stay";
}

/**
 * Loop breaker for the `wizard-unfinished` redirect. If the onboarding page
 * ever disagrees with the rule above (and sends the owner straight back),
 * /stores must not bounce them forever: after one redirect it stays put for
 * this long. It also lets an owner who deliberately leaves the wizard for
 * Your Stores reach it on the second try.
 */
export const WIZARD_REDIRECT_COOLDOWN_MS = 60_000;
const WIZARD_REDIRECT_KEY = "epidom:stores-gatekeeper:wizard-redirect-at";

/** True when a `wizard-unfinished` redirect happened within the cooldown. */
export function wizardRedirectedRecently(now: number = Date.now()): boolean {
  try {
    const raw = window.sessionStorage.getItem(WIZARD_REDIRECT_KEY);
    const at = raw ? Number(raw) : NaN;
    return Number.isFinite(at) && now - at >= 0 && now - at < WIZARD_REDIRECT_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function rememberWizardRedirect(now: number = Date.now()): void {
  try {
    window.sessionStorage.setItem(WIZARD_REDIRECT_KEY, String(now));
  } catch {
    // Storage blocked (private mode, sandbox): the redirect still happens, just without the breaker.
  }
}

export function clearWizardRedirect(): void {
  try {
    window.sessionStorage.removeItem(WIZARD_REDIRECT_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
