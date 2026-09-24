/**
 * GET /api/stores/overview — what the Your Stores cards show beyond the bare
 * store row: the storefront's branding and a short summary. Called only by the
 * Your Stores page (never by the store switchers, which fetch GET /api/stores
 * on every page). No imports, so server and client share it.
 */

export type StoreMarket = "INDONESIA" | "FRANCE" | "INTERNATIONAL";

export interface StoreOverviewStats {
  /** All-time Σ Order.total with status not CANCELLED/HELD — the app's revenue definition, 2dp, in `currency`. */
  revenue: number;
  /** Customer rows for the store (the Customers page's "Total customers"). */
  customerCount: number;
  /** Active staff members, not counting the OWNER row. */
  staffCount: number;
}

export interface StoreOverview {
  storeId: string;
  /** Storefront slogan, trimmed; null when absent or blank. */
  tagline: string | null;
  /** Storefront logo URL (may be a data: URI); null when absent or "". */
  logoUrl: string | null;
  /** Storefront cover (hero) image URL; null when absent or "". */
  coverUrl: string | null;
  /** Storefront brand colour as stored (hex); null when the store has no storefront yet. */
  themeColor: string | null;
  /** Resolved ISO currency code of the store's money (default "IDR"). */
  currency: string;
  /** Resolved payment market (default INDONESIA). */
  market: StoreMarket;
  /** Totals — null when this viewer may not see them (a linked staff store, or a non-owner PIN persona). */
  stats: StoreOverviewStats | null;
}
