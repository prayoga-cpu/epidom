/**
 * Setup wizard (/onboarding) backend.
 *
 * Three steps, each saved server-side so the wizard can be resumed from any
 * device (shapes in src/lib/onboarding/contracts.ts, request bodies in
 * src/lib/validation/onboarding.schemas.ts):
 *
 *   1. saveStoreStep      — business + first store + OWNER staff row + FREE
 *                           plan + finance settings + draft storefront
 *   2. saveStorefrontStep — logo / colour / tagline + up to 3 menu items
 *   3. completeOnboarding — goals, publish, User.hasOnboarded
 *
 * Every read and write here is keyed on the caller's own userId (the business
 * is `where: { userId }`, the store is the oldest store of that business, the
 * storefront is that store's), so a request can never reach another tenant's
 * rows no matter what ids it carries.
 *
 * Ordering rule that matters: a store's finance settings (currency) are
 * written in step 1, before step 2 creates any menu item, because
 * MenuItem.currency is fixed when the item is created.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api/responses";
import type { Locale } from "@/components/lang/i18n-provider";
import { PAYMENT_METHODS_BY_MARKET } from "@/config/payment-fees.config";
import { LOCALE_HEADER, LOCALE_PREF_COOKIE } from "@/lib/i18n-routing";
import {
  ONBOARDING_GOALS,
  ONBOARDING_STEP,
  type OnboardingCompleteResult,
  type OnboardingGoal,
  type OnboardingState,
  type OnboardingStepNumber,
  type SlugCheckResult,
} from "@/lib/onboarding/contracts";
import {
  OTHER_COUNTRY_CODE,
  countryCodeFromName,
  getCountry,
  guessCountryCode,
  isBusinessType,
  resolveMarketDefaults,
} from "@/lib/onboarding/markets";
import type {
  OnboardingCompleteInput,
  OnboardingStoreStepInput,
  OnboardingStorefrontStepInput,
} from "@/lib/validation/onboarding.schemas";
import { getStorageAdapter } from "@/lib/storage";
import { getFinanceSettings } from "./finance-settings.service";
import { storefrontService } from "./storefront.service";
import { subscriptionService } from "./subscription.service";

// ============================================================================
// Errors
// ============================================================================

/**
 * `error.details.reason` on every 409 this service throws, so the wizard can
 * branch without string-matching the English message.
 */
export const ONBOARDING_CONFLICT_REASON = {
  /** A step was saved before the one it depends on (e.g. step 2 with no store). */
  stepOrder: "step_order",
  /** The custom store link is taken; `details.suggestion` carries a free one. */
  slugTaken: "slug_taken",
  /** Setup is already finished; step 1 can't rewrite a live store. */
  alreadyCompleted: "already_completed",
} as const;

function stepOrderError(message: string): AppError {
  return new AppError(message, ApiErrorCode.CONFLICT, 409, {
    reason: ONBOARDING_CONFLICT_REASON.stepOrder,
  });
}

function slugTakenError(slug: string, suggestion: string): AppError {
  return new AppError("This store link is already taken.", ApiErrorCode.CONFLICT, 409, {
    reason: ONBOARDING_CONFLICT_REASON.slugTaken,
    slug,
    suggestion,
  });
}

function alreadyCompletedError(): AppError {
  return new AppError(
    "Setup is already complete. Edit your store from the Back Office instead.",
    ApiErrorCode.CONFLICT,
    409,
    { reason: ONBOARDING_CONFLICT_REASON.alreadyCompleted }
  );
}

// ============================================================================
// Small helpers
// ============================================================================

const LOCALES: readonly Locale[] = ["en", "fr", "id"];

function asLocale(value: string | null | undefined): Locale | null {
  return value && (LOCALES as readonly string[]).includes(value) ? (value as Locale) : null;
}

function isGoal(value: string): value is OnboardingGoal {
  return (ONBOARDING_GOALS as readonly string[]).includes(value);
}

function clampStep(step: number | null | undefined): OnboardingStepNumber {
  const value = Math.min(
    Math.max(step ?? ONBOARDING_STEP.store, ONBOARDING_STEP.store),
    ONBOARDING_STEP.goals
  );
  return value as OnboardingStepNumber;
}

function normalizeItemName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

/** MenuItem.price is Decimal(12, 2): round to cents and refuse what can't be stored. */
const MAX_MENU_PRICE = 9_999_999_999.99;
function toMenuPrice(price: number): number {
  if (price > MAX_MENU_PRICE) {
    throw new ValidationError("Price is too large", [
      { field: "menuItems.price", message: "Price is too large" },
    ]);
  }
  return Math.round(price * 100) / 100;
}

/**
 * The owner's UI language as the request carries it: the `x-epidom-locale`
 * header (the wizard sends it; API routes never pass through the proxy, so
 * nothing else sets it), else the marketing site's explicit language pick
 * cookie. Null when neither is present; the service then falls back to
 * User.locale. Only matters for "Other" countries, whose customer-facing
 * language can't be derived from the country.
 */
export function uiLocaleFromRequest(request: Request): Locale | null {
  const fromHeader = asLocale(request.headers.get(LOCALE_HEADER)?.trim().toLowerCase());
  if (fromHeader) return fromHeader;

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === LOCALE_PREF_COOKIE) {
      try {
        return asLocale(decodeURIComponent(rest.join("=")).trim().toLowerCase());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** A file the caller uploaded through /api/upload (stored under users/<userId>/). */
function isOwnUpload(url: string, userId: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".public.blob.vercel-storage.com") &&
      parsed.pathname.startsWith(`/users/${userId}/`)
    );
  } catch {
    return false;
  }
}

/**
 * Deletes the storefront logo the owner just replaced or removed, once the
 * new value is saved. The wizard's uploader never deletes a file itself (its
 * Skip and Back save nothing, so the old file may still be the saved one),
 * so the old file is cleaned up here instead. Only the caller's own uploads,
 * and best effort: an orphaned file is harmless, a failed delete never fails
 * the step.
 */
async function deleteReplacedLogo(
  userId: string,
  previous: string | null | undefined,
  next: string | null
): Promise<void> {
  if (!previous || previous === next || !isOwnUpload(previous, userId)) return;
  try {
    await getStorageAdapter().delete(previous);
  } catch {
    // Left in storage; nothing points at it any more.
  }
}

/** Absolute public storefront URL (https://epidom.fr/@slug), built from NEXT_PUBLIC_APP_URL. */
export function publicStorefrontUrl(slug: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/@${slug}`;
}

/**
 * Name of the category the wizard's menu items go into, in the business's
 * language. Stored data (the owner can rename it), not UI copy.
 */
export const DEFAULT_MENU_CATEGORY_NAME: Record<Locale, string> = {
  fr: "Nos incontournables",
  id: "Rekomendasi",
  en: "Recommendations",
};

// ============================================================================
// Slugs
// ============================================================================

const SLUG_MIN = 3;
const SLUG_MAX = 50;

/**
 * Store link from a name: accents stripped ("Crêperie du Port" ->
 * "creperie-du-port"), French/German ligatures spelled out ("Cœur" -> "coeur"),
 * anything else that isn't [a-z0-9] becomes a dash, dashes collapsed and
 * trimmed, at most 50 characters. When the result is shorter than 3
 * characters and a storeId is given, falls back to "store-" + the first 5
 * characters of the storeId; without one the short result is returned as is
 * (callers treat it as invalid).
 */
export function slugify(text: string, storeId?: string): string {
  const slug = text
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");

  if (slug.length >= SLUG_MIN || !storeId) return slug;
  return `store-${storeId.slice(0, 5).toLowerCase()}`;
}

function isValidSlug(slug: string): boolean {
  return slug.length >= SLUG_MIN && slug.length <= SLUG_MAX && /^[a-z0-9-]+$/.test(slug);
}

/** `root` + `suffix`, cutting `root` so the whole thing stays within 50 characters. */
function withSuffix(root: string, suffix: string): string {
  return `${root.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, "")}${suffix}`;
}

/**
 * First free slug among `base`, `base-2`, `base-3`… (then random suffixes if
 * those twenty are all taken). A slug held by `excludeStorefrontId` counts as
 * free — that is the caller's own storefront keeping its link. One query per
 * batch of candidates.
 */
export async function findAvailableSlug(
  base: string,
  excludeStorefrontId?: string | null
): Promise<string> {
  const root = slugify(base) || "store";

  for (let batch = 0; batch < 5; batch++) {
    const candidates =
      batch === 0
        ? [
            ...(isValidSlug(root) ? [root] : []),
            ...Array.from({ length: 19 }, (_, i) => withSuffix(root, `-${i + 2}`)),
          ]
        : Array.from({ length: 10 }, () =>
            withSuffix(root, `-${Math.random().toString(36).slice(2, 7)}`)
          );

    const taken = await prisma.storefront.findMany({
      where: { slug: { in: candidates } },
      select: { id: true, slug: true },
    });
    const takenByOthers = new Set(
      taken.filter((row) => row.id !== excludeStorefrontId).map((row) => row.slug)
    );
    const free = candidates.find((slug) => isValidSlug(slug) && !takenByOthers.has(slug));
    if (free) return free;
  }

  throw new AppError(
    "Could not find a free store link. Try another name.",
    ApiErrorCode.CONFLICT,
    409,
    {
      reason: ONBOARDING_CONFLICT_REASON.slugTaken,
    }
  );
}

/**
 * A unique violation on the storefront update below. `slug` is the only
 * unique column that update writes (storeId never changes), so the code alone
 * identifies it; Prisma 7's driver-adapter errors don't reliably fill
 * `meta.target`.
 */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// ============================================================================
// Context (everything is looked up from the caller's userId)
// ============================================================================

const STOREFRONT_SELECT = {
  id: true,
  slug: true,
  displayName: true,
  tagline: true,
  logoUrl: true,
  themeColor: true,
  instagramUrl: true,
  whatsappNumber: true,
  isPublished: true,
} satisfies Prisma.StorefrontSelect;

/** The oldest store of the caller's business: the one the wizard sets up. */
function findFirstStore(userId: string) {
  return prisma.store.findFirst({
    where: { business: { userId } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, name: true, storefront: { select: STOREFRONT_SELECT } },
  });
}

async function loadContext(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      locale: true,
      timezone: true,
      timezoneUpdatedAt: true,
      hasOnboarded: true,
      business: {
        select: {
          id: true,
          name: true,
          country: true,
          city: true,
          timezone: true,
          locale: true,
          businessType: true,
          onboardingStep: true,
          onboardingGoals: true,
        },
      },
    },
  });
  if (!user) throw new NotFoundError("User");

  const store = user.business ? await findFirstStore(userId) : null;
  return {
    user,
    business: user.business,
    store,
    storefront: store?.storefront ?? null,
  };
}

type OnboardingContext = Awaited<ReturnType<typeof loadContext>>;

// ============================================================================
// State
// ============================================================================

async function buildState(ctx: OnboardingContext): Promise<OnboardingState> {
  const { user, business, store, storefront } = ctx;

  // "Other" is stored as Business.country = null, so null alone can't tell
  // "unset" from "Other". Step 1 always creates the store, so a business
  // with a store but no country picked Other (or is a legacy row, where
  // Other with its real currency beats a guess that would flip it).
  const countryCode = business
    ? (countryCodeFromName(business.country) ??
      (business.country || store ? OTHER_COUNTRY_CODE : null))
    : null;

  let currency: string;
  if (store) {
    currency = (await getFinanceSettings(store.id)).currency;
  } else {
    // No store yet, so no finance settings: the currency the chosen (or
    // best-guessed) country would get. Only a hint; nothing is priced before
    // step 1 has created the store and its settings.
    const code =
      countryCode ??
      guessCountryCode({
        browserTimezone: user.timezoneUpdatedAt ? user.timezone : null,
        uiLocale: asLocale(user.locale),
      });
    currency = resolveMarketDefaults({ countryCode: code }).currency;
  }

  const menuItems = storefront
    ? await prisma.menuItem.findMany({
        where: { storefrontId: storefront.id },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
        take: 3,
        select: { id: true, name: true, price: true },
      })
    : [];

  return {
    step: !business || !store ? ONBOARDING_STEP.store : clampStep(business.onboardingStep),
    completed: user.hasOnboarded && Boolean(store),
    storeId: store?.id ?? null,
    business: business
      ? {
          name: business.name,
          countryCode,
          city: business.city,
          businessType: isBusinessType(business.businessType) ? business.businessType : null,
          timezone: business.timezone,
        }
      : null,
    storefront: storefront
      ? {
          slug: storefront.slug,
          displayName: storefront.displayName,
          tagline: storefront.tagline,
          logoUrl: storefront.logoUrl,
          themeColor: storefront.themeColor,
          instagramUrl: storefront.instagramUrl,
          whatsappNumber: storefront.whatsappNumber,
          isPublished: storefront.isPublished,
        }
      : null,
    currency,
    menuItems: menuItems.map((item) => ({
      id: item.id,
      name: item.name,
      price: Number(item.price),
    })),
    goals: business ? business.onboardingGoals.filter(isGoal) : [],
  };
}

/** GET /api/onboarding/state */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  return buildState(await loadContext(userId));
}

// ============================================================================
// Step 1 — Your store
// ============================================================================

/**
 * POST /api/onboarding/store. Idempotent: saving the same step twice (retry,
 * double submit, coming Back to it) updates the same business, store and
 * storefront instead of creating new ones.
 */
export async function saveStoreStep(
  userId: string,
  input: OnboardingStoreStepInput,
  uiLocale: Locale | null = null
): Promise<OnboardingState> {
  const ctx = await loadContext(userId);
  // Step 1 may only touch an existing store while a wizard is in progress on
  // it (step 1 saves Business.onboardingStep >= 2 in the same transaction
  // that creates the store, so every in-wizard resume has a step). Any other
  // store is live (orders, items priced in its currency): finished setup, or
  // set up by the old flow / before the wizard existed, whatever
  // hasOnboarded says. This step must not rename it or flip its currency.
  // Same rule as resolveOnboardingRedirect. An owner who deleted every store
  // has no store here, so they can still set a new one up.
  if (ctx.store && (ctx.user.hasOnboarded || ctx.business?.onboardingStep == null)) {
    throw alreadyCompletedError();
  }

  // Re-saving "Other" without a currency keeps the store's current one
  // rather than falling back to the USD default and relabelling its items.
  const keptCurrency =
    !getCountry(input.countryCode) && !input.currency && ctx.store
      ? (await getFinanceSettings(ctx.store.id)).currency
      : undefined;

  const defaults = resolveMarketDefaults({
    countryCode: input.countryCode,
    browserTimezone: input.browserTimezone,
    currency: input.currency ?? keptCurrency,
    uiLocale: uiLocale ?? asLocale(ctx.user.locale),
  });

  // "Other": keep a free-text country an older form stored (it's more
  // specific than nothing), but never a known country the owner just moved
  // away from.
  const existingCountry = ctx.business?.country ?? null;
  const countryName =
    defaults.countryName ??
    (existingCountry && !countryCodeFromName(existingCountry) ? existingCountry : null);
  const city = input.city?.trim() || null;
  // The wizard always sends the type picked on screen, so none means the
  // owner cleared it. A stored type the picker doesn't know couldn't be
  // shown (or cleared) there, so that one is kept.
  const existingType = ctx.business?.businessType ?? null;
  const businessType =
    input.businessType ?? (existingType && !isBusinessType(existingType) ? existingType : null);
  // hasOnboarded can be true on an account that never set a store up: the
  // staff-invite and store-transfer claims set it so the account skips
  // merchant setup. Only an account that already has a business is a
  // returning owner (one who finished setup and is re-creating a store after
  // deleting every one); that owner isn't "in the wizard", so no step. Anyone
  // else is a first-time owner and gets the normal wizard state. Never move
  // a resuming owner backwards.
  const isReturningOwner = ctx.user.hasOnboarded && ctx.business !== null;
  const clearHasOnboarded = ctx.user.hasOnboarded && ctx.business === null;
  const onboardingStep = isReturningOwner
    ? null
    : Math.max(ctx.business?.onboardingStep ?? 0, ONBOARDING_STEP.storefront);

  // A custom link is checked before anything is written, so a taken link
  // doesn't leave the step half-saved.
  const ownStorefrontId = ctx.storefront?.id ?? null;
  if (input.slug && input.slug !== ctx.storefront?.slug) {
    const holder = await prisma.storefront.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (holder && holder.id !== ownStorefrontId) {
      throw slugTakenError(input.slug, await findAvailableSlug(input.slug, ownStorefrontId));
    }
  }

  const financeFields = { currency: defaults.currency, market: defaults.market };
  const paymentMethods = PAYMENT_METHODS_BY_MARKET[defaults.market];

  const { storeId, previousStoreName } = await prisma.$transaction(async (tx) => {
    // The upsert takes the business row lock for the rest of the transaction,
    // so a concurrent double submit waits here and then finds the store this
    // one created instead of creating a second one.
    const business = await tx.business.upsert({
      where: { userId },
      create: {
        userId,
        name: input.name,
        country: countryName,
        city,
        timezone: defaults.timezone,
        locale: defaults.locale,
        businessType,
        onboardingStep,
      },
      update: {
        name: input.name,
        country: countryName,
        city,
        timezone: defaults.timezone,
        locale: defaults.locale,
        businessType,
        onboardingStep,
      },
      select: { id: true },
    });

    // A first-time owner whose account was flagged onboarded by an invite or
    // transfer claim: back into the wizard, so /onboarding, the /stores
    // gatekeeper and steps 2 and 3 treat them like any new owner.
    // completeOnboarding sets the flag again on publish.
    if (clearHasOnboarded) {
      await tx.user.update({ where: { id: userId }, data: { hasOnboarded: false } });
    }

    let store = await tx.store.findFirst({
      where: { businessId: business.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    });
    const previousName = store?.name ?? null;

    if (!store) {
      // syncFinanceWithBusiness stays at its default (false): the store gets
      // its own settings row below.
      store = await tx.store.create({
        data: { businessId: business.id, name: input.name, city, country: countryName },
        select: { id: true, name: true },
      });
    } else {
      await tx.store.update({
        where: { id: store.id },
        data: { name: input.name, city, country: countryName },
      });
    }

    // Same OWNER row PATCH /api/user/business has always created. Ensured
    // rather than only created, so an older store that lacks one gets it.
    const owner = await tx.staffMember.findFirst({
      where: { storeId: store.id, role: "OWNER" },
      select: { id: true },
    });
    if (!owner) {
      await tx.staffMember.create({
        data: {
          storeId: store.id,
          name: ctx.user.name || "Owner",
          email: ctx.user.email,
          role: "OWNER",
          pin: null,
          isActive: true,
          inviteStatus: "accepted",
        },
      });
    }

    // Currency + market + that market's payment methods, on the store and on
    // the business (the shared settings later stores can follow). The payment
    // methods are only reset when the market changes, so going Back to this
    // step doesn't undo a choice made since.
    const storeFinance = await tx.storeFinanceSettings.findUnique({
      where: { storeId: store.id },
      select: { market: true },
    });
    await tx.storeFinanceSettings.upsert({
      where: { storeId: store.id },
      create: { storeId: store.id, ...financeFields, enabledPaymentMethods: paymentMethods },
      update: {
        ...financeFields,
        ...(storeFinance?.market !== defaults.market && { enabledPaymentMethods: paymentMethods }),
      },
    });

    const businessFinance = await tx.businessFinanceSettings.findUnique({
      where: { businessId: business.id },
      select: { market: true },
    });
    await tx.businessFinanceSettings.upsert({
      where: { businessId: business.id },
      create: { businessId: business.id, ...financeFields, enabledPaymentMethods: paymentMethods },
      update: {
        ...financeFields,
        ...(businessFinance?.market !== defaults.market && {
          enabledPaymentMethods: paymentMethods,
        }),
      },
    });

    return { storeId: store.id, previousStoreName: previousName };
  });

  // FREE plan only for an account that has none: never overwrite (and so
  // never downgrade) an existing subscription.
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!subscription) {
    await subscriptionService.activateFree(userId, "FREE");
  }

  // Draft storefront (auto-created on first read, unpublished).
  const hadStorefront = await prisma.storefront.findUnique({
    where: { storeId },
    select: { id: true },
  });
  const storefront = await storefrontService.getStorefrontByStoreId(storeId);

  let slug: string | undefined;
  if (input.slug) {
    if (input.slug !== storefront.slug) slug = input.slug;
  } else if (
    !storefront.isPublished &&
    (input.slugFromName ||
      !hadStorefront ||
      previousStoreName === null ||
      previousStoreName !== input.name)
  ) {
    // A new storefront, a renamed store, or the owner asked for the name's
    // link back ("Use my store name" over a custom link): derive the link
    // from the name (the auto-created draft's slug drops accented letters
    // instead of transliterating them). A published link is never changed
    // behind the owner's back.
    const next = await findAvailableSlug(slugify(input.name, storeId), storefront.id);
    if (next !== storefront.slug) slug = next;
  }

  try {
    await prisma.storefront.update({
      where: { id: storefront.id },
      data: {
        displayName: input.name,
        ...(slug && { slug }),
        ...(input.tagline !== undefined && { tagline: input.tagline || null }),
        ...(input.instagramUrl !== undefined && { instagramUrl: input.instagramUrl || null }),
        ...(input.whatsappNumber !== undefined && {
          whatsappNumber: input.whatsappNumber || null,
        }),
        ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl || null }),
        ...(input.themeColor !== undefined && { themeColor: input.themeColor }),
      },
    });
  } catch (error) {
    // Lost a race for the link between the check above and this write.
    if (slug && isUniqueViolation(error)) {
      throw slugTakenError(slug, await findAvailableSlug(slug, storefront.id));
    }
    throw error;
  }
  if (input.logoUrl !== undefined) {
    await deleteReplacedLogo(userId, storefront.logoUrl, input.logoUrl || null);
  }

  // The owner went Back and changed country: items typed earlier keep their
  // numbers but are now in the store's new currency.
  await prisma.menuItem.updateMany({
    where: { storefrontId: storefront.id, currency: { not: defaults.currency } },
    data: { currency: defaults.currency },
  });

  return getOnboardingState(userId);
}

// ============================================================================
// Step 2 — Your storefront
// ============================================================================

/**
 * The wizard's menu category, found by name (so a retry reuses it) or created
 * at the top of the menu. Runs on the step-2 transaction, under its lock.
 */
async function ensureDefaultCategory(
  tx: Prisma.TransactionClient,
  storefrontId: string,
  businessLocale: string | null
) {
  const name = DEFAULT_MENU_CATEGORY_NAME[asLocale(businessLocale) ?? "en"];
  const categories = await tx.menuCategory.findMany({
    where: { storefrontId },
    select: { id: true, name: true },
  });
  const match = categories.find(
    (category) => normalizeItemName(category.name) === normalizeItemName(name)
  );
  if (match) return match.id;

  const created = await tx.menuCategory.create({
    data: { storefrontId, name, displayOrder: 0 },
    select: { id: true },
  });
  return created.id;
}

/** Lock key that serializes step-2 menu saves for one storefront. */
function menuLockKey(storefrontId: string): string {
  return `epidom-onboarding-menu:${storefrontId}`;
}

/**
 * POST /api/onboarding/storefront. Every field is optional (the step can be
 * skipped). Idempotent: items sent back with their id are updated, items in
 * `removedItemIds` (rows the owner cleared) are deleted, new ones whose name
 * already exists on the storefront are not created twice, and the category
 * is reused. A replaced or removed uploaded logo is deleted from storage.
 */
export async function saveStorefrontStep(
  userId: string,
  input: OnboardingStorefrontStepInput
): Promise<OnboardingState> {
  const ctx = await loadContext(userId);
  if (!ctx.business || !ctx.store) {
    throw stepOrderError("Finish the first step (your store) first.");
  }
  const storeId = ctx.store.id;

  // Prices are checked before anything is written, so a bad one can't leave
  // the step half-saved.
  const menuItems = (input.menuItems ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    price: toMenuPrice(item.price),
  }));
  // Rows the owner cleared. An id that is also sent as an item is kept.
  const keptIds = new Set(menuItems.map((item) => item.id).filter(Boolean));
  const removedIds = Array.from(new Set(input.removedItemIds ?? [])).filter(
    (id) => !keptIds.has(id)
  );

  const storefront = await storefrontService.getStorefrontByStoreId(storeId);

  const storefrontData = {
    ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl || null }),
    ...(input.themeColor !== undefined && { themeColor: input.themeColor }),
    ...(input.tagline !== undefined && { tagline: input.tagline || null }),
  };
  if (Object.keys(storefrontData).length > 0) {
    await prisma.storefront.update({ where: { id: storefront.id }, data: storefrontData });
  }
  if (input.logoUrl !== undefined) {
    await deleteReplacedLogo(userId, storefront.logoUrl, input.logoUrl || null);
  }

  if (menuItems.length > 0 || removedIds.length > 0) {
    const storefrontId = storefront.id;
    const businessLocale = ctx.business.locale;
    // The store's settings were written in step 1, and MenuItem.currency
    // can't change afterwards, so it is passed explicitly on create.
    const { currency } = await getFinanceSettings(storeId);

    // The name matching and category reuse below are read-then-create, so
    // they only hold if two saves can't interleave (a double tap on Continue
    // would otherwise create the category and every item twice). The
    // advisory lock serializes step-2 saves for this storefront; a second
    // save waits, then (READ COMMITTED) reads what the first committed and
    // skips it. Every read and write goes through `tx` to stay under it.
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${menuLockKey(storefrontId)}))`;

        // 0. Saved items whose row the owner cleared. Scoped to this
        //    storefront, so an id from anywhere else is never touched. Past
        //    orders keep their lines (OrderItem.menuItemId is SetNull).
        if (removedIds.length > 0) {
          await tx.menuItem.deleteMany({ where: { id: { in: removedIds }, storefrontId } });
        }

        const existing = await tx.menuItem.findMany({
          where: { storefrontId },
          select: { id: true, name: true, price: true },
        });
        const ownById = new Map(existing.map((item) => [item.id, item]));
        const nameById = new Map(existing.map((item) => [item.id, item.name]));

        // 1. Items the wizard created earlier (sent back with their id):
        //    update name and price. An id that isn't on this storefront is
        //    never touched; the entry is treated as a new item instead.
        const toCreate: { name: string; price: number }[] = [];
        for (const item of menuItems) {
          const own = item.id ? ownById.get(item.id) : undefined;
          if (!own) {
            toCreate.push({ name: item.name, price: item.price });
            continue;
          }
          if (own.name !== item.name || Number(own.price) !== item.price) {
            await tx.menuItem.updateMany({
              where: { id: own.id, storefrontId },
              data: { name: item.name, price: new Prisma.Decimal(item.price) },
            });
          }
          nameById.set(own.id, item.name);
        }

        // 2. New items, skipping any whose name is already on the storefront
        //    (a retried request) or repeated within this request.
        const names = new Set(Array.from(nameById.values()).map(normalizeItemName));
        const fresh = toCreate.filter((item) => {
          const key = normalizeItemName(item.name);
          if (names.has(key)) return false;
          names.add(key);
          return true;
        });
        if (fresh.length === 0) return;

        const categoryId = await ensureDefaultCategory(tx, storefrontId, businessLocale);
        const maxOrder = await tx.menuItem.aggregate({
          where: { storefrontId, categoryId },
          _max: { displayOrder: true },
        });
        let displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

        for (const item of fresh) {
          await tx.menuItem.create({
            data: {
              storefrontId,
              categoryId,
              department: "KITCHEN",
              name: item.name,
              price: new Prisma.Decimal(item.price),
              currency,
              isAvailable: true,
              showOnCashier: true,
              isFeatured: false,
              displayOrder: displayOrder++,
            },
            select: { id: true },
          });
        }
      },
      // A save queued behind another one waits inside its transaction.
      { timeout: 15_000 }
    );
  }

  if (!ctx.user.hasOnboarded) {
    await prisma.business.update({
      where: { userId },
      data: {
        onboardingStep: Math.max(ctx.business.onboardingStep ?? 0, ONBOARDING_STEP.goals),
      },
    });
  }

  return getOnboardingState(userId);
}

// ============================================================================
// Step 3 — Your goals, then publish
// ============================================================================

/**
 * POST /api/onboarding/complete. Publishes the storefront, saves the goals,
 * clears the wizard step and sets User.hasOnboarded. Idempotent: a second
 * call returns the same result (and an empty body then keeps the goals saved
 * the first time instead of wiping them).
 *
 * Publishing has no plan gate (the storefront is the free tier), matching
 * PATCH /api/stores/[id]/storefront, which only restricts turning online
 * orders / reservations ON. Neither is touched here, and public ordering is
 * plan-checked at order time anyway.
 */
export async function completeOnboarding(
  userId: string,
  input: OnboardingCompleteInput
): Promise<OnboardingCompleteResult> {
  const ctx = await loadContext(userId);
  if (!ctx.business || !ctx.store || !ctx.storefront) {
    throw stepOrderError("Finish the first step (your store) first.");
  }

  const requested = (input.goals ?? []).filter(isGoal);
  const goals =
    requested.length === 0 && ctx.user.hasOnboarded
      ? ctx.business.onboardingGoals.filter(isGoal)
      : requested;

  await prisma.$transaction([
    prisma.storefront.update({
      where: { id: ctx.storefront.id },
      data: { isPublished: true },
    }),
    prisma.business.update({
      where: { userId },
      data: { onboardingGoals: goals, onboardingStep: null },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { hasOnboarded: true },
    }),
  ]);

  return {
    storeId: ctx.store.id,
    slug: ctx.storefront.slug,
    publicUrl: publicStorefrontUrl(ctx.storefront.slug),
    goals,
  };
}

// ============================================================================
// Slug check
// ============================================================================

/**
 * GET /api/onboarding/slug-check. The input is normalized with slugify (so
 * "Mon Café" checks "mon-cafe"). Too short / invalid -> available false with
 * no suggestion; taken by another storefront -> available false with a free
 * suggestion. The caller's own first store's current link counts as available.
 */
export async function checkSlugAvailability(userId: string, raw: string): Promise<SlugCheckResult> {
  const slug = slugify(raw);
  if (!isValidSlug(slug)) return { slug, available: false, suggestion: null };

  const [ownStore, holder] = await Promise.all([
    findFirstStore(userId),
    prisma.storefront.findUnique({ where: { slug }, select: { id: true } }),
  ]);
  const ownStorefrontId = ownStore?.storefront?.id ?? null;

  if (!holder || holder.id === ownStorefrontId) {
    return { slug, available: true, suggestion: null };
  }
  return { slug, available: false, suggestion: await findAvailableSlug(slug, ownStorefrontId) };
}
