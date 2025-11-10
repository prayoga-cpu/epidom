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
    return (
      <div className="flex min-h-[calc(100vh-150px)] w-full items-center justify-center py-12">
        <p className="text-muted-foreground">{t("profile.loading")}</p>
      </div>
    );
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
