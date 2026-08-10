import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { userService, businessService } from "@/lib/services";
import { ProfileClient } from "@/features/dashboard/profile/components/profile-client";
import type { ProfileData } from "@/features/dashboard/profile/types";
import { requireOwnerOnly } from "@/lib/auth/require-owner-only";

export default async function ProfilePage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Profile holds Account Settings (incl. the Owner PIN itself) — a
  // restricted staff persona must never reach it.
  await requireOwnerOnly(storeId);

  // Fetch user profile
  const profileDto = await userService.getProfile(session.user.id);

  // Store name for the Fees & Taxes card header — actual store-scoped data
  // (settings, orders) stays protected by requireStoreAuth on the API
  // routes, same as every other store-scoped dashboard page.
  const store = await businessService.getStoreById(storeId).catch(() => null);

  // Transform UserProfileDto to ProfileData format
  const profileData: ProfileData = {
    id: profileDto.id,
    name: profileDto.name,
    email: profileDto.email,
    image: profileDto.image,
    phone: profileDto.phone,
    locale: profileDto.locale as "en" | "fr" | "id" | undefined,
    timezone: profileDto.timezone,
    defaultLanding: profileDto.defaultLanding,
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
          locale: profileDto.business.locale,
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

  return (
    <ProfileClient
      initialProfile={profileData}
      isOwner={isOwner}
      storeId={storeId}
      storeName={store?.name}
      storeCountry={store?.country ?? null}
    />
  );
}
