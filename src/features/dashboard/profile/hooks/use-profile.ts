import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/lib/auth-client";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import type { ProfileData } from "../types";
import {
  getProfileUpdateType,
  buildSessionUpdate,
  type UpdateProfilePayload,
} from "../utils/profile-helpers";
import { DEFAULT_QUERY_OPTIONS } from "@/lib/react-query/constants";
import { fetchWithErrorHandling } from "@/lib/api/client";

interface UpdateBusinessPayload {
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
}

// Query Key Factory
export const profileKeys = {
  all: ["profile"] as const,
  details: () => [...profileKeys.all, "detail"] as const,
  detail: (userId: string | undefined) => [...profileKeys.details(), userId] as const,
};

/**
 * Fetch profile data from API
 */
const fetchProfile = async (): Promise<ProfileData> => {
  return fetchWithErrorHandling<ProfileData>("/api/user/profile");
};

/**
 * Update user profile
 */
const updateProfile = async (payload: UpdateProfilePayload): Promise<ProfileData> => {
  return fetchWithErrorHandling<ProfileData>("/api/user/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

/**
 * Update business info
 */
const updateBusiness = async (payload: UpdateBusinessPayload): Promise<ProfileData> => {
  return fetchWithErrorHandling<ProfileData>("/api/user/business", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

/**
 * Hook to fetch and cache profile data using TanStack Query
 */
export const useProfile = () => {
  const { data: session, status } = useSession();

  return useQuery<ProfileData>({
    queryKey: profileKeys.detail(session?.user?.id),
    queryFn: fetchProfile,
    enabled: status === "authenticated" && !!session?.user?.id,
    ...DEFAULT_QUERY_OPTIONS.profile,
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
      // Determine update type for appropriate toast notification
      const updateType = getProfileUpdateType(variables);

      // Invalidate the profile query to trigger refetch
      await queryClient.invalidateQueries({
        queryKey: profileKeys.detail(user?.id),
      });

      // Build session update object (only includes changed fields)
      const sessionUpdate = buildSessionUpdate(data);

      // Only update session if there are changes
      if (Object.keys(sessionUpdate).length > 0) {
        await updateSession(sessionUpdate);
      }

      // Show toast notification based on update type
      // Only show toast once in the mutation hook to prevent duplicates
      switch (updateType) {
        case "avatar-removal":
          toast.success(t("profile.toasts.avatarRemoved.title"), {
            description: t("profile.toasts.avatarRemoved.description"),
          });
          break;
        case "avatar":
          toast.success(t("profile.toasts.avatarUpdated.title"), {
            description: t("profile.toasts.avatarUpdated.description"),
          });
          break;
        case "profile":
        default:
          toast.success(t("profile.toasts.profileUpdated.title"), {
            description: t("profile.toasts.profileUpdated.description"),
          });
          break;
      }
    },
    onError: (error) => {
      // Error toast is handled in the component that calls the mutation
      // This prevents duplicate error toasts
      // Only log in development to avoid console noise in production
      if (process.env.NODE_ENV === "development") {
        console.error("[useUpdateProfile] Profile update failed:", error);
      }
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
        queryKey: profileKeys.detail(user?.id),
      });
    },
  });
};
