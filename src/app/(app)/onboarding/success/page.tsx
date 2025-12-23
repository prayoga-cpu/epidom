import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingSuccessContent } from "@/features/onboarding/components/onboarding-success-content";

function OnboardingSuccessSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-50 to-white px-4 py-12">
      <div className="mx-auto max-w-lg text-center">
        <Skeleton className="mx-auto mb-6 h-20 w-20 rounded-full" />
        <Skeleton className="mx-auto mb-3 h-10 w-64" />
        <Skeleton className="mx-auto mb-8 h-6 w-80" />
        <Skeleton className="mx-auto mb-8 h-40 w-full rounded-2xl" />
        <Skeleton className="mx-auto h-14 w-64 rounded-xl" />
      </div>
    </div>
  );
}

export default function OnboardingSuccessPage() {
  return (
    <Suspense fallback={<OnboardingSuccessSkeleton />}>
      <OnboardingSuccessContent />
    </Suspense>
  );
}
