import { z } from "zod";
import type { OnboardingState } from "@/lib/onboarding/contracts";
import type { SaveStorefrontStepBody } from "./onboarding-api";

type Translate = (key: string) => string;

/** How many menu rows step 2 offers (the server accepts up to 3). */
export const ONBOARDING_MENU_ROWS = 3;
export const TAGLINE_MAX_LENGTH = 150;
const ITEM_NAME_MAX_LENGTH = 100;
/** MenuItem.price is Decimal(12, 2). */
const MAX_MENU_PRICE = 9_999_999_999.99;

/** The Epidom gold, as a storefront theme colour (the storefront stores a hex). */
export const EPIDOM_GOLD_HEX = "#D9AE3B";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** "#abc" → "#AABBCC"; anything that isn't a hex colour falls back to the Epidom gold. */
export function normalizeThemeColor(value: string | null | undefined): string {
  if (!value) return EPIDOM_GOLD_HEX;
  const short = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(value);
  if (short)
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase();
  return HEX_COLOR.test(value) ? value.toUpperCase() : EPIDOM_GOLD_HEX;
}

/**
 * Step 2's form: logo, theme colour, tagline and three menu rows. An empty
 * row is skipped; a named row needs a price, and a price needs a name (the
 * example prices are placeholders, never values).
 */
export function createStorefrontStepSchema(t: Translate) {
  const item = z.object({
    id: z.string().optional(),
    name: z
      .string()
      .max(
        ITEM_NAME_MAX_LENGTH,
        t("onboarding.storefront.menu.nameTooLong").replace("{max}", String(ITEM_NAME_MAX_LENGTH))
      ),
    price: z
      .number()
      .nonnegative(t("onboarding.storefront.menu.priceInvalid"))
      .max(MAX_MENU_PRICE, t("onboarding.storefront.menu.priceInvalid"))
      .optional(),
  });

  return z.object({
    logoUrl: z.string().optional(),
    themeColor: z.string().regex(HEX_COLOR, t("onboarding.storefront.theme.invalid")),
    tagline: z
      .string()
      .trim()
      .max(
        TAGLINE_MAX_LENGTH,
        t("onboarding.storefront.tagline.tooLong").replace("{max}", String(TAGLINE_MAX_LENGTH))
      ),
    menuItems: z.array(item).superRefine((items, ctx) => {
      items.forEach((row, index) => {
        const named = row.name.trim().length > 0;
        const priced = row.price !== undefined;
        if (named && !priced) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, "price"],
            message: t("onboarding.storefront.menu.priceRequired"),
          });
        }
        if (!named && priced) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, "name"],
            message: t("onboarding.storefront.menu.nameRequired"),
          });
        }
      });
    }),
  });
}

export type StorefrontStepFormInput = z.input<ReturnType<typeof createStorefrontStepSchema>>;
export type StorefrontStepFormValues = z.output<ReturnType<typeof createStorefrontStepSchema>>;

/** Step 2's form values from what the server saved, so a resumed step shows it. */
export function storefrontStepDefaults(state: OnboardingState): StorefrontStepFormInput {
  const rows = Array.from({ length: ONBOARDING_MENU_ROWS }, (_, index) => {
    const saved = state.menuItems[index];
    return saved
      ? { id: saved.id, name: saved.name, price: saved.price }
      : { id: undefined, name: "", price: undefined };
  });
  const logoUrl = state.storefront?.logoUrl;
  return {
    // Only uploaded (https) logos: the old wizard's inline base64 SVGs are
    // refused by the API, so one left on a draft is dropped here and cleared
    // on save instead of blocking the step.
    logoUrl: logoUrl && logoUrl.startsWith("https://") ? logoUrl : undefined,
    themeColor: normalizeThemeColor(state.storefront?.themeColor),
    tagline: state.storefront?.tagline ?? "",
    menuItems: rows,
  };
}

type MenuRow = StorefrontStepFormValues["menuItems"][number];

const isFilledRow = (row: MenuRow) => row.name.trim().length > 0 && row.price !== undefined;

/** The named rows, as the API wants them (ids kept so a resumed item is updated, not duplicated). */
export function menuItemsPayload(
  rows: StorefrontStepFormValues["menuItems"]
): SaveStorefrontStepBody["menuItems"] {
  return rows.filter(isFilledRow).map((row) => ({
    ...(row.id ? { id: row.id } : {}),
    name: row.name.trim(),
    price: row.price as number,
  }));
}

/**
 * Saved items whose row the owner emptied (a row filled from the server
 * keeps its id; a blank row with an id is one they cleared): the server
 * deletes them, so a dish removed here doesn't stay on the storefront.
 */
export function removedItemIds(rows: StorefrontStepFormValues["menuItems"]): string[] {
  return rows.filter((row) => row.id && !isFilledRow(row)).map((row) => row.id as string);
}

/** The body of step 2's Continue. */
export function storefrontPayload(values: StorefrontStepFormValues): SaveStorefrontStepBody {
  const removed = removedItemIds(values.menuItems);
  return {
    // "" clears a logo the owner removed; the server stores null.
    logoUrl: values.logoUrl ?? "",
    themeColor: values.themeColor,
    tagline: values.tagline,
    menuItems: menuItemsPayload(values.menuItems),
    ...(removed.length > 0 ? { removedItemIds: removed } : {}),
  };
}

/**
 * What step 2 hands the wizard on Back, so its unsaved input survives a trip
 * to step 1: the form's values, the server defaults they started from, and
 * the currency the prices were typed in.
 */
export interface StorefrontDraft {
  base: StorefrontStepFormInput;
  values: StorefrontStepFormInput;
  currency: string;
}

type InputRow = StorefrontStepFormInput["menuItems"][number];

const sameRow = (a: InputRow | undefined, b: InputRow | undefined) =>
  (a?.id ?? undefined) === (b?.id ?? undefined) &&
  (a?.name ?? "") === (b?.name ?? "") &&
  a?.price === b?.price;

/**
 * Step 2's defaults when it opens again after Back: every field the owner
 * changed comes from the draft, every other one from what the server has now
 * (step 1 may have saved a new logo, colour or tagline from Instagram in the
 * meantime). A drafted price typed in another currency (the country changed
 * on step 1) is dropped rather than read in the new one.
 */
export function storefrontDraftDefaults(
  state: OnboardingState,
  draft: StorefrontDraft | null | undefined
): StorefrontStepFormInput {
  const fresh = storefrontStepDefaults(state);
  if (!draft) return fresh;
  const { base, values } = draft;
  const sameCurrency = draft.currency === state.currency;
  const pick = <K extends "logoUrl" | "themeColor" | "tagline">(key: K) =>
    values[key] !== base[key] ? values[key] : fresh[key];

  return {
    logoUrl: pick("logoUrl"),
    themeColor: pick("themeColor"),
    tagline: pick("tagline"),
    menuItems: fresh.menuItems.map((freshRow, index) => {
      const row = values.menuItems[index];
      if (!row || sameRow(row, base.menuItems[index])) return freshRow;
      return {
        id: row.id,
        name: row.name ?? "",
        price: sameCurrency ? row.price : undefined,
      };
    }),
  };
}
