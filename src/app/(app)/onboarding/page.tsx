import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingContent } from "@/features/onboarding/components/onboarding-content";
import { resolveOnboardingRedirect } from "@/features/onboarding/lib/resolve-onboarding-redirect";
import { getSession } from "@/lib/auth";
import { getLinkedStaffForUser } from "@/lib/auth/staff-link";
import { NotFoundError } from "@/lib/errors";
import type { OnboardingState } from "@/lib/onboarding/contracts";
import { prisma } from "@/lib/prisma";
import { getOnboardingState } from "@/lib/services/onboarding.service";

const LOGIN_PATH = "/login?callbackUrl=/onboarding";

/** Same frame as the wizard (see WizardFrame): full-bleed on phones, a centred card from sm. */
function OnboardingSkeleton() {
  return (
    <div className="bg-background sm:bg-muted/40 flex min-h-[calc(100dvh/var(--app-zoom,1))] flex-col">
      <div className="flex h-14 items-center justify-between px-4 sm:h-16 sm:px-6">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="flex flex-1 flex-col sm:items-center sm:px-4 sm:pb-10">
        <div className="bg-background w-full flex-1 space-y-6 px-4 py-6 sm:max-w-2xl sm:flex-none sm:rounded-2xl sm:border sm:p-8">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-1.5 w-full" />
              ))}
            </div>
          </div>
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
          <Skeleton className="ml-auto h-11 w-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default async function OnboardingPage() {
  const session = await getSession();

  if (!session) {
    redirect(LOGIN_PATH);
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
    redirect(LOGIN_PATH);
  }

  const [business, staffLink] = await Promise.all([
    prisma.business.findUnique({ where: { userId }, select: { onboardingStep: true } }),
    // Only an account without a business can be "staff, not an owner".
    state.business ? Promise.resolve(null) : getLinkedStaffForUser(userId),
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
    redirect(target);
  }

  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <OnboardingContent initialState={state} />
    </Suspense>
  );
}
