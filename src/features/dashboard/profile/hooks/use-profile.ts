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
export const useProfile = (initialData?: ProfileData) => {
  const { data: session, status } = useSession();

  return useQuery<ProfileData>({
    queryKey: ["profile", session?.user?.id],
    queryFn: fetchProfile,
    enabled: status === "authenticated" && !!session?.user?.id,
    initialData, // ✅ Accept initial data from Server Component
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
      // Determine update type for appropriate toast notification
      const updateType = getProfileUpdateType(variables);

      // Invalidate the profile query to trigger refetch
      await queryClient.invalidateQueries({
        queryKey: ["profile", user?.id],
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
        queryKey: ["profile", user?.id],
      });
    },
  });
};
