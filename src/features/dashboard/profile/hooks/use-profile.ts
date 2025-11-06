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
  const { user, loading: sessionLoading } = useUser();

  return useQuery<ProfileData>({
    queryKey: ["profile", user?.id],
    queryFn: fetchProfile,
    enabled: !sessionLoading && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
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
      console.log("[useUpdateProfile] Updating session with currency:", data.currency);

      // Update the cached profile data
      queryClient.setQueryData(["profile", user?.id], data);

      // Update the NextAuth session to reflect new currency/locale
      // Only include fields that have values to avoid overwriting with null
      const sessionUpdate: Record<string, any> = {};

      if (data.currency) sessionUpdate.currency = data.currency;
      if (data.locale) sessionUpdate.locale = data.locale;
      if (data.timezone) sessionUpdate.timezone = data.timezone;
      if (data.name) sessionUpdate.name = data.name;
      if (data.phone) sessionUpdate.phone = data.phone;
      if (data.image) sessionUpdate.image = data.image; // Only update if image exists

      console.log("[useUpdateProfile] Session update payload:", sessionUpdate);
      await updateSession(sessionUpdate);
      console.log("[useUpdateProfile] Session updated successfully");

      // Force a small delay to ensure session propagates
      await new Promise((resolve) => setTimeout(resolve, 100));
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
    onSuccess: (data) => {
      // Update the cached profile data
      queryClient.setQueryData(["profile", user?.id], data);
    },
  });
};
