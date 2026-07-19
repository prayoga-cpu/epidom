import type { ProfileData } from "../types";

export interface UpdateProfilePayload {
  name?: string;
  phone?: string;
  locale?: string;
  timezone?: string;
  currency?: string;
  image?: string;
}

/**
 * Determine the type of profile update for appropriate toast notification
 *
 * @param variables - The update payload
 * @returns Update type: 'avatar' | 'avatar-removal' | 'profile'
 */
export function getProfileUpdateType(
  variables: UpdateProfilePayload
): "avatar" | "avatar-removal" | "profile" {
  // If no image update, it's a general profile update
  if (variables.image === undefined) {
    return "profile";
  }

  // Check if other fields are being updated (DRY - extract to avoid duplication)
  const otherFields: (keyof UpdateProfilePayload)[] = [
    "name",
    "phone",
    "locale",
    "timezone",
    "currency",
  ];
  const hasOtherFields = otherFields.some((field) => variables[field] !== undefined);

  // If image is being removed (empty string or null)
  if (variables.image === "" || variables.image === null) {
    return hasOtherFields ? "profile" : "avatar-removal";
  }

  // Image is being updated (not removed)
  return hasOtherFields ? "profile" : "avatar";
}

/**
 * Build session update object from profile data
 * Only includes fields that have values to avoid unnecessary updates
 *
 * @param data - Updated profile data
 * @returns Session update object with only changed fields
 */
export function buildSessionUpdate(data: ProfileData): Record<string, any> {
  const update: Record<string, any> = {};
  const fields: (keyof ProfileData)[] = ["currency", "locale", "timezone", "name", "phone"];

  fields.forEach((field) => {
    if (data[field] !== undefined && data[field] !== null) {
      update[field] = data[field];
    }
  });

  // Handle image: include null or empty string to remove image from session
  if (data.image !== undefined) {
    update.image = data.image || null; // Convert empty string to null
  }

  return update;
}
