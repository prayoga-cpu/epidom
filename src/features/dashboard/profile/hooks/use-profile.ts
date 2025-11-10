import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/lib/auth-client";
import { useSession } from "next-auth/react";
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

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: async (data) => {
      console.log("[useUpdateProfile] Profile updated successfully:", data);
      console.log("[useUpdateProfile] Profile image:", data.image);

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
