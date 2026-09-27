import { Prisma, type StoreFinanceSettings } from "@prisma/client";
import { PAYMENT_METHODS_BY_MARKET } from "@/config/payment-fees.config";
import { countryCodeFromName, getCountry, resolveMarketDefaults } from "@/lib/onboarding/markets";
import type { CreateStoreInput } from "@/lib/validation/business.schemas";
import { ForbiddenError, StoreLimitExceededError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { PLAN_LABELS, minPlanForStores } from "@/lib/plans/entitlements";
import { storefrontService } from "./storefront.service";

/**
 * Everything a newly created store needs so it works the moment it exists,
 * instead of lazily or never:
 * - an OWNER StaffMember row, so the owner's shifts and attendance have a
 *   staff member to belong to (useShiftStaffMemberId resolves it from the
 *   store's roster);
 * - finance settings, so the store isn't silently read as IDR / INDONESIA
 *   (resolveCurrencyAndMarket's no-row fallback). They must exist before any
 *   menu item, because MenuItem.currency is fixed when the item is created;
 * - a draft storefront, so the store card and the Getting-started checklist
 *   have something to show.
 *
 * The first two are written inside the store-creation transaction; the
 * storefront is created right after commit, best-effort.
 */

/** Shown when the source store in `financeSource.copy` isn't one of the caller's stores. */
export const COPY_SOURCE_FORBIDDEN_MESSAGE =
  "You can only copy settings from one of your own stores.";

/** Shown when `financeSource.country` arrives without a countryCode. */
export const COUNTRY_REQUIRED_MESSAGE = "Choose the store's country to set its currency.";

/**
 * The store limit of the caller's plan is reached. Same class, code (403,
 * SUBSCRIPTION_LIMIT_EXCEEDED) and details as StoreLimitExceededError, with a
 * message that names the lowest plan that fits one more store
 * (PLAN_MAX_STORES: FREE/POS 1, OPERATIONS 3, ENTERPRISE unlimited) and that
 * plan as `requiredPlan` in the details for clients that translate it.
 */
export class StoreLimitReachedError extends StoreLimitExceededError {
  constructor(current: number, limit: number) {
    super(current, limit);
    const requiredPlan = minPlanForStores(limit + 1);
    const included =
      limit === 1 ? "Your plan includes 1 store." : `Your plan includes ${limit} stores.`;
    this.message =
      requiredPlan === "ENTERPRISE"
        ? `${included} More stores need the Enterprise plan: talk to us.`
        : `${included} Upgrade to the ${PLAN_LABELS[requiredPlan]} plan to add more stores.`;
    if (this.details) this.details.requiredPlan = requiredPlan;
  }
}

/**
 * The new store's country code: the one sent, else one read from the
 * free-text `country` ("France", "indonésie", "FR"). A client that sends
 * only the free text (an older Create-store form, an API caller) then still
 * gets its country's finance settings, instead of no row and the IDR /
 * INDONESIA fallback. Text that names no listed country gives undefined,
 * and that text is still stored as it is (see resolveStoreCountryColumn).
 */
export function resolveStoreCountryCode(input: {
  countryCode?: string | null;
  country?: string | null;
}): string | undefined {
  return input.countryCode || countryCodeFromName(input.country);
}

/**
 * The value for Store.country: the English name of a listed country, else
 * the free text that was sent ("ZZ" = a country not in the list, or no code).
 */
export function resolveStoreCountryColumn(input: {
  countryCode?: string | null;
  country?: string | null;
}): string | undefined {
  const listed = getCountry(input.countryCode);
  if (listed) return listed.name;
  const text = input.country?.trim();
  return text ? text : undefined;
}

/** The configuration columns of StoreFinanceSettings (everything but identity and timestamps). */
export type FinanceSettingsConfig = Omit<
  Prisma.StoreFinanceSettingsUncheckedCreateInput,
  "id" | "storeId" | "createdAt" | "updatedAt"
>;

/**
 * Finance settings for a store that starts from its country's defaults:
 * currency, payment market and that market's payment methods. Tax, service
 * charge and processing fees keep the column defaults (off / off / on).
 * `currency` only matters for "ZZ" (other); a listed country has its own.
 */
export function countryFinanceSettings(input: {
  countryCode: string;
  currency?: string | null;
}): FinanceSettingsConfig {
  const { currency, market } = resolveMarketDefaults({
    countryCode: input.countryCode,
    currency: input.currency,
  });
  return { currency, market, enabledPaymentMethods: [...PAYMENT_METHODS_BY_MARKET[market]] };
}

/**
 * Every configuration column of a store's finance-settings row, for another
 * store. Destructures out only identity and timestamps, so a column added to
 * the model later is copied too without touching this.
 */
export function copyFinanceSettings(row: StoreFinanceSettings): FinanceSettingsConfig {
  const {
    id: _id,
    storeId: _storeId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    processingFeeOverrides,
    ...config
  } = row;
  return {
    ...config,
    enabledPaymentMethods: [...config.enabledPaymentMethods],
    processingFeeOverrides:
      processingFeeOverrides == null
        ? Prisma.JsonNull
        : (processingFeeOverrides as Prisma.InputJsonValue),
  };
}

/**
 * What a new store's finance settings will be:
 * - `none`: no row, when there is no financeSource and no country code
 *   (neither sent nor readable from the free-text country; see
 *   resolveStoreCountryCode),
 * - `sync`: follow the business's shared settings (syncFinanceWithBusiness),
 * - `row`: its own StoreFinanceSettings row with `data`.
 */
export type FinanceProvisioning =
  | { kind: "none" }
  | { kind: "sync" }
  | { kind: "row"; data: FinanceSettingsConfig };

/**
 * Decide the new store's finance settings. Runs inside the store-creation
 * transaction, before the store row is created (a `sync` result goes into
 * that row).
 *
 * @throws ForbiddenError when the copy source isn't a store of `businessId`
 *   (a store that doesn't exist gets the same answer, so ids can't be probed)
 * @throws ValidationError when mode "country" has no countryCode
 */
export async function resolveFinanceProvisioning(
  tx: Prisma.TransactionClient,
  params: {
    businessId: string;
    input: Pick<CreateStoreInput, "countryCode" | "financeSource">;
  }
): Promise<FinanceProvisioning> {
  const { countryCode, financeSource } = params.input;

  if (financeSource?.mode === "copy") {
    const source = await tx.store.findUnique({
      where: { id: financeSource.storeId },
      select: { businessId: true, syncFinanceWithBusiness: true, financeSettings: true },
    });
    if (!source || source.businessId !== params.businessId) {
      throw new ForbiddenError(COPY_SOURCE_FORBIDDEN_MESSAGE);
    }
    if (source.syncFinanceWithBusiness) return { kind: "sync" };
    if (source.financeSettings) {
      return { kind: "row", data: copyFinanceSettings(source.financeSettings) };
    }
    // The source has never been configured (it reads as the IDR defaults):
    // nothing to copy, so fall back to the new store's country when known.
    return countryCode
      ? { kind: "row", data: countryFinanceSettings({ countryCode }) }
      : { kind: "none" };
  }

  if (financeSource?.mode === "country") {
    if (!countryCode) {
      throw new ValidationError(COUNTRY_REQUIRED_MESSAGE, [
        { field: "countryCode", message: COUNTRY_REQUIRED_MESSAGE },
      ]);
    }
    return {
      kind: "row",
      data: countryFinanceSettings({ countryCode, currency: financeSource.currency }),
    };
  }

  if (countryCode) return { kind: "row", data: countryFinanceSettings({ countryCode }) };

  return { kind: "none" };
}

/**
 * The store's OWNER StaffMember row, with the same fields the first store
 * gets in PATCH /api/user/business. Every consumer of OWNER rows reads them
 * per store (roster, shift owner, staff page), so one per store is expected.
 * Returns null when the user row is missing (same as that route).
 */
export async function createOwnerStaffMember(
  tx: Prisma.TransactionClient,
  params: { storeId: string; userId: string }
): Promise<{ id: string } | null> {
  const user = await tx.user.findUnique({
    where: { id: params.userId },
    select: { name: true, email: true },
  });
  if (!user) return null;

  return tx.staffMember.create({
    data: {
      storeId: params.storeId,
      name: user.name || "Owner",
      email: user.email,
      role: "OWNER",
      pin: null,
      isActive: true,
      inviteStatus: "accepted",
    },
    select: { id: true },
  });
}

/**
 * The in-transaction half of provisioning, called right after the store row
 * is created: the OWNER staff row and, when decided, the finance-settings row.
 */
export async function provisionStoreInTransaction(
  tx: Prisma.TransactionClient,
  params: { storeId: string; userId: string; finance: FinanceProvisioning }
): Promise<void> {
  await createOwnerStaffMember(tx, { storeId: params.storeId, userId: params.userId });

  if (params.finance.kind === "row") {
    await tx.storeFinanceSettings.create({
      data: { storeId: params.storeId, ...params.finance.data },
    });
  }
}

/**
 * Create the store's draft storefront (unpublished, displayName = store name,
 * unique slug from the name) after the store-creation transaction commits.
 * Best-effort: a failure is logged and never fails store creation, since the
 * storefront is also created lazily the first time anything reads it.
 */
export async function ensureDraftStorefront(storeId: string): Promise<{ slug: string } | null> {
  try {
    const storefront = await storefrontService.getStorefrontByStoreId(storeId);
    return { slug: storefront.slug };
  } catch (error) {
    logger.error("Draft storefront creation failed after store creation", error, { storeId });
    return null;
  }
}
