import type { BusinessType } from "./markets";

/**
 * Shared shapes for the setup wizard (/onboarding) — the API routes under
 * /api/onboarding return these, the wizard UI consumes them. Zod schemas for
 * the request bodies live in src/lib/validation/onboarding.schemas.ts.
 *
 * Steps (stored on Business.onboardingStep while the wizard is in progress):
 *   1. Your store      — name, country, city, type (+ optional Instagram fill)
 *   2. Your storefront — logo, colour, tagline, up to 3 menu items
 *   3. Your goals      — what the owner wants Epidom for, then publish
 */
export const ONBOARDING_STEP = { store: 1, storefront: 2, goals: 3 } as const;
export type OnboardingStepNumber = (typeof ONBOARDING_STEP)[keyof typeof ONBOARDING_STEP];

/** What the owner wants Epidom for, picked on step 3; orders the Getting-started checklist. */
export const ONBOARDING_GOALS = ["storefront", "counter", "operations"] as const;
export type OnboardingGoal = (typeof ONBOARDING_GOALS)[number];

export interface OnboardingMenuItem {
  id: string;
  name: string;
  /** In `OnboardingState.currency`, as a plain number. */
  price: number;
}

/** GET /api/onboarding/state — and the body of every step's POST response. */
export interface OnboardingState {
  /** The step to show: where the owner left off (1 when nothing is saved yet). */
  step: OnboardingStepNumber;
  /** True once User.hasOnboarded is set; the page redirects away in that case. */
  completed: boolean;
  storeId: string | null;
  business: {
    name: string;
    /** ISO code resolved from Business.country, "ZZ" for other/unknown, null if unset. */
    countryCode: string | null;
    city: string | null;
    businessType: BusinessType | null;
    timezone: string;
  } | null;
  storefront: {
    slug: string;
    displayName: string;
    tagline: string | null;
    logoUrl: string | null;
    themeColor: string;
    instagramUrl: string | null;
    whatsappNumber: string | null;
    isPublished: boolean;
  } | null;
  /** The store's resolved currency (finance settings); drives price inputs. */
  currency: string;
  /** Menu items already on the storefront, so a resumed step 2 shows them. */
  menuItems: OnboardingMenuItem[];
  goals: OnboardingGoal[];
}

/** POST /api/onboarding/complete response. */
export interface OnboardingCompleteResult {
  storeId: string;
  slug: string;
  /** Absolute public storefront URL, built from NEXT_PUBLIC_APP_URL. */
  publicUrl: string;
  goals: OnboardingGoal[];
}

/** GET /api/onboarding/slug-check?slug=… response. */
export interface SlugCheckResult {
  /** The slug as the server normalized it. */
  slug: string;
  /** False when taken by another storefront or invalid. Your own current slug counts as available. */
  available: boolean;
  /** A free alternative when not available (e.g. "sunset-cafe-2"). */
  suggestion: string | null;
}
