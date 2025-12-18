import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OnboardingContent } from "@/features/onboarding/components/onboarding-content";

function OnboardingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 text-center">
          <Skeleton className="mx-auto mb-4 h-14 w-14 rounded-full" />
          <Skeleton className="mx-auto h-8 w-48" />
          <Skeleton className="mx-auto mt-2 h-5 w-64" />
        </div>
        <Card className="border-2 shadow-xl">
          <CardHeader className="pb-4 text-center">
            <Skeleton className="mx-auto h-6 w-40" />
            <Skeleton className="mx-auto mt-2 h-4 w-56" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            </div>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <OnboardingContent />
    </Suspense>
  );
}
