import { z } from "zod";
import { isOwnUploadUrl } from "@/lib/utils/own-upload";

/**
 * The customer display's store-wide look and promotions (CustomerDisplaySettings).
 *
 * The editor sends the WHOLE object on every save, so the schema has no
 * optional fields: a field it leaves out is a bug, not "keep what's stored".
 * No transforms either: react-hook-form validates with this same schema, and a
 * transform would make its input and output types disagree.
 */

export const CUSTOMER_DISPLAY_BACKGROUND_STYLES = ["GRADIENT", "SOLID", "IMAGE"] as const;
export const CUSTOMER_DISPLAY_PANEL_STYLES = ["GLASS", "SOLID"] as const;
export const CUSTOMER_DISPLAY_FONT_STYLES = ["SANS", "SERIF", "ROUNDED", "MONO"] as const;
export const CUSTOMER_DISPLAY_LOGO_SIZES = ["S", "M", "L"] as const;
export const CUSTOMER_DISPLAY_ORDER_SIDES = ["LEFT", "RIGHT"] as const;

export type CustomerDisplayBackgroundStyle = (typeof CUSTOMER_DISPLAY_BACKGROUND_STYLES)[number];
export type CustomerDisplayPanelStyle = (typeof CUSTOMER_DISPLAY_PANEL_STYLES)[number];
export type CustomerDisplayFontStyle = (typeof CUSTOMER_DISPLAY_FONT_STYLES)[number];
export type CustomerDisplayLogoSize = (typeof CUSTOMER_DISPLAY_LOGO_SIZES)[number];
export type CustomerDisplayOrderSide = (typeof CUSTOMER_DISPLAY_ORDER_SIDES)[number];

/** Enough for a week of rotating promotions; a screen cycling more than this
 * shows each one too rarely to be worth it. */
export const CUSTOMER_DISPLAY_MAX_BANNERS = 20;

export const CUSTOMER_DISPLAY_LIMITS = {
  backgroundDim: { min: 0, max: 90 },
  backgroundBlur: { min: 0, max: 24 },
  thankYouSeconds: { min: 5, max: 60 },
  slideSeconds: { min: 3, max: 60 },
  titleMax: 60,
  messageMax: 160,
  bannerLabelMax: 80,
} as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid colour");
// Only our own upload hosts: this URL is rendered as an <img> on a screen
// facing the public, and is never fetched server-side.
const uploadUrl = z.string().max(2048).refine(isOwnUploadUrl, "Invalid image URL");
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time");

export const customerDisplayBannerSchema = z
  .object({
    /** Client-generated, only for list keys and reordering. */
    id: z.string().min(1).max(64),
    imageUrl: uploadUrl,
    /** For the owner's list only; also the image's alt text. */
    label: z.string().trim().max(CUSTOMER_DISPLAY_LIMITS.bannerLabelMax),
    active: z.boolean(),
    /** Inclusive, in the display device's local calendar. Null = open-ended. */
    startDate: isoDay.nullable(),
    endDate: isoDay.nullable(),
    /** 0 = Sunday ... 6 = Saturday. Empty = every day. */
    days: z.array(z.number().int().min(0).max(6)).max(7),
    /** Daily window, device-local. Both null = all day. An end before the
     * start wraps past midnight (22:00-02:00). */
    startTime: clock.nullable(),
    endTime: clock.nullable(),
  })
  .refine((b) => !b.startDate || !b.endDate || b.startDate <= b.endDate, {
    message: "End date is before start date",
    path: ["endDate"],
  })
  .refine((b) => (b.startTime === null) === (b.endTime === null), {
    message: "Set both times, or neither",
    path: ["endTime"],
  });

export type CustomerDisplayBanner = z.infer<typeof customerDisplayBannerSchema>;

export const customerDisplaySettingsSchema = z.object({
  themeColor: hexColor.nullable(),
  backgroundStyle: z.enum(CUSTOMER_DISPLAY_BACKGROUND_STYLES),
  backgroundImageUrl: uploadUrl.nullable(),
  backgroundDim: z
    .number()
    .int()
    .min(CUSTOMER_DISPLAY_LIMITS.backgroundDim.min)
    .max(CUSTOMER_DISPLAY_LIMITS.backgroundDim.max),
  backgroundBlur: z
    .number()
    .int()
    .min(CUSTOMER_DISPLAY_LIMITS.backgroundBlur.min)
    .max(CUSTOMER_DISPLAY_LIMITS.backgroundBlur.max),
  panelStyle: z.enum(CUSTOMER_DISPLAY_PANEL_STYLES),
  fontStyle: z.enum(CUSTOMER_DISPLAY_FONT_STYLES).nullable(),
  logoUrl: uploadUrl.nullable(),
  logoSize: z.enum(CUSTOMER_DISPLAY_LOGO_SIZES),
  orderSide: z.enum(CUSTOMER_DISPLAY_ORDER_SIDES),
  welcomeTitle: z.string().trim().max(CUSTOMER_DISPLAY_LIMITS.titleMax).nullable(),
  welcomeMessage: z.string().trim().max(CUSTOMER_DISPLAY_LIMITS.messageMax).nullable(),
  thankYouTitle: z.string().trim().max(CUSTOMER_DISPLAY_LIMITS.titleMax).nullable(),
  thankYouMessage: z.string().trim().max(CUSTOMER_DISPLAY_LIMITS.messageMax).nullable(),
  thankYouSeconds: z
    .number()
    .int()
    .min(CUSTOMER_DISPLAY_LIMITS.thankYouSeconds.min)
    .max(CUSTOMER_DISPLAY_LIMITS.thankYouSeconds.max),
  showReviewQr: z.boolean(),
  showWifi: z.boolean(),
  showInstagramQr: z.boolean(),
  qrisImageUrl: uploadUrl.nullable(),
  idleSlideshow: z.boolean(),
  bannersDuringOrder: z.boolean(),
  slideSeconds: z
    .number()
    .int()
    .min(CUSTOMER_DISPLAY_LIMITS.slideSeconds.min)
    .max(CUSTOMER_DISPLAY_LIMITS.slideSeconds.max),
  banners: z.array(customerDisplayBannerSchema).max(CUSTOMER_DISPLAY_MAX_BANNERS),
});

/** Named "Values" so it never shadows the Prisma model type of the same table. */
export type CustomerDisplaySettingsValues = z.infer<typeof customerDisplaySettingsSchema>;

/** What a store with no row gets — the screen exactly as it looked before any of this. */
export const CUSTOMER_DISPLAY_DEFAULTS: CustomerDisplaySettingsValues = {
  themeColor: null,
  backgroundStyle: "GRADIENT",
  backgroundImageUrl: null,
  backgroundDim: 45,
  backgroundBlur: 0,
  panelStyle: "GLASS",
  fontStyle: null,
  logoUrl: null,
  logoSize: "M",
  orderSide: "RIGHT",
  welcomeTitle: null,
  welcomeMessage: null,
  thankYouTitle: null,
  thankYouMessage: null,
  thankYouSeconds: 12,
  showReviewQr: true,
  showWifi: true,
  showInstagramQr: false,
  qrisImageUrl: null,
  idleSlideshow: true,
  bannersDuringOrder: true,
  slideSeconds: 8,
  banners: [],
};

/**
 * Banners as stored (a JSON column), dropping any entry that no longer passes
 * the schema rather than failing the whole screen over one bad row — a display
 * must always come up.
 */
export function parseStoredBanners(raw: unknown): CustomerDisplayBanner[] {
  if (!Array.isArray(raw)) return [];
  const banners: CustomerDisplayBanner[] = [];
  for (const entry of raw) {
    const parsed = customerDisplayBannerSchema.safeParse(entry);
    if (parsed.success) banners.push(parsed.data);
  }
  return banners.slice(0, CUSTOMER_DISPLAY_MAX_BANNERS);
}
