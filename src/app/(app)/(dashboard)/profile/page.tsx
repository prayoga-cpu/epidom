"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/auth-client";
import { useI18n } from "@/components/lang/i18n-provider";
import { ProfileHeader } from "@/features/dashboard/profile/components/profile-header";
import { PersonalInfoCard } from "@/features/dashboard/profile/components/personal-info-card";
import { BusinessInfoCard } from "@/features/dashboard/profile/components/business-info-card";
import { SubscriptionInfoCard } from "@/features/dashboard/profile/components/subscription-info-card";
import { ActivityLogCard } from "@/features/dashboard/profile/components/activity-log-card";
import type { ProfileData } from "@/features/dashboard/profile/types";

export default function ProfilePage() {
  const { t } = useI18n();
  const { user: sessionUser, loading: sessionLoading } = useUser();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileData = async () => {
    try {
      const response = await fetch("/api/user/profile");
      if (!response.ok) throw new Error("Failed to fetch profile");
      const result = await response.json();

      // API returns { success: true, data: {...} }
      if (result.success && result.data) {
        setProfileData(result.data);
      } else {
        throw new Error(result.error?.message || "Failed to fetch profile");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading && sessionUser) {
      fetchProfileData();
    }
  }, [sessionLoading, sessionUser]);

  if (sessionLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-150px)] w-full items-center justify-center py-12">
        <p className="text-muted-foreground">{t("profile.loading")}</p>
      </div>
    );
  }

  if (!sessionUser || !profileData) {
    return (
      <div className="flex min-h-[calc(100vh-150px)] w-full items-center justify-center py-12">
        <p className="text-muted-foreground">{t("profile.failedToLoad")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-150px)] w-full space-y-6">
      <ProfileHeader user={profileData} subscription={profileData.subscription} />

      <div className="grid gap-6 lg:grid-cols-2">
        <PersonalInfoCard user={profileData} onUpdate={fetchProfileData} />
        <SubscriptionInfoCard subscription={profileData.subscription} />
      </div>

      <BusinessInfoCard
        business={profileData.business}
        userId={profileData.id}
        onUpdate={fetchProfileData}
      />

      <ActivityLogCard />
    </div>
  );
}
