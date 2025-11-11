"use client";

import { useUser } from "@/lib/auth-client";
import { useI18n } from "@/components/lang/i18n-provider";
import { ProfileHeader } from "@/features/dashboard/profile/components/profile-header";
import { PersonalInfoCard } from "@/features/dashboard/profile/components/personal-info-card";
import { BusinessInfoCard } from "@/features/dashboard/profile/components/business-info-card";
import { SubscriptionInfoCard } from "@/features/dashboard/profile/components/subscription-info-card";
import { ActivityLogCard } from "@/features/dashboard/profile/components/activity-log-card";
import { StripeConnectCard } from "@/features/dashboard/profile/components/stripe-connect-card";
import { useProfile } from "@/features/dashboard/profile/hooks/use-profile";

export default function ProfilePage() {
  const { t } = useI18n();
  const { user: sessionUser, loading: sessionLoading } = useUser();
  const { data: profileData, isLoading, isError } = useProfile();

  // Check if user is the Epidom owner
  const epidomOwnerEmail =
    process.env.NEXT_PUBLIC_EPIDOM_OWNER_EMAIL || process.env.EPIDOM_OWNER_EMAIL;
  const isOwner = sessionUser?.email === epidomOwnerEmail;

  if (sessionLoading || isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-150px)] w-full items-center justify-center py-12">
        <p className="text-muted-foreground">{t("profile.loading")}</p>
      </div>
    );
  }

  if (!sessionUser || isError || !profileData) {
    return (
      <div className="flex min-h-[calc(100vh-150px)] w-full items-center justify-center py-12">
        <p className="text-muted-foreground">{t("profile.failedToLoad")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-150px)] w-full space-y-6">
      <ProfileHeader
        user={profileData}
        subscription={profileData.subscription}
        onUpdate={undefined}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <PersonalInfoCard user={profileData} onUpdate={undefined} />
        <SubscriptionInfoCard subscription={profileData.subscription} />
      </div>

      <BusinessInfoCard
        business={profileData.business}
        userId={profileData.id}
        onUpdate={undefined}
      />

      {/* Stripe Connect Card - Only for Epidom owner */}
      {isOwner && <StripeConnectCard />}
    </div>
  );
}
