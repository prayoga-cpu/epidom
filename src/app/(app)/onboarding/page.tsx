import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OnboardingContent } from "@/features/onboarding/components/onboarding-content";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export default async function OnboardingPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?callbackUrl=/onboarding");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      hasOnboarded: true,
      business: {
        select: {
          stores: {
            select: {
              storefront: { select: { isPublished: true } },
            },
          },
        },
      },
    },
  });

  // Redirect away if onboarding was already completed, or if the store is
  // already published (backward-compat for users who registered before this flag existed).
  const hasPublishedStore = user?.business?.stores?.some((s) => s.storefront?.isPublished);

  if (user?.hasOnboarded || hasPublishedStore) {
    redirect("/stores");
  }

  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <OnboardingContent />
    </Suspense>
  );
}
