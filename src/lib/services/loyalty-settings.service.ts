import { prisma } from "@/lib/prisma";
import { FieldError } from "@/lib/errors/field-error";
import { loyaltyEnableError } from "@/lib/validation/loyalty.schemas";
import type { UpdateLoyaltySettingsInput } from "@/lib/validation/loyalty.schemas";
import type { LoyaltySettingsDto } from "@/types/api/cashier";

/**
 * Loyalty-points settings (StoreLoyaltySettings, 1:1 with a store).
 *
 * The receipt-settings pattern: GET resolves defaults and NEVER returns null, so
 * a store that has never opened the card still gets a full, "off" object. Kept
 * as its own row rather than on StoreFinanceSettings, which resolves through
 * Business sync — loyalty is always a per-store decision.
 *
 * `spendPerPoint` / `pointValue` are LITERAL amounts in the store's display
 * currency, never IDR-converted. There is deliberately no per-currency default
 * stored here: an unset amount stays 0 and the UI shows currency-appropriate
 * placeholders, so nothing is silently saved on the owner's behalf.
 *
 * Not the ORDERS agent's loyalty.service.ts (earn / redeem / reverse); this file
 * only owns the configuration row. `getLoyaltySettings` is exported for it to
 * reuse — its result is exactly the `LoyaltyRules` shape in finance/discounts.ts.
 */

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettingsDto = {
  enabled: false,
  spendPerPoint: 0,
  pointValue: 0,
  minRedeemPoints: 0,
};

interface LoyaltySettingsRow {
  enabled: boolean;
  spendPerPoint: { toString(): string } | number;
  pointValue: { toString(): string } | number;
  minRedeemPoints: number;
}

function toDto(row: LoyaltySettingsRow | null): LoyaltySettingsDto {
  if (!row) return { ...DEFAULT_LOYALTY_SETTINGS };
  return {
    enabled: row.enabled,
    spendPerPoint: Number(row.spendPerPoint),
    pointValue: Number(row.pointValue),
    minRedeemPoints: row.minRedeemPoints,
  };
}

type Db = Pick<typeof prisma, "storeLoyaltySettings">;

export class LoyaltySettingsService {
  constructor(private readonly db: Db = prisma) {}

  async get(storeId: string): Promise<LoyaltySettingsDto> {
    const row = await this.db.storeLoyaltySettings.findUnique({ where: { storeId } });
    return toDto(row);
  }

  /**
   * Merge `input` over the stored settings and save. The enable rule is checked
   * on the MERGED result, so flipping just the switch works when the amounts are
   * already stored, and clearing an amount while the program is on is refused
   * rather than leaving an enabled program with nothing to earn or redeem.
   */
  async update(storeId: string, input: UpdateLoyaltySettingsInput): Promise<LoyaltySettingsDto> {
    const current = await this.get(storeId);
    const merged: LoyaltySettingsDto = {
      enabled: input.enabled ?? current.enabled,
      spendPerPoint: input.spendPerPoint ?? current.spendPerPoint,
      pointValue: input.pointValue ?? current.pointValue,
      minRedeemPoints: input.minRedeemPoints ?? current.minRedeemPoints,
    };

    if (merged.enabled) {
      const problem = loyaltyEnableError(merged);
      if (problem) throw new FieldError(problem.field, problem.message);
    }

    const row = await this.db.storeLoyaltySettings.upsert({
      where: { storeId },
      create: { storeId, ...merged },
      update: merged,
    });
    return toDto(row);
  }
}

export const loyaltySettingsService = new LoyaltySettingsService();

/** Function form for callers that don't need the class (settlement, earn/redeem). */
export function getLoyaltySettings(storeId: string): Promise<LoyaltySettingsDto> {
  return loyaltySettingsService.get(storeId);
}
