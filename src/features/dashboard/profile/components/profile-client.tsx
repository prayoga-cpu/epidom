"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { ProfileHeader } from "./profile-header";
import { PersonalInfoCard } from "./personal-info-card";
import { BusinessInfoCard } from "./business-info-card";
import { SubscriptionInfoCard } from "./subscription-info-card";
import { AccountSettingsCard } from "./account-settings-card";
import { FeesAndTaxesCard } from "./fees-and-taxes-card";
import { ReceiptSettingsCard } from "./receipt-settings-card";
import { useProfile } from "../hooks/use-profile";
import type { ProfileData } from "../types";

import { useSession } from "@/lib/auth-client";
import { useEffect, useRef } from "react";

interface ProfileClientProps {
  initialProfile: ProfileData;
  isOwner: boolean;
  storeId?: string;
  storeName?: string;
  storeCountry?: string | null;
}

export function ProfileClient({
  initialProfile,
  isOwner,
  storeId,
  storeName,
  storeCountry,
}: ProfileClientProps) {
  const { t } = useI18n();
  const { data: session, refetch } = useSession();

  // Use initial data from Server Component
  const { data: profileData = initialProfile, isLoading, isError } = useProfile(initialProfile);

  const hasRefetched = useRef(false);

  // Sync session with profile data if subscription status mismatches
  // This ensures that if the user upgraded but session is stale, visiting profile fixes it
  useEffect(() => {
    if (!profileData?.subscription || !session || hasRefetched.current) return;

    const profileStatus = profileData.subscription.status;
    const sessionStatus = (session.user as any).subscriptionStatus;

    // Check if profile has ACTIVE status but session doesn't
    const isProfileActive = profileStatus === "ACTIVE";
    const isSessionActive = sessionStatus === "ACTIVE";

    if (isProfileActive && !isSessionActive) {
      hasRefetched.current = true;
      refetch?.();
    }
  }, [profileData, session, refetch]);

  if (isError || !profileData) {
    return (
      <div className="flex min-h-[calc((100vh-150px)/var(--app-zoom,1))] w-full items-center justify-center py-12">
        <p className="text-muted-foreground">{t("profile.failedToLoad")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc((100vh-150px)/var(--app-zoom,1))] w-full space-y-4 md:space-y-6">
      <div className="animate-slide-up">
        <ProfileHeader
          user={profileData}
          subscription={profileData.subscription}
          onUpdate={undefined}
        />
      </div>

      <div className="animate-slide-up-delayed grid gap-4 md:grid-cols-2 md:gap-6">
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

      {storeId && (
        <div className="animate-slide-up-delayed-3">
          <FeesAndTaxesCard
            storeId={storeId}
            storeName={storeName}
            storeCountry={storeCountry}
            businessLocale={profileData.business?.locale}
          />
        </div>
      )}

      {storeId && (
        <div className="animate-slide-up-delayed-3">
          <ReceiptSettingsCard storeId={storeId} storeName={storeName} />
        </div>
      )}

      <div className="animate-slide-up-delayed-3">
        <AccountSettingsCard userEmail={profileData.email} />
      </div>
    </div>
  );
}
