import type React from "react";
import { getContrastingInk, getPremiumTheme } from "@/lib/utils/color";
import type {
  CustomerDisplayBanner,
  CustomerDisplayFontStyle,
  CustomerDisplayLogoSize,
} from "@/lib/validation/customer-display.schemas";
import type { CustomerDisplayConfig } from "@/types/api/customer-display";

/**
 * Pure helpers behind the customer display's store-wide look and promo
 * banners. Shared by the live screen and the Store Dashboard's preview, so
 * the preview can never drift from what the customer actually sees.
 */

const FALLBACK_THEME = "#FF6B35";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** "YYYY-MM-DD" in the device's own calendar — the screen is in the shop. */
export function localDayOf(now: Date): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** "HH:mm" on the device's own clock. */
export function localClockOf(now: Date): string {
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

/**
 * Whether a banner should be in rotation right now. Dates are inclusive; the
 * daily window is [start, end) and wraps past midnight when the end comes
 * first (22:00-02:00). A window whose start equals its end means all day.
 * The weekday is the one on the clock now, so 01:00 on a Saturday counts as
 * Saturday even inside a window that opened on Friday night.
 */
export function isBannerLive(banner: CustomerDisplayBanner, now: Date): boolean {
  if (!banner.active) return false;
  const day = localDayOf(now);
  if (banner.startDate && day < banner.startDate) return false;
  if (banner.endDate && day > banner.endDate) return false;
  if (banner.days.length > 0 && !banner.days.includes(now.getDay())) return false;
  const { startTime, endTime } = banner;
  if (startTime && endTime && startTime !== endTime) {
    const clock = localClockOf(now);
    const inWindow =
      startTime < endTime
        ? clock >= startTime && clock < endTime
        : clock >= startTime || clock < endTime;
    if (!inWindow) return false;
  }
  return true;
}

export function liveBannersOf(
  banners: readonly CustomerDisplayBanner[],
  now: Date
): CustomerDisplayBanner[] {
  return banners.filter((banner) => isBannerLive(banner, now));
}

export const CUSTOMER_DISPLAY_FONT_STACKS: Record<CustomerDisplayFontStyle, string> = {
  SANS: "var(--font-sans)",
  SERIF: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  ROUNDED: 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, sans-serif',
  MONO: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
};

/** Logo caps as a share of the panel it sits in (S / M / L). */
export const CUSTOMER_DISPLAY_LOGO_SCALE: Record<CustomerDisplayLogoSize, number> = {
  S: 0.4,
  M: 0.6,
  L: 0.85,
};

export interface CustomerDisplayLook {
  /** CSS variables (and the background, for GRADIENT / SOLID) for the root. */
  style: React.CSSProperties;
  /** IMAGE only: the photo layer, drawn under a wash of the theme colour. */
  backgroundImage: { url: string; blur: number; dim: number } | null;
  /** The logo to show: the display's own override, else the storefront's. */
  logoUrl: string | null;
  storeName: string;
}

/**
 * Colours, background and font for one config. Ink is chosen against the
 * theme colour, which is why an IMAGE background is always washed with that
 * colour (the dim slider) rather than shown raw: text drawn on an arbitrary
 * photo has no colour that is guaranteed to read.
 */
export function resolveCustomerDisplayLook(config: CustomerDisplayConfig): CustomerDisplayLook {
  const { settings, branding } = config;
  const theme = getPremiumTheme(
    settings.themeColor || branding.storefrontThemeColor || FALLBACK_THEME
  );
  const ink = getContrastingInk(theme);
  // A pale brand colour gets dark ink, so the gradient has to deepen *away*
  // from that ink (toward white) or the bottom of the screen goes unreadable.
  const depth = ink === "#FFFFFF" ? "black" : "white";
  const font = CUSTOMER_DISPLAY_FONT_STACKS[settings.fontStyle ?? branding.storefrontFontStyle];

  const imageMode = settings.backgroundStyle === "IMAGE" && !!settings.backgroundImageUrl;
  const solidPanels = settings.panelStyle === "SOLID";

  const background = imageMode
    ? theme
    : settings.backgroundStyle === "SOLID"
      ? theme
      : `linear-gradient(155deg, ${theme}, color-mix(in srgb, ${theme} 60%, ${depth}))`;

  // Glass over a photo needs more body than glass over a flat colour, or the
  // photo's detail shows straight through the receipt.
  const panel = solidPanels
    ? `color-mix(in srgb, ${theme} 86%, ${ink})`
    : imageMode
      ? `color-mix(in srgb, ${theme} 62%, transparent)`
      : `color-mix(in srgb, ${ink} 10%, transparent)`;
  const panelStrong = solidPanels
    ? `color-mix(in srgb, ${theme} 74%, ${ink})`
    : `color-mix(in srgb, ${ink} 18%, transparent)`;

  return {
    style: {
      "--cfd-ink": ink,
      // Text that sits on top of an ink-filled surface (the confirm button).
      "--cfd-on-ink": ink === "#FFFFFF" ? theme : "#FFFFFF",
      "--cfd-theme": theme,
      "--cfd-panel": panel,
      "--cfd-panel-strong": panelStrong,
      "--cfd-border": `color-mix(in srgb, ${ink} 16%, transparent)`,
      "--cfd-total": solidPanels
        ? `color-mix(in srgb, ${theme} 66%, ${ink})`
        : `color-mix(in srgb, ${ink} 22%, transparent)`,
      // Set as `background` rather than a Tailwind arbitrary class: a gradient
      // through a CSS var would emit background-COLOR.
      background,
      fontFamily: font,
    } as React.CSSProperties,
    backgroundImage: imageMode
      ? {
          url: settings.backgroundImageUrl!,
          blur: settings.backgroundBlur,
          dim: settings.backgroundDim,
        }
      : null,
    logoUrl: settings.logoUrl || branding.storefrontLogoUrl,
    storeName: branding.storeName,
  };
}
