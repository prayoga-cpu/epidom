"use server";

/**
 * MVP POS Server Actions
 *
 * Server-side actions for processing POS transactions
 */

import { prisma } from "@/lib/prisma";
import type { CartItem, CheckoutResult } from "./types";

interface CheckoutInput {
  storeId: string;
  items: CartItem[];
  total: number;
}

/**
 * Generate unique order number
 */
function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `POS-${dateStr}-${random}`;
}

/**
 * Process POS checkout
 * Creates order, order items, decrements stock, and records stock movements
 */
export async function processCheckout(
  input: CheckoutInput
): Promise<CheckoutResult> {
  const { storeId, items, total } = input;

  if (!storeId) {
    return { success: false, error: "Store ID is required" };
  }

  if (!items || items.length === 0) {
    return { success: false, error: "Cart is empty" };
  }

  try {
    // Process in a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Generate order number
      const orderNumber = generateOrderNumber();

      // Calculate subtotal
      const subtotal = items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      );

      // Create the order
      const order = await tx.order.create({
        data: {
          storeId,
          orderNumber,
          customerName: "Walk-in Customer", // POS default
          status: "DELIVERED", // POS transactions are instant
          orderDate: new Date(),
          deliveredDate: new Date(),
          subtotal,
          tax: 0,
          delivery: 0,
          total,
        },
      });

      // Create order items and update stock
      for (const item of items) {
        // Create order item with cost snapshot
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            total: item.unitPrice * item.quantity,
          },
        });

        // Get current product stock
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { currentStock: true },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.sku}`);
        }

        const currentStock = Number(product.currentStock);
        const newStock = currentStock - item.quantity;

        // Update product stock
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: Math.max(0, newStock) },
        });

        // Record stock movement for audit trail
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "SALE",
            quantity: -item.quantity, // Negative for outgoing
            unit: item.unit,
            balanceAfter: Math.max(0, newStock),
            orderId: order.id,
            notes: `POS Sale: ${orderNumber}`,
          },
        });
      }

      return { orderId: order.id, orderNumber };
    });

    return {
      success: true,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
    };
  } catch (error) {
    console.error("Checkout error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Checkout failed",
    };
  }
}

/**
 * Get products for POS
 */
export async function getProductsForPOS(storeId: string) {
  const products = await prisma.product.findMany({
    where: { storeId },
    select: {
      id: true,
      sku: true,
      name: true,
      category: true,
      sellingPrice: true,
      costPrice: true,
      currentStock: true,
      unit: true,
    },
    orderBy: { name: "asc" },
  });

  return products.map((p) => ({
    ...p,
    sellingPrice: Number(p.sellingPrice),
    costPrice: Number(p.costPrice),
    currentStock: Number(p.currentStock),
  }));
}

/**
 * Get recent transactions count for validation
 */
export async function getTransactionCount(storeId: string): Promise<number> {
  return prisma.order.count({
    where: {
      storeId,
      customerName: "Walk-in Customer", // POS transactions
    },
  });
}
