export const FEATURE_FLAGS = {
  LEGACY_INVENTORY: process.env.NEXT_PUBLIC_FEATURE_LEGACY_INVENTORY === "true",
  POS: process.env.NEXT_PUBLIC_FEATURE_POS !== "false", // ON by default
  OPERATIONS: process.env.NEXT_PUBLIC_FEATURE_OPERATIONS !== "false", // ON by default — plan gate enforced server-side
  ENTERPRISE: process.env.NEXT_PUBLIC_FEATURE_ENTERPRISE !== "false", // ON by default — plan gate enforced server-side
} as const;
