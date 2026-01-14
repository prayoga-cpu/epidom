/**
 * MVP POS Types
 */

export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  unit: string;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  total: number;
}

export interface CheckoutResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
}

export interface ProductForPOS {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  sellingPrice: number;
  costPrice: number;
  currentStock: number;
  unit: string;
}
