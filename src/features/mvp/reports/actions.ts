"use server";

/**
 * MVP Reports Server Actions
 *
 * Fetch data for exports
 */

import { prisma } from "@/lib/prisma";

/**
 * Get products for export
 */
export async function getProductsForExport(storeId: string) {
  const products = await prisma.product.findMany({
    where: { storeId },
    select: {
      sku: true,
      name: true,
      category: true,
      unit: true,
      costPrice: true,
      sellingPrice: true,
      currentStock: true,
    },
    orderBy: { name: "asc" },
  });

  return products.map((p) => ({
    ...p,
    costPrice: Number(p.costPrice),
    sellingPrice: Number(p.sellingPrice),
    currentStock: Number(p.currentStock),
  }));
}

/**
 * Get transactions for export
 */
export async function getTransactionsForExport(storeId: string) {
  const orders = await prisma.order.findMany({
    where: {
      storeId,
      customerName: "Walk-in Customer", // POS transactions only
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              sku: true,
              name: true,
              costPrice: true,
            },
          },
        },
      },
    },
    orderBy: { orderDate: "desc" },
  });

  return orders.map((order) => {
    // Calculate total cost from order items
    const totalCost = order.items.reduce((sum, item) => {
      const costPrice = Number(item.product?.costPrice || 0);
      const quantity = Number(item.quantity);
      return sum + costPrice * quantity;
    }, 0);

    const totalRevenue = Number(order.total);
    const profit = totalRevenue - totalCost;

    return {
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      itemCount: order.items.length,
      totalQuantity: order.items.reduce((sum, item) => sum + Number(item.quantity), 0),
      totalRevenue,
      totalCost,
      profit,
      items: order.items.map((item) => ({
        sku: item.product?.sku || "",
        name: item.product?.name || "",
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        costPrice: Number(item.product?.costPrice || 0),
      })),
    };
  });
}

/**
 * Get summary stats for reports
 */
export async function getReportsSummary(storeId: string) {
  const [productCount, transactionCount, totalRevenue, totalStock] =
    await Promise.all([
      prisma.product.count({ where: { storeId } }),
      prisma.order.count({
        where: { storeId, customerName: "Walk-in Customer" },
      }),
      prisma.order.aggregate({
        where: { storeId, customerName: "Walk-in Customer" },
        _sum: { total: true },
      }),
      prisma.product.aggregate({
        where: { storeId },
        _sum: { currentStock: true },
      }),
    ]);

  return {
    productCount,
    transactionCount,
    totalRevenue: Number(totalRevenue._sum.total || 0),
    totalStock: Number(totalStock._sum.currentStock || 0),
  };
}
