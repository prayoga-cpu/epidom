"use client";

import { useSession } from "next-auth/react";
import { useI18n } from "@/components/lang/i18n-provider";
import { ProfileHeader } from "@/features/dashboard/profile/components/profile-header";
import { PersonalInfoCard } from "@/features/dashboard/profile/components/personal-info-card";
import { BusinessInfoCard } from "@/features/dashboard/profile/components/business-info-card";
import { SubscriptionInfoCard } from "@/features/dashboard/profile/components/subscription-info-card";
import { StripeConnectCard } from "@/features/dashboard/profile/components/stripe-connect-card";
import { useProfile } from "@/features/dashboard/profile/hooks/use-profile";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ProfilePage() {
  const { t } = useI18n();
  const { data: session, status } = useSession();
  const { data: profileData, isLoading, isError, refetch, error } = useProfile();
  const [retryCount, setRetryCount] = useState(0);

  const epidomOwnerEmail =
    process.env.NEXT_PUBLIC_EPIDOM_OWNER_EMAIL || process.env.EPIDOM_OWNER_EMAIL;
  const isOwner = session?.user?.email === epidomOwnerEmail;

  // Debug logging
  useEffect(() => {
    console.log("Profile page debug:", {
      sessionStatus: status,
      sessionUser: session?.user?.email,
      isLoading,
      isError,
      hasProfileData: !!profileData,
      retryCount,
      error: error?.message,
    });
  }, [status, session?.user?.email, isLoading, isError, profileData, retryCount, error]);

  // Auto-retry jika profile gagal load
  useEffect(() => {
    if (isError && status !== "loading" && session?.user && retryCount < 3) {
      const timer = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        refetch();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isError, status, session?.user, retryCount, refetch]);

  if (status === "loading" || isLoading) {
    return <ProfileLoadingSkeleton />;
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-[calc(100vh-150px)] w-full items-center justify-center py-12">
        <p className="text-muted-foreground">{t("profile.failedToLoad")}</p>
      </div>
    );
  }

  if (isError || !profileData) {
    return (
      <div className="flex min-h-[calc(100vh-150px)] w-full items-center justify-center py-12">
        <p className="text-muted-foreground">{t("profile.failedToLoad")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-150px)] w-full space-y-4 sm:space-y-6">
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6 md:px-8 md:py-8">
        <div className="animate-slide-up">
          <ProfileHeader
            user={profileData}
            subscription={profileData.subscription}
            onUpdate={undefined}
          />
        </div>

        <div className="animate-slide-up-delayed grid gap-4 sm:gap-6 md:grid-cols-2">
          <PersonalInfoCard user={profileData} onUpdate={undefined} />
          <SubscriptionInfoCard subscription={profileData.subscription} />
        </div>

        <div className="animate-slide-up-delayed-2">
          <BusinessInfoCard
            business={profileData.business}
            userId={profileData.id}
            onUpdate={undefined}
          />
        </div>

        {isOwner && (
          <div className="animate-slide-up-delayed-3">
            <StripeConnectCard />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Profile Loading Skeleton
 *
 * Displays skeleton loading state that matches the profile page layout.
 * Consistent with stores page loading pattern.
 */
function ProfileLoadingSkeleton() {
  return (
    <div className="min-h-[calc(100vh-150px)] w-full space-y-4 sm:space-y-6">
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6 md:px-8 md:py-8">
        {/* Profile Header Skeleton */}
        <div className="animate-slide-up">
          <Card className="border-2">
            <CardContent className="p-4 sm:p-5 md:p-6">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
                {/* Avatar Skeleton */}
                <div className="relative shrink-0">
                  <Skeleton className="h-20 w-20 rounded-full sm:h-24 sm:w-24" />
                  <Skeleton className="absolute -right-1 -bottom-1 h-7 w-7 rounded-full sm:-right-2 sm:-bottom-2 sm:h-8 sm:w-8" />
                </div>
                {/* Info Skeleton */}
                <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                  <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:flex-wrap">
                    <Skeleton className="h-6 w-32 sm:h-7" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-48 mx-auto sm:mx-0" />
                  <Skeleton className="h-3 w-40 mx-auto sm:mx-0" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cards Grid Skeleton */}
        <div className="animate-slide-up-delayed grid gap-4 sm:gap-6 md:grid-cols-2">
          {/* Personal Info Card Skeleton */}
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-9 w-9 sm:h-auto sm:w-20" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Subscription Info Card Skeleton */}
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-20" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <div className="flex items-baseline justify-between">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
              <div className="space-y-3 border-t pt-4">
                <Skeleton className="h-4 w-32" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <Skeleton className="h-10 w-full sm:flex-1" />
                <Skeleton className="h-10 w-full sm:flex-1" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Business Info Card Skeleton */}
        <div className="animate-slide-up-delayed-2">
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-9 w-9 sm:h-auto sm:w-20" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
