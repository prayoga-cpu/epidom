"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { ProfileHeader } from "./profile-header";
import { PersonalInfoCard } from "./personal-info-card";
import { BusinessInfoCard } from "./business-info-card";
import { SubscriptionInfoCard } from "./subscription-info-card";
import { StripeConnectCard } from "./stripe-connect-card";
import { useProfile } from "../hooks/use-profile";
import type { ProfileData } from "../types";

import { useSession } from "next-auth/react";
import { useEffect } from "react";

interface ProfileClientProps {
  initialProfile: ProfileData;
  isOwner: boolean;
}

export function ProfileClient({ initialProfile, isOwner }: ProfileClientProps) {
  const { t } = useI18n();
  const { data: session, update } = useSession();

  // Use initial data from Server Component
  const { data: profileData = initialProfile, isLoading, isError } = useProfile(initialProfile);

  // Sync session with profile data if subscription status mismatches
  // This ensures that if the user upgraded but session is stale, visiting profile fixes it
  useEffect(() => {
    if (!profileData?.subscription || !session) return;

    const profileStatus = profileData.subscription.status;
    const sessionStatus = session.user.subscriptionStatus;

    // Check if profile has ACTIVE status but session doesn't
    const isProfileActive = profileStatus === "ACTIVE";
    const isSessionActive = sessionStatus === "ACTIVE";

    if (isProfileActive && !isSessionActive) {
      update();
    }
  }, [profileData, session, update]);

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
