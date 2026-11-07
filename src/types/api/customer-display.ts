import type {
  CustomerDisplayFontStyle,
  CustomerDisplaySettingsValues,
} from "@/lib/validation/customer-display.schemas";

/**
 * What the store already has elsewhere that the customer display reuses rather
 * than asking for again: the storefront's name, logo and colour, its Google
 * review link and Instagram, and the receipt's guest WiFi.
 */
export interface CustomerDisplayBranding {
  storeName: string;
  storefrontLogoUrl: string | null;
  storefrontThemeColor: string | null;
  /** The storefront's font, mapped onto the display's choices. */
  storefrontFontStyle: CustomerDisplayFontStyle;
  /** Null when there is no link, or Google reviews are paused on the storefront. */
  googleReviewUrl: string | null;
  /** Always a full https:// URL (the storefront field also accepts a bare handle). */
  instagramUrl: string | null;
  wifiName: string | null;
  wifiPassword: string | null;
}

/** GET/PUT /api/stores/[id]/customer-display */
export interface CustomerDisplayConfig {
  settings: CustomerDisplaySettingsValues;
  branding: CustomerDisplayBranding;
  /** ISO time of the last save; null when the store never saved one. */
  updatedAt: string | null;
}
