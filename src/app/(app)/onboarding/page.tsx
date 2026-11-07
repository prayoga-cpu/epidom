import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingContent } from "@/features/onboarding/components/onboarding-content";
import {
  onboardingPathFor,
  parsePlanIntent,
  pricingHrefFor,
} from "@/features/onboarding/lib/plan-intent";
import {
  ONBOARDING_EXIT_PATH,
  resolveOnboardingRedirect,
} from "@/features/onboarding/lib/resolve-onboarding-redirect";
import { getSession } from "@/lib/auth";
import { getLinkedStaffForUser } from "@/lib/auth/staff-link";
import { NotFoundError } from "@/lib/errors";
import type { OnboardingState } from "@/lib/onboarding/contracts";
import { prisma } from "@/lib/prisma";
import { getOnboardingBilling, getOnboardingState } from "@/lib/services/onboarding.service";

interface OnboardingPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Same frame as the setup questions (see FlowFrame): header, thin progress bar, one question. */
function OnboardingSkeleton() {
  return (
    <div className="bg-background flex min-h-[calc(100dvh/var(--app-zoom,1))] flex-col">
      <div className="flex h-14 items-center justify-between px-4 sm:h-16 sm:px-6">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-10 w-28" />
      </div>
      <Skeleton className="h-1 w-full rounded-none" />
      <div className="flex flex-1 flex-col items-center px-4 sm:px-6">
        <div className="w-full max-w-xl space-y-6 py-6 sm:py-10">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-12 w-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.set(key, value);
  }
  // A paid plan picked on the pricing or home page before signing up (see
  // plan-intent.ts). It survives the sign-in bounce below.
  const planIntent = parsePlanIntent(query);
  const loginPath = `/login?callbackUrl=${encodeURIComponent(
    planIntent ? onboardingPathFor(planIntent) : "/onboarding"
  )}`;

  const session = await getSession();

  if (!session) {
    redirect(loginPath);
  }

  const userId = session.user.id;
  let state: OnboardingState | null = null;
  try {
    state = await getOnboardingState(userId);
  } catch (error) {
    // A session whose user row is gone (deleted account): sign in again.
    if (!(error instanceof NotFoundError)) throw error;
  }
  if (!state) {
    redirect(loginPath);
  }

  const [business, staffLink, billing] = await Promise.all([
    prisma.business.findUnique({ where: { userId }, select: { onboardingStep: true } }),
    // Only an account without a business can be "staff, not an owner".
    state.business ? Promise.resolve(null) : getLinkedStaffForUser(userId),
    getOnboardingBilling(userId),
  ]);

  // Who gets the wizard and who goes to /stores lives in
  // resolveOnboardingRedirect. Zero stores always stays here, even after
  // setup was once completed: `hasOnboarded` stays true forever once set,
  // while stores can be deleted afterwards (`businessService.deleteStore` has
  // no last-store guard), so the two can disagree. When they do, sending the
  // user to /stores is an infinite bounce: StoresContainer's compliance check
  // sees zero stores and hard-navigates straight back to /onboarding, which
  // lands here and redirects out again. A user with no stores belongs on
  // onboarding — that is where a store gets created — regardless of having
  // once completed it.
  const target = resolveOnboardingRedirect({
    state,
    onboardingStep: business?.onboardingStep ?? null,
    isLinkedStaff: Boolean(staffLink),
  });
  if (target) {
    // An owner whose setup is long done, signing in from a plan button (the
    // register page's "Log in" keeps its `next`): the plan's confirm on
    // /pricing rather than a store list that forgets it. Never for a linked
    // staff login, which has no plan to buy.
    redirect(
      planIntent && target === ONBOARDING_EXIT_PATH && !staffLink
        ? pricingHrefFor(planIntent)
        : target
    );
  }

  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <OnboardingContent
        initialState={state}
        billing={billing}
        planIntent={planIntent}
        user={{ name: session.user.name ?? null, email: session.user.email }}
      />
    </Suspense>
  );
}
