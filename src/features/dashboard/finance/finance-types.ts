/**
 * Response shapes of the /api/stores/[id]/finance/* routes, shared by the
 * Finance report (FinanceClient), its tabs and the PDF print view. Money is
 * literal in the store's own currency unless a field says otherwise.
 */
import type { ExpenseCategory, OrderType, PayType } from "@prisma/client";
import type { DailyRow } from "@/lib/finance/report-aggregation";
import type { CashOnHandBreakdown } from "@/lib/finance/cash-drawer";
import type {
  AdjustmentsReport,
  LabourRow,
  PatternCell,
  OrderTypeRow,
  TaxRateRow,
} from "@/lib/finance/insights";
import type { ExpenseCategoryTotal } from "@/lib/finance/expenses";

export type { DailyRow };

export interface SummaryData {
  from: string;
  to: string;
  revenue: number;
  grossRevenue: number;
  discountAmount: number;
  refundAmount: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  // Order lines with no cost source at all. Delivery-app orders arrive with
  // neither a menu item nor a product attached, so they can never acquire a
  // cost snapshot — their cost is genuinely unknown. Surfaced rather than
  // rendered as zero, which would imply they sold at 100% margin.
  unknownCostLines?: number;
  unknownCostRevenue?: number;
  wasteLoss: number;
  /** Tax owed: charged, less the tax share of refunds. */
  taxCollected: number;
  serviceCharge: number;
  processingFee: number;
  netSales: number;
  netRevenue: number;
  platformCommission: number;
  netProfit: number;
  orderCount: number;
  deliveryFee: number;
  awaitingPaymentAmount: number;
  awaitingPaymentCount: number;
  buckets: DailyRow[];
}

export interface WasteReasonRow {
  reason: string;
  label: string;
  entryCount: number;
  totalQuantity: number;
  totalValue: number;
}

export interface ChannelRow {
  source: string;
  label: string;
  orderCount: number;
  revenue: number;
  commissionPct: number;
  commissionAmount: number;
  refundAmount: number;
  taxAmount: number;
  processingFeeAmount: number;
  netRevenue: number;
}

export interface TopItem {
  name: string;
  orderCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

export interface TopItemsTotals {
  itemCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

export interface CategoryRow {
  categoryId: string | null;
  categoryName: string;
  orderItemCount: number;
  /** Distinct orders with a line in this category. */
  orderCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

export interface CategoryTotals {
  /** Distinct orders across every category — not the column's sum. */
  orderCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

export interface DepartmentRow {
  // "CUSTOM" is the optional second product line (Product.productLine),
  // labeled client-side with the store's own customProductsLabel.
  department: "KITCHEN" | "BAR" | "CUSTOM" | null;
  orderItemCount: number;
  totalQuantity: number;
  totalRevenue: number;
}

export interface ShiftRow {
  shiftId: string | null;
  staffName: string;
  staffId?: string | null;
  openedAt: string | null;
  closedAt: string | null;
  isOpen: boolean;
  orderCount: number;
  revenue: number;
}

export interface ScheduleShiftBucketRow {
  scheduleShiftId: string;
  name: string;
  date: string;
  orderCount: number;
  revenue: number;
  color: string | null;
  staffOnDuty: { staffMemberId: string; name: string; department?: string | null }[];
}

export interface ScheduleShiftTotals {
  orderCount: number;
  revenue: number;
  outsideOrderCount: number;
  outsideRevenue: number;
}

export interface PaymentMethodRow {
  paymentMethod: string;
  /** Payments: a split bill counts once per tender. */
  orderCount: number;
  revenue: number;
  percentOfTotal: number;
}

/** Mirrors CashReconciliationRow in lib/finance/report-aggregation.ts. */
export interface CashReconciliationRow extends CashOnHandBreakdown {
  shiftId: string;
  staffName: string;
  staffId: string;
  openedAt: string;
  closedAt: string | null;
  isOpen: boolean;
  isFlagged: boolean;
}

export interface ItemMarginRow {
  name: string;
  orderCount: number;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number | null;
  margin: number | null;
  marginPct: number | null;
}

export interface SalesPatternsData {
  timezone: string;
  byOrderType: OrderTypeRow[];
  cells: PatternCell[];
  byHour: { hour: number; orderCount: number; revenue: number }[];
  byWeekday: { weekday: number; orderCount: number; revenue: number }[];
  covers: { guests: number; ordersWithGuests: number; revenueWithGuests: number };
}

export type AdjustmentsData = AdjustmentsReport;

export interface TaxData {
  rates: TaxRateRow[];
}

export interface LabourData {
  rows: LabourRow[];
  totals: { workedMinutes: number; cost: number; notEstimated: number };
  monthFraction: number;
  missingClockOuts: number;
  /** Not the owner: each person's rate and cost are withheld (totals stay). */
  payHidden?: boolean;
}

export interface ExpenseRow {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
}

export interface ExpensesData {
  expenses: ExpenseRow[];
  total: number;
  byCategory: ExpenseCategoryTotal[];
}

export type { ExpenseCategory, OrderType, PayType };
