import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/lib/auth-client";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import type { ProfileData } from "../types";

interface UpdateProfilePayload {
  name?: string;
  phone?: string;
  locale?: string;
  timezone?: string;
  currency?: string;
  image?: string;
}

interface UpdateBusinessPayload {
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
}

/**
 * Fetch profile data from API
 */
const fetchProfile = async (): Promise<ProfileData> => {
  const response = await fetch("/api/user/profile");
  if (!response.ok) {
    throw new Error("Failed to fetch profile");
  }
  const result = await response.json();

  if (result.success && result.data) {
    return result.data;
  }

  throw new Error(result.error?.message || "Failed to fetch profile");
};

/**
 * Update user profile
 */
const updateProfile = async (payload: UpdateProfilePayload): Promise<ProfileData> => {
  const response = await fetch("/api/user/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to update profile");
  }

  const result = await response.json();

  if (result.success && result.data) {
    return result.data;
  }

  throw new Error(result.error?.message || "Failed to update profile");
};

/**
 * Update business info
 */
const updateBusiness = async (payload: UpdateBusinessPayload): Promise<ProfileData> => {
  const response = await fetch("/api/user/business", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to update business");
  }

  const result = await response.json();

  if (result.success && result.data) {
    return result.data;
  }

  throw new Error(result.error?.message || "Failed to update business");
};

/**
 * Hook to fetch and cache profile data using TanStack Query
 */
export const useProfile = () => {
  const { data: session, status } = useSession();

  return useQuery<ProfileData>({
    queryKey: ["profile", session?.user?.id],
    queryFn: fetchProfile,
    enabled: status === "authenticated" && !!session?.user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    refetchOnMount: false, // Prevent refetch on mount if data exists
  });
};

/**
 * Hook to update user profile
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { update: updateSession } = useSession();
  const { t } = useI18n();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: async (data, variables) => {
      console.log("[useUpdateProfile] Profile updated successfully:", data);
      console.log("[useUpdateProfile] Profile image:", data.image);

      // Determine if this is an avatar update (only image field changed, no other fields)
      const hasImageUpdate = variables.image !== undefined;
      const hasOtherUpdates =
        variables.name !== undefined ||
        variables.phone !== undefined ||
        variables.locale !== undefined ||
        variables.timezone !== undefined ||
        variables.currency !== undefined;

      const isAvatarOnlyUpdate = hasImageUpdate && !hasOtherUpdates;
      const isAvatarRemoval = isAvatarOnlyUpdate && (variables.image === "" || variables.image === null);

      // Invalidate the profile query to trigger refetch
      await queryClient.invalidateQueries({
        queryKey: ["profile", user?.id],
      });

      // Update the NextAuth session to reflect new currency/locale/image
      const sessionUpdate: Record<string, any> = {};

      if (data.currency) sessionUpdate.currency = data.currency;
      if (data.locale) sessionUpdate.locale = data.locale;
      if (data.timezone) sessionUpdate.timezone = data.timezone;
      if (data.name) sessionUpdate.name = data.name;
      if (data.phone) sessionUpdate.phone = data.phone;

      // Handle image: include null or empty string to remove image from session
      if (data.image !== undefined) {
        sessionUpdate.image = data.image || null; // Convert empty string to null
      }

      // Only update session if there are changes
      if (Object.keys(sessionUpdate).length > 0) {
        console.log("[useUpdateProfile] Session update payload:", sessionUpdate);
        await updateSession(sessionUpdate);
        console.log("[useUpdateProfile] Session updated successfully");
      }

      // Show toast notification based on update type
      // Only show toast once in the mutation hook to prevent duplicates
      if (isAvatarRemoval) {
        toast.success(t("profile.toasts.avatarRemoved.title"), {
          description: t("profile.toasts.avatarRemoved.description"),
        });
      } else if (isAvatarOnlyUpdate) {
        toast.success(t("profile.toasts.avatarUpdated.title"), {
          description: t("profile.toasts.avatarUpdated.description"),
        });
      } else {
        // General profile update (name, phone, locale, etc.) or mixed update
        toast.success(t("profile.toasts.profileUpdated.title"), {
          description: t("profile.toasts.profileUpdated.description"),
        });
      }
    },
    onError: (error) => {
      // Error toast is handled in the component that calls the mutation
      // This prevents duplicate error toasts
      console.error("[useUpdateProfile] Profile update failed:", error);
    },
  });
};

/**
 * Hook to update business info
 */
export const useUpdateBusiness = () => {
  const queryClient = useQueryClient();
  const { user } = useUser();

  return useMutation({
    mutationFn: updateBusiness,
    onSuccess: async (data) => {
      // Invalidate the profile query to trigger refetch
      await queryClient.invalidateQueries({
        queryKey: ["profile", user?.id],
      });
    },
  });
};
