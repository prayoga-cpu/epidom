import type { CSSProperties } from "react";
import { getContrastingInk, getPremiumTheme } from "@/lib/utils/color";
import type { StoreOverview } from "@/types/api/store-overview";
import type { Store } from "../hooks/use-stores";

/** Storefront.themeColor's own schema default — what a store with no storefront row gets. */
export const DEFAULT_STORE_THEME_COLOR = "#FF6B35";

export interface StoreCardBranding {
  /** Storefront cover, else the Store Image from the Create/Edit dialog, else null (tinted placeholder). */
  coverUrl: string | null;
  /** Storefront logo, else null (first-letter avatar). May be a base64 data: URI. */
  logoUrl: string | null;
  /** First character of the store name, upper-cased; "?" for a blank name. */
  initial: string;
  /** The brand colour clamped by getPremiumTheme, and a readable ink to draw on it. */
  brand: string;
  ink: string;
  /**
   * The only inline style the card and its chooser set: a store's colour is
   * known only at runtime, so it rides on two CSS custom properties and every
   * class reads them (bg-[var(--store-brand)] and friends).
   */
  brandStyle: CSSProperties;
}

/**
 * What a /stores card paints for one store. `overview` is that store's row
 * from GET /api/stores/overview, or null while it loads, when it failed, or
 * when the store has no row. "" counts as absent at every step: the storefront
 * editor saves "" when an image is cleared.
 *
 * The stored colour is not always clamped (onboarding can save #000000), so
 * it always goes through getPremiumTheme, then getContrastingInk.
 */
export function resolveStoreCardBranding(
  store: Pick<Store, "name" | "image">,
  overview: Pick<StoreOverview, "coverUrl" | "logoUrl" | "themeColor"> | null | undefined
): StoreCardBranding {
  const brand = getPremiumTheme(overview?.themeColor || DEFAULT_STORE_THEME_COLOR);
  const ink = getContrastingInk(brand);
  // Array.from splits by code point, so an emoji or accented first letter
  // stays whole instead of becoming half a surrogate pair.
  const first = Array.from((store.name ?? "").trim())[0];

  return {
    coverUrl: overview?.coverUrl || store.image || null,
    logoUrl: overview?.logoUrl || null,
    initial: first ? first.toUpperCase() : "?",
    brand,
    ink,
    brandStyle: { "--store-brand": brand, "--store-brand-ink": ink } as CSSProperties,
  };
}

/** Vercel Blob images go through next/image's optimiser; anything else is served as-is. */
export function isBlobHostedImage(url: string): boolean {
  return url.includes("blob.vercel-storage.com");
}
