import type {
  Order,
  OrderItem,
  OrderStatus,
  OrderItemStatus,
  OrderSource,
  PaymentMethod,
  PaymentStatus,
  OrderType,
  TableStatus,
} from "@prisma/client";
import type { OrderPaymentDto } from "@/types/api/cashier";

// ─── POS Cart ────────────────────────────────────────────────────────────────

export interface CartModifier {
  groupName: string;
  optionName: string;
  priceAdjustment: number;
  materialId?: string;
  materialQty?: number;
}

export interface CartItem {
  id: string; // local uuid for the cart line
  /** null for a Custom Item — an ad-hoc line the cashier typed, with no MenuItem behind it. */
  menuItemId: string | null;
  name: string;
  unitPrice: number; // base price
  quantity: number;
  modifiers: CartModifier[];
  notes?: string;
  lineTotal: number; // (unitPrice + sum(modifiers)) * quantity
  imageUrl?: string | null;
  /** True for a Custom Item (menuItemId is null). Unrelated to Product.productLine "CUSTOM". */
  isCustom?: boolean;
  /** Custom Item prep area — null/absent means no prep area. Ignored for ordinary lines. */
  department?: "KITCHEN" | "BAR" | null;
}

/** The customer attached to the sale (optional). A snapshot; refetch for fresh points. */
export interface CartCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  points: number;
  lifetimeSpend: number;
}

/**
 * The cart's single "primary" discount — manual, preset or coupon are mutually
 * exclusive (latest wins). Points redemption is separate (`redeemPoints`) and
 * stacks on top. Preset/coupon carry their rule so PERCENT is re-priced as the
 * items change; the SERVER re-derives every amount from ids/codes and never
 * trusts these previews.
 */
export type CartDiscountSource =
  | { kind: "manual"; amount: number; reason?: string }
  | {
      kind: "preset";
      presetId: string;
      name: string;
      type: "PERCENT" | "FIXED";
      value: number;
    }
  | {
      kind: "coupon";
      couponId: string;
      code: string;
      type: "PERCENT" | "FIXED";
      value: number;
      /** Below this item total the coupon stops applying (mirrors the server check). */
      minSubtotal: number | null;
    };

/** One row of the split-payment tender list, persisted so a reload doesn't lose it. */
export interface DraftTender {
  id: string;
  method: Exclude<PaymentMethod, "PAY_LATER" | "SPLIT">;
  /** null until the cashier fills it in. */
  amount: number | null;
  /** Cash handed over (CASH rows only). */
  amountTendered: number | null;
  /** Label for method OTHER. */
  note: string;
}

export interface CartState {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
}

// ─── POS Order ───────────────────────────────────────────────────────────────

export interface PosOrderItemDisplay {
  id: string;
  menuItemId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  status: OrderItemStatus;
  /** True for a Custom Item (no MenuItem). */
  isCustom?: boolean;
  /** Prep area for a line with no MenuItem (Custom Item); null = none. */
  department?: "KITCHEN" | "BAR" | "BOTH" | null;
  notes?: string | null;
  selectedOptions?: CartModifier[] | null;
  menuItem?: {
    name: string;
    department?: "KITCHEN" | "BAR" | null;
    product?: { productLine: "STANDARD" | "CUSTOM" } | null;
  } | null;
  // Set when this line needed more of a recipe-linked product than was on
  // hand — an auto-drafted ProductionBatch (triggerType: ORDER_SHORTFALL) is
  // covering it. Completing that batch (or tapping this item to READY, which
  // delegates to it) is the same event — see the item PATCH route.
  productionBatchId?: string | null;
}

export interface PosOrderDisplay {
  id: string;
  orderNumber: string;
  /** Set when the order was attached to a Customer record. */
  customerId?: string | null;
  /** Shared by the bills created from one "split by items" action. */
  splitGroupId?: string | null;
  /** Per-tender breakdown. Absent on orders that predate multi-tender — fall back to paymentMethod. */
  payments?: OrderPaymentDto[];
  /** Why the frozen discountAmount (declared below) was given — a preset/coupon/points/manual label. */
  discountReason?: string | null;
  status: OrderStatus;
  source: OrderSource;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  /** Call-out number, #1, #2… per store per local day. Null on orders that predate it. */
  queueNumber?: number | null;
  tableLabel?: string | null;
  tableNumber?: string | null;
  /** Pax at the table (dine-in). Null/absent = never counted, not "1". */
  guestCount?: number | null;
  notes?: string | null;
  subtotal: number;
  // Frozen at order creation and already numbers on the wire (serializePosOrder
  // converts the Decimals). Optional so a hand-built fixture needn't carry them.
  tax?: number;
  serviceCharge?: number;
  discountAmount?: number;
  delivery?: number;
  total: number;
  items: PosOrderItemDisplay[];
  createdAt: string; // ISO string (serialised from Date)
  // Set only when the order was placed during a tracked shift — many orders
  // (esp. online/storefront) never have one, so cashier attribution is best-effort.
  shift?: { staffMember: { id: string; name: string } } | null;
}

// ─── POS Menu ────────────────────────────────────────────────────────────────

export interface PosMenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isAvailable: boolean;
  category?: string | null;
  // "CUSTOM" is a client-facing sentinel for the optional second product
  // line (see Product.productLine) — never the real stored DB value, which
  // stays inert Kitchen. Overridden server-side in /api/stores/[id]/pos/menu
  // so it can be filtered like a genuine third department alongside
  // Kitchen/Bar in PosDepartmentBar/PosItemGrid.
  department?: "KITCHEN" | "BAR" | "CUSTOM" | null;
  // Scannable code from the linked Product (optional). Items with no Product
  // have none. Matched exactly by the POS search box / barcode scanner.
  barcode?: string | null;
  // Finished-goods balance, present ONLY for BATCH_PRODUCED products. Absent
  // for made-to-order and untracked items, which keep no count — so `undefined`
  // means "no count exists", not "zero".
  //
  // NEVER gate the tile on this. It is a hint, not a stock check: a counted
  // item at 0 is still sellable (the kitchen makes it fresh and the ingredients
  // come out at that point), the number is stale by construction because
  // deduction is deferred to DELIVERED, and it is unenforceable offline —
  // query-persister mirrors the POS menu but not Product.currentStock, so a
  // disconnected tablet would render an hours-old figure as authoritative.
  countedStock?: number;
  countedUnit?: string;
  modifiers?: unknown;
  product?: {
    optionGroups?: Array<{
      name: string;
      isRequired: boolean;
      maxSelections: number;
      options: Array<{
        name: string;
        priceAdjustment: number | string;
        materialId?: string | null;
        materialQty?: number | string | null;
      }>;
    }>;
  } | null;
}

export interface PosMenuCategory {
  name: string;
  items: PosMenuItem[];
}

// ─── POS Table ───────────────────────────────────────────────────────────────

export interface PosTable {
  id: string;
  label: string;
  capacity: number;
  status: TableStatus;
  currentOrderId?: string | null;
}

// ─── Mark as Paid ────────────────────────────────────────────────────────────

// The method actually used to settle a payment — excludes PAY_LATER, which
// only makes sense as a deferred choice at checkout, not as a record of how
// money changed hands, and SPLIT, which labels a multi-tender bill rather than
// being a tender itself (each tender is one of these).
export type SettlePaymentMethod = Exclude<PaymentMethod, "PAY_LATER" | "SPLIT">;

// ─── Checkout ────────────────────────────────────────────────────────────────

export interface CheckoutFormValues {
  paymentMethod: PaymentMethod;
  orderType: OrderType;
  tableId?: string;
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  amountTendered?: number;
}

// ─── SSE ─────────────────────────────────────────────────────────────────────

export interface OrdersSSEMessage {
  type: "orders";
  orders: PosOrderDisplay[];
}

// ─── Order History ───────────────────────────────────────────────────────────

export interface OrderHistoryItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  source: OrderSource;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  // Cashier-typed label when paymentMethod is "OTHER" (also doubles as the
  // free-text note from Mark Paid) — see order-history-detail-dialog.tsx.
  paymentNote?: string | null;
  /** Per-tender breakdown. Absent on orders that predate multi-tender — fall back to paymentMethod/total. */
  payments?: OrderPaymentDto[];
  customerId?: string | null;
  splitGroupId?: string | null;
  pointsRedeemed?: number;
  pointsEarned?: number;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  /** Call-out number, #1, #2… per store per local day. Null on orders that predate it. */
  queueNumber?: number | null;
  notes?: string | null;
  subtotal: string | number;
  tax: string | number;
  delivery: string | number;
  total: string | number;
  discountAmount?: string | number;
  discountReason?: string | null;
  refundAmount?: string | number;
  refundedAt?: string | null;
  refundReason?: string | null;
  orderDate: string;
  createdAt: string;
  deliveredDate?: string | null;
  table?: { label: string } | null;
  /** Free-text table the storefront/manual flow records instead of a Table row. */
  tableNumber?: string | null;
  items: {
    id: string;
    name: string;
    quantity: string | number;
    unitPrice: string | number;
    total: string | number;
    menuItem?: { name: string } | null;
  }[];
}

export interface OrderHistoryPage {
  orders: OrderHistoryItem[];
  nextCursor: string | null;
  totalCount: number;
}

export interface OrderHistoryFilters {
  q: string;
  status: string;
  source: string;
  from: string;
  to: string;
  unpaidOnly: boolean;
  productId: string;
  department: string;
  staffId: string;
  paymentMethod: string;
}
