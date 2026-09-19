/**
 * Wire contracts for the cashier revamp (release 2.88.0): customers, discount
 * presets, coupons, loyalty points, multi-tender payments, merge and receipts.
 *
 * ONE file both sides import, so the POS/Back Office UI and the routes cannot
 * drift apart. Every route wraps its payload in createSuccessResponse(data)
 * ({ success: true, data }) and apiClient unwraps it, so the types below are the
 * `data` part. Dates are ISO strings on the wire. Money is a plain number in
 * the store's display currency and is LITERAL — never IDR-converted.
 */

// ─── Shared ──────────────────────────────────────────────────────────────────

export type DiscountKindDto = "PERCENT" | "FIXED";

/** A method a customer can pay with — never PAY_LATER or SPLIT. */
export type TenderMethodDto =
  | "CASH"
  | "QRIS"
  | "GOPAY"
  | "OVO"
  | "DANA"
  | "SHOPEEPAY"
  | "BANK_TRANSFER"
  | "STRIPE_CARD"
  | "LINKAJA"
  | "CHEQUE"
  | "TITRE_RESTAURANT"
  | "PAYPAL"
  | "APPLE_PAY"
  | "GOOGLE_PAY"
  | "OTHER";

export interface OrderPaymentDto {
  id: string;
  method: TenderMethodDto;
  /** Applied to the bill; never includes cash change. Σ amount = Order.total. */
  amount: number;
  amountTendered: number | null;
  change: number | null;
  note: string | null;
  refundedAmount: number;
}

// ─── Customers ───────────────────────────────────────────────────────────────

export interface CustomerRowDto {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  /** Cached loyalty balance (ledger-backed). 0 when the store has loyalty off. */
  points: number;
  /** Set the first time the customer earned points. */
  memberSince: string | null;
  createdAt: string;
  /** Computed from Order at read time (Σ total − refundAmount over revenue orders). */
  lifetimeSpend: number;
  orderCount: number;
  lastOrderAt: string | null;
}

export interface CustomerListDto {
  customers: CustomerRowDto[];
  nextCursor: string | null;
  totalCount: number;
  /** Present only when the request passed includeSummary=1. */
  summary?: {
    members: number;
    nonMembers: number;
    /** Σ points ever redeemed (absolute value of REDEEM entries). */
    pointsRedeemedTotal: number;
  };
}

export interface CustomerOrderDto {
  id: string;
  orderNumber: string;
  orderDate: string;
  total: number;
  status: string;
}

export type LoyaltyEntryTypeDto = "EARN" | "REDEEM" | "ADJUST" | "REVERSAL";

export interface LoyaltyEntryDto {
  id: string;
  type: LoyaltyEntryTypeDto;
  /** Signed. */
  points: number;
  note: string | null;
  orderId: string | null;
  createdAt: string;
}

export interface CustomerDetailDto extends CustomerRowDto {
  /** Most recent 20. */
  orders: CustomerOrderDto[];
  /** Most recent 30. */
  loyaltyEntries: LoyaltyEntryDto[];
}

export interface CreateCustomerBody {
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface UpdateCustomerBody {
  name?: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface AdjustPointsBody {
  /** Signed, non-zero. The balance may not go negative. */
  points: number;
  note: string;
}

// ─── Discount presets & coupons (OPERATIONS) ─────────────────────────────────

export interface DiscountPresetDto {
  id: string;
  name: string;
  type: DiscountKindDto;
  value: number;
  isActive: boolean;
  sortOrder: number;
}

export interface UpsertDiscountPresetBody {
  name: string;
  type: DiscountKindDto;
  /** PERCENT: 0 < v ≤ 100. FIXED: a literal amount in the store's currency. */
  value: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CouponDto {
  id: string;
  code: string;
  name: string | null;
  type: DiscountKindDto;
  value: number;
  minSubtotal: number | null;
  maxUses: number | null;
  usedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}

export interface CreateCouponBody {
  code: string;
  name?: string;
  type: DiscountKindDto;
  value: number;
  minSubtotal?: number | null;
  maxUses?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  isActive?: boolean;
}

/** `code` is immutable after creation; everything else may change. */
export type UpdateCouponBody = Partial<Omit<CreateCouponBody, "code">>;

export type CouponRejectionDto =
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "USED_UP"
  | "BELOW_MINIMUM";

/** POST /coupons/validate — always HTTP 200; `valid` says whether it applies. */
export interface CouponValidationDto {
  valid: boolean;
  reason?: CouponRejectionDto;
  coupon?: {
    id: string;
    code: string;
    name: string | null;
    type: DiscountKindDto;
    value: number;
    /**
     * Lets the cart stop applying the coupon if the bill later shrinks under it
     * (the server re-checks at checkout regardless). Null when there is none.
     */
    minSubtotal: number | null;
  };
  /** Priced by the server against the itemsTotal sent. */
  discountAmount?: number;
}

export interface ValidateCouponBody {
  code: string;
  itemsTotal: number;
}

// ─── Loyalty settings (OPERATIONS) ───────────────────────────────────────────

export interface LoyaltySettingsDto {
  enabled: boolean;
  /** Literal amount in the store's currency that earns one point. */
  spendPerPoint: number;
  /** Literal value, in the same currency, of one point when redeemed. */
  pointValue: number;
  minRedeemPoints: number;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

/**
 * Returned by POST /pos/orders and /pos/orders/[orderId]/finalize (additive —
 * orderId/orderNumber are what clients already read).
 */
export interface PosOrderCreatedDto {
  orderId: string;
  orderNumber: string;
  /** The call-out number (#12), printed big on kitchen tickets and labels. Null when the order has none. */
  queueNumber?: number | null;
  total: number;
  discountAmount: number;
  paymentMethod: string;
  /** Cash change owed across CASH tenders; null when there is none. */
  change: number | null;
  pointsEarned: number;
  payments: Array<{
    method: TenderMethodDto;
    amount: number;
    amountTendered: number | null;
    change: number | null;
    note: string | null;
  }>;
}

export interface MergeOrdersBody {
  targetOrderId: string;
  sourceOrderIds: string[];
}

export interface MergeOrdersResultDto {
  orderId: string;
  orderNumber: string;
  mergedCount: number;
  total: number;
}

// ─── Receipts ────────────────────────────────────────────────────────────────

/** POST /pos/orders/[orderId]/send-receipt — `phone` overrides Order.customerPhone. */
export interface SendReceiptBody {
  phone?: string;
}

export interface SendReceiptEmailBody {
  email: string;
}
