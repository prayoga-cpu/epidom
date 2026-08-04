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
  menuItemId: string;
  name: string;
  unitPrice: number; // base price
  quantity: number;
  modifiers: CartModifier[];
  notes?: string;
  lineTotal: number; // (unitPrice + sum(modifiers)) * quantity
  imageUrl?: string | null;
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
  notes?: string | null;
  selectedOptions?: CartModifier[] | null;
  menuItem?: { name: string; department?: "KITCHEN" | "BAR" | null } | null;
}

export interface PosOrderDisplay {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  source: OrderSource;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  customerName: string;
  customerPhone?: string | null;
  tableLabel?: string | null;
  tableNumber?: string | null;
  notes?: string | null;
  subtotal: number;
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
  department?: "KITCHEN" | "BAR" | null;
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
  customerName: string;
  customerPhone?: string | null;
  notes?: string | null;
  subtotal: string | number;
  tax: string | number;
  delivery: string | number;
  total: string | number;
  orderDate: string;
  createdAt: string;
  deliveredDate?: string | null;
  table?: { label: string } | null;
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
}
