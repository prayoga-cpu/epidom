import { prisma } from "@/lib/prisma";
import { getStorageAdapter } from "@/lib/storage";
import { isOwnUpload } from "@/lib/utils/own-upload";
import {
  CUSTOMER_DISPLAY_DEFAULTS,
  CUSTOMER_DISPLAY_BACKGROUND_STYLES,
  CUSTOMER_DISPLAY_FONT_STYLES,
  CUSTOMER_DISPLAY_LOGO_SIZES,
  CUSTOMER_DISPLAY_ORDER_SIDES,
  CUSTOMER_DISPLAY_PANEL_STYLES,
  parseStoredBanners,
  type CustomerDisplaySettingsValues,
} from "@/lib/validation/customer-display.schemas";
import type { CustomerDisplayConfig } from "@/types/api/customer-display";

/** A stored string column back to its option, or the default if it no longer is one. */
function oneOf<T extends string>(options: readonly T[], value: string | null, fallback: T): T {
  return value !== null && (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** "otium.cafe", "@otium.cafe" or a full link → a full https link. */
export function instagramLinkOf(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@/, "").replace(/^(www\.)?instagram\.com\//i, "");
  return handle ? `https://instagram.com/${handle}` : null;
}

/** Null text means "use the translated default" — so "" is stored as null, never as "". */
function textOrNull(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * The display's full configuration: the store's saved settings (or the
 * defaults, for a store that never saved any) plus the branding it reuses
 * from the storefront and the receipt settings.
 */
export async function getCustomerDisplayConfig(storeId: string): Promise<CustomerDisplayConfig> {
  const [store, row] = await Promise.all([
    prisma.store.findUnique({
    where: { id: storeId },
    select: {
      name: true,
      image: true,
      storefront: {
        select: {
          displayName: true,
          logoUrl: true,
          themeColor: true,
          fontFamily: true,
          googleReviewUrl: true,
          googleReviewEnabled: true,
          instagramUrl: true,
        },
      },
      receiptSettings: { select: { wifiName: true, wifiPassword: true } },
    },
    }),
    // Read on its own, and never allowed to take the screen down: the customer
    // display is what a paying customer looks at, so a settings read that fails
    // (the table not migrated yet on a freshly reset branch, a blip) shows the
    // defaults — the screen as it was before this feature — rather than an error.
    prisma.customerDisplaySettings.findUnique({ where: { storeId } }).catch((error: unknown) => {
      console.error("[customer-display] settings read failed, using defaults", error);
      return null;
    }),
  ]);
  if (!store) {
    throw new Error("Store not found");
  }

  const d = CUSTOMER_DISPLAY_DEFAULTS;
  const settings: CustomerDisplaySettingsValues = row
    ? {
        themeColor: row.themeColor,
        backgroundStyle: oneOf(
          CUSTOMER_DISPLAY_BACKGROUND_STYLES,
          row.backgroundStyle,
          d.backgroundStyle
        ),
        backgroundImageUrl: row.backgroundImageUrl,
        backgroundDim: row.backgroundDim,
        backgroundBlur: row.backgroundBlur,
        panelStyle: oneOf(CUSTOMER_DISPLAY_PANEL_STYLES, row.panelStyle, d.panelStyle),
        fontStyle: row.fontStyle
          ? oneOf(CUSTOMER_DISPLAY_FONT_STYLES, row.fontStyle, "SANS")
          : null,
        logoUrl: row.logoUrl,
        logoSize: oneOf(CUSTOMER_DISPLAY_LOGO_SIZES, row.logoSize, d.logoSize),
        orderSide: oneOf(CUSTOMER_DISPLAY_ORDER_SIDES, row.orderSide, d.orderSide),
        welcomeTitle: row.welcomeTitle,
        welcomeMessage: row.welcomeMessage,
        thankYouTitle: row.thankYouTitle,
        thankYouMessage: row.thankYouMessage,
        thankYouSeconds: row.thankYouSeconds,
        showReviewQr: row.showReviewQr,
        showWifi: row.showWifi,
        showInstagramQr: row.showInstagramQr,
        qrisImageUrl: row.qrisImageUrl,
        idleSlideshow: row.idleSlideshow,
        bannersDuringOrder: row.bannersDuringOrder,
        slideSeconds: row.slideSeconds,
        banners: parseStoredBanners(row.banners),
      }
    : { ...d, banners: [] };

  const storefront = store.storefront;
  const wifiName = store.receiptSettings?.wifiName?.trim() || null;

  return {
    settings,
    branding: {
      storeName: storefront?.displayName || store.name,
      storefrontLogoUrl: storefront?.logoUrl ?? store.image ?? null,
      storefrontThemeColor: storefront?.themeColor ?? null,
      storefrontFontStyle: storefront?.fontFamily === "Mono" ? "MONO" : "SANS",
      googleReviewUrl:
        storefront?.googleReviewEnabled && storefront.googleReviewUrl
          ? storefront.googleReviewUrl
          : null,
      instagramUrl: instagramLinkOf(storefront?.instagramUrl),
      wifiName,
      wifiPassword: wifiName ? store.receiptSettings?.wifiPassword || null : null,
    },
    updatedAt: row ? row.updatedAt.toISOString() : null,
  };
}

/** Every uploaded image a config points at. */
export function customerDisplayImageUrls(values: {
  backgroundImageUrl: string | null;
  logoUrl: string | null;
  qrisImageUrl: string | null;
  banners: unknown;
}): Set<string> {
  const urls = new Set<string>();
  for (const url of [values.backgroundImageUrl, values.logoUrl, values.qrisImageUrl]) {
    if (url) urls.add(url);
  }
  for (const banner of parseStoredBanners(values.banners)) urls.add(banner.imageUrl);
  return urls;
}

/**
 * Replaces the whole configuration (the editor always sends all of it), then
 * removes the uploads the new one no longer uses. Removal waits for the save on
 * purpose: the editor never deletes a file itself, so a replaced background or a
 * banner removed and then not saved is still on the live screen, intact.
 * Best effort and only for the acting user's own uploads (isOwnUpload) — a
 * leaked blob is a storage nuisance, a failed save would be lost work.
 */
export async function updateCustomerDisplaySettings(
  storeId: string,
  input: CustomerDisplaySettingsValues,
  options: { userId?: string } = {}
): Promise<CustomerDisplayConfig> {
  const previous = await prisma.customerDisplaySettings.findUnique({
    where: { storeId },
    select: { backgroundImageUrl: true, logoUrl: true, qrisImageUrl: true, banners: true },
  });

  const data = {
    ...input,
    welcomeTitle: textOrNull(input.welcomeTitle),
    welcomeMessage: textOrNull(input.welcomeMessage),
    thankYouTitle: textOrNull(input.thankYouTitle),
    thankYouMessage: textOrNull(input.thankYouMessage),
    banners: input.banners,
  };
  await prisma.customerDisplaySettings.upsert({
    where: { storeId },
    create: { storeId, ...data },
    update: data,
  });

  const userId = options.userId;
  if (previous && userId) {
    const kept = customerDisplayImageUrls(data);
    const dropped = [...customerDisplayImageUrls(previous)].filter(
      (url) => !kept.has(url) && isOwnUpload(url, userId)
    );
    await Promise.all(
      dropped.map((url) =>
        getStorageAdapter()
          .delete(url)
          .catch(() => {
            // Left in storage; nothing points at it any more.
          })
      )
    );
  }

  return getCustomerDisplayConfig(storeId);
}
