/**
 * The i18n key that names a payment market (PaymentMarket: INDONESIA | FRANCE |
 * INTERNATIONAL). A missing or unknown value reads as Indonesia, the same
 * default the finance settings resolve to. No imports, so both server and
 * client code can use it.
 */
export type MarketLabelKey =
  | "profile.feesAndTaxes.market.indonesia"
  | "profile.feesAndTaxes.market.france"
  | "profile.feesAndTaxes.market.international";

export function marketLabelKey(market?: string | null): MarketLabelKey {
  switch (market) {
    case "FRANCE":
      return "profile.feesAndTaxes.market.france";
    case "INTERNATIONAL":
      return "profile.feesAndTaxes.market.international";
    default:
      return "profile.feesAndTaxes.market.indonesia";
  }
}
