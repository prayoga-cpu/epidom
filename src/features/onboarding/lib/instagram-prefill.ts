import { onboardingStoreStepSchema } from "@/lib/validation/onboarding.schemas";
import { STORE_SLUG_MAX_LENGTH, isValidStoreSlug, slugifyStoreLink } from "./store-link";

/** What the Instagram screenshot reader hands back to the wizard. */
export interface InstagramPrefill {
  name: string;
  tagline: string;
  slugCandidate: string | null;
  instagramUrl: string | null;
  whatsappNumber: string | null;
  themeColor: string | null;
  logoUrl: string | null;
  bio: string | null;
  category: string | null;
}

/** The optional fields the Instagram shortcut adds to step 1's POST body. */
export interface StoreStepExtras {
  tagline?: string;
  logoUrl?: string;
  themeColor?: string;
  instagramUrl?: string;
  whatsappNumber?: string;
}

const shape = onboardingStoreStepSchema.shape;

/**
 * A phone number read off a screenshot ("+62 812-3456-7890", "0033 6 12 34
 * 56 78") in the form the server accepts (+ and digits, E.164 length), or
 * null when it can't be one. A local number without a country code ("0812…")
 * is dropped rather than guessed.
 */
export function normalizeWhatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().replace(/[\s().\-/]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  return /^\+?[1-9]\d{1,14}$/.test(value) ? value : null;
}

/**
 * The extras worth sending with step 1, each one checked against the
 * server's own schema so a value the reader got slightly wrong is left out
 * instead of making the whole step fail validation.
 */
export function extrasFromInstagram(prefill: InstagramPrefill | null): StoreStepExtras {
  if (!prefill) return {};
  const extras: StoreStepExtras = {};

  const tagline = prefill.tagline.trim().slice(0, 150);
  if (tagline && shape.tagline.safeParse(tagline).success) extras.tagline = tagline;

  if (prefill.logoUrl && shape.logoUrl.safeParse(prefill.logoUrl).success) {
    extras.logoUrl = prefill.logoUrl;
  }
  if (prefill.themeColor && shape.themeColor.safeParse(prefill.themeColor).success) {
    extras.themeColor = prefill.themeColor;
  }
  if (prefill.instagramUrl && shape.instagramUrl.safeParse(prefill.instagramUrl).success) {
    extras.instagramUrl = prefill.instagramUrl;
  }
  const whatsapp = normalizeWhatsappNumber(prefill.whatsappNumber);
  if (whatsapp && shape.whatsappNumber.safeParse(whatsapp).success) {
    extras.whatsappNumber = whatsapp;
  }
  return extras;
}

/** The Instagram handle as a store link, when it makes a valid one. */
export function slugFromInstagram(prefill: InstagramPrefill | null): string | null {
  if (!prefill?.slugCandidate) return null;
  const slug = slugifyStoreLink(prefill.slugCandidate).slice(0, STORE_SLUG_MAX_LENGTH);
  return isValidStoreSlug(slug) ? slug : null;
}
