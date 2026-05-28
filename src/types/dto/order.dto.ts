/**
 * Order Data Transfer Objects (DTOs)
 *
 * These types represent order-related data structures
 */

import type { Decimal } from "@prisma/client/runtime/client";
import { ProductDto } from "./inventory.dto";

// Order DTO
export interface OrderDto {
  id: string;
  storeId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  status: "PENDING" | "CONFIRMED" | "IN_PRODUCTION" | "READY" | "DELIVERED" | "CANCELLED";
  orderDate: Date;
  dueDate: Date | null;
  deliveredDate: Date | null;
  subtotal: Decimal;
  tax: Decimal;
  delivery: Decimal;
  total: Decimal;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Order with items
export interface OrderWithItemsDto extends OrderDto {
  items: OrderItemDto[];
}

// Order item DTO
export interface OrderItemDto {
  id: string;
  orderId: string;
  productId: string;
  product: ProductDto;
  quantity: Decimal;
  unit: string;
  unitPrice: Decimal;
  total: Decimal;
  createdAt: Date;
  updatedAt: Date;
}

// Order summary (for lists)
export interface OrderSummaryDto {
  id: string;
  orderNumber: string;
  customerName: string;
  status: OrderDto["status"];
  total: Decimal;
  orderDate: Date;
  dueDate: Date | null;
  itemCount: number;
}
