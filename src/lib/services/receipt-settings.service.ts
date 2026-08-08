import { prisma } from "@/lib/prisma";
import type { UpdateReceiptSettingsInput } from "@/lib/validation/receipt-settings.schemas";

/**
 * Everything a receipt (printed, public page, or WhatsApp preview) needs to
 * render its branding block — merged from Store (address/email/phone),
 * Storefront (tagline/Instagram/TikTok, when a storefront exists), and
 * StoreReceiptSettings (the receipt-only overrides: footer message, Facebook,
 * social-links visibility, WhatsApp auto-send toggle). A store with no
 * storefront simply resolves those fields to null — no dead inputs to fill
 * in for a cash-only stall.
 */
export interface ReceiptBrandingDto {
  storeId: string;
  storeName: string;
  tagline: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  facebookHandle: string | null;
  footerMessage: string | null;
  showSocialLinks: boolean;
  autoSendWhatsappReceipt: boolean;
}

// "https://instagram.com/tahoma.cafe/" -> "tahoma.cafe". Falls back to the
// raw value if it isn't a URL (a merchant may just type the handle directly).
function extractHandle(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim().replace(/^@/, "");
  if (!trimmed) return null;
  try {
    const { pathname } = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const segment = pathname.split("/").filter(Boolean).pop();
    return segment || null;
  } catch {
    return trimmed;
  }
}

export async function getReceiptBranding(storeId: string): Promise<ReceiptBrandingDto> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      name: true,
      address: true,
      city: true,
      country: true,
      email: true,
      phone: true,
      storefront: {
        select: { tagline: true, instagramUrl: true, tiktokUrl: true },
      },
      receiptSettings: {
        select: {
          footerMessage: true,
          facebookUrl: true,
          showSocialLinks: true,
          autoSendWhatsappReceipt: true,
        },
      },
    },
  });
  if (!store) {
    throw new Error("Store not found");
  }

  const addressParts = [store.address, [store.city, store.country].filter(Boolean).join(", ")]
    .map((p) => p?.trim())
    .filter(Boolean);

  return {
    storeId,
    storeName: store.name,
    tagline: store.storefront?.tagline ?? null,
    address: addressParts.length > 0 ? addressParts.join("\n") : null,
    email: store.email ?? null,
    phone: store.phone ?? null,
    instagramHandle: extractHandle(store.storefront?.instagramUrl),
    tiktokHandle: extractHandle(store.storefront?.tiktokUrl),
    facebookHandle: extractHandle(store.receiptSettings?.facebookUrl),
    footerMessage: store.receiptSettings?.footerMessage ?? null,
    showSocialLinks: store.receiptSettings?.showSocialLinks ?? true,
    autoSendWhatsappReceipt: store.receiptSettings?.autoSendWhatsappReceipt ?? true,
  };
}

export async function updateReceiptSettings(
  storeId: string,
  input: UpdateReceiptSettingsInput
): Promise<ReceiptBrandingDto> {
  const hasFieldUpdates = Object.keys(input).length > 0;
  if (hasFieldUpdates) {
    await prisma.storeReceiptSettings.upsert({
      where: { storeId },
      create: {
        storeId,
        ...(input.footerMessage !== undefined && { footerMessage: input.footerMessage }),
        ...(input.facebookUrl !== undefined && { facebookUrl: input.facebookUrl }),
        ...(input.showSocialLinks !== undefined && { showSocialLinks: input.showSocialLinks }),
        ...(input.autoSendWhatsappReceipt !== undefined && {
          autoSendWhatsappReceipt: input.autoSendWhatsappReceipt,
        }),
      },
      update: {
        ...(input.footerMessage !== undefined && { footerMessage: input.footerMessage }),
        ...(input.facebookUrl !== undefined && { facebookUrl: input.facebookUrl }),
        ...(input.showSocialLinks !== undefined && { showSocialLinks: input.showSocialLinks }),
        ...(input.autoSendWhatsappReceipt !== undefined && {
          autoSendWhatsappReceipt: input.autoSendWhatsappReceipt,
        }),
      },
    });
  }

  return getReceiptBranding(storeId);
}
