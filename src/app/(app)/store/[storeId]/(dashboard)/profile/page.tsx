import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { userService } from "@/lib/services";
import { ProfileClient } from "@/features/dashboard/profile/components/profile-client";
import type { ProfileData } from "@/features/dashboard/profile/types";

export default async function ProfilePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch user profile
  const profileDto = await userService.getProfile(session.user.id);

  // Transform UserProfileDto to ProfileData format
  const profileData: ProfileData = {
    id: profileDto.id,
    name: profileDto.name,
    email: profileDto.email,
    image: profileDto.image,
    phone: profileDto.phone,
    locale: profileDto.locale as "en" | "fr" | "id" | undefined,
    timezone: profileDto.timezone,
    currency: profileDto.currency,
    createdAt: profileDto.createdAt,
    business: profileDto.business
      ? {
          id: profileDto.business.id,
          name: profileDto.business.name,
          address: profileDto.business.address,
          city: profileDto.business.city,
          country: profileDto.business.country,
          phone: profileDto.business.phone,
          email: profileDto.business.email,
          website: profileDto.business.website,
        }
      : null,
    subscription: profileDto.subscription
      ? {
          plan: profileDto.subscription.plan,
          status: profileDto.subscription.status,
          currentPeriodStart: profileDto.subscription.currentPeriodStart,
          currentPeriodEnd: profileDto.subscription.currentPeriodEnd,
          cancelAtPeriodEnd: profileDto.subscription.cancelAtPeriodEnd,
        }
      : null,
  };

  // Check if user is owner
  const epidomOwnerEmail =
    process.env.NEXT_PUBLIC_EPIDOM_OWNER_EMAIL || process.env.EPIDOM_OWNER_EMAIL;
  const isOwner = session.user.email === epidomOwnerEmail;

  return <ProfileClient initialProfile={profileData} isOwner={isOwner} />;
}
