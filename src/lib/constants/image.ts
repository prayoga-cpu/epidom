/**
 * Shared Image Upload Constants
 *
 * Single source of truth for the image-compression rule that applies to
 * every image upload surface (avatars, logos, menu photos, selfies, store
 * images, feedback screenshots, etc.) and to any new one added later — see
 * "Images" under AGENTS.md § 6. Client and server both import from here so
 * the two enforcement layers can never drift apart.
 */

/** Longest edge (px) an uploaded image is resized to. Never upscales. */
export const IMAGE_MAX_DIMENSION_PX = 1600;

/** Default guaranteed output size (MB) after compression. */
export const IMAGE_DEFAULT_TARGET_MB = 2;

/** Absolute ceiling (MB) a feature is allowed to request as its compression target. */
export const IMAGE_MAX_TARGET_MB = 5;

/** Floor (MB) for a requested compression target, to keep quality reasonable. */
export const IMAGE_MIN_TARGET_MB = 0.5;

/**
 * Ceiling (MB) for the raw file a user selects, before compression runs.
 * This bounds processing cost — it is not the guaranteed final size.
 */
export const IMAGE_RAW_UPLOAD_MAX_MB = 5;
export const IMAGE_RAW_UPLOAD_MAX_BYTES = IMAGE_RAW_UPLOAD_MAX_MB * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/** Clamp a requested compression target into the safe [min, max] range. */
export function clampTargetMB(value: number | null | undefined): number {
  if (!Number.isFinite(value) || value == null) return IMAGE_DEFAULT_TARGET_MB;
  return Math.min(Math.max(value, IMAGE_MIN_TARGET_MB), IMAGE_MAX_TARGET_MB);
}
