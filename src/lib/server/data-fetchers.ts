/**
 * Server-side data fetching utilities
 *
 * These functions fetch data directly from repositories for Server Components.
 * They return data in the same format as API responses for compatibility with
 * TanStack Query initialData.
 */

import { materialRepository, type MaterialWithSuppliers, type MaterialFilters } from "@/lib/repositories/material.repository";
import { recipeRepository, type RecipeFilters } from "@/lib/repositories/recipe.repository";
import { productRepository, type ProductFilters } from "@/lib/repositories/product.repository";
import { supplierRepository, type SupplierWithRelations, type SupplierFilters } from "@/lib/repositories/supplier.repository";
import type { RecipeWithIngredients } from "@/features/dashboard/data/recipes/hooks/use-recipes";
import type { Product } from "@/features/dashboard/data/products/hooks/use-products";
import { productionBatchRepository, type ProductionBatchWithRelations, type ProductionBatchFilters } from "@/lib/repositories/production-batch.repository";
import { userRepository } from "@/lib/repositories/user.repository";
import type { UserProfileDto } from "@/types/dto";
import { prisma } from "@/lib/prisma";
import type { SupplierOrder, SupplierOrdersResponse } from "@/features/dashboard/tracking/hooks/use-supplier-orders";
import type { Alert, AlertsResponse } from "@/features/dashboard/tracking/hooks/use-alerts";
import {
  serializeMaterials,
  serializeSuppliers,
  serializeProductionBatches,
  serializeProducts,
  serializeRecipes,
} from "./serialize";

/**
 * Response types matching hook return types
 */
export interface MaterialsResponse {
  materials: MaterialWithSuppliers[];
  total: number;
}

export interface RecipesResponse {
  recipes: RecipeWithIngredients[];
  total: number;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
}

export interface SuppliersResponse {
  suppliers: SupplierWithRelations[];
  total: number;
}

export interface ProductionBatchesResponse {
  batches: ProductionBatchWithRelations[];
  total: number;
}

/**
 * Fetch materials for a store
 */
export async function fetchMaterialsForPage(
  storeId: string,
  filters?: MaterialFilters
): Promise<MaterialsResponse> {
  const result = await materialRepository.findAll(storeId, filters || {});
  // Serialize Decimal fields to numbers for Client Components
  return {
    materials: serializeMaterials(result.materials),
    total: result.total,
  };
}

/**
 * Fetch recipes for a store
 */
export async function fetchRecipesForPage(
  storeId: string,
  filters?: RecipeFilters
): Promise<RecipesResponse> {
  const result = await recipeRepository.findAll(storeId, filters || {});
  // Serialize Decimal fields to numbers for Client Components
  return {
    recipes: serializeRecipes(result.recipes),
    total: result.total,
  };
}

/**
 * Fetch products for a store
 */
export async function fetchProductsForPage(
  storeId: string,
  filters?: ProductFilters
): Promise<ProductsResponse> {
  const result = await productRepository.findAll(storeId, filters || {});
  // Serialize Decimal fields to numbers for Client Components
  return {
    products: serializeProducts(result.products),
    total: result.total,
  };
}

/**
 * Fetch suppliers for a store
 */
export async function fetchSuppliersForPage(
  storeId: string,
  filters?: SupplierFilters
): Promise<SuppliersResponse> {
  const result = await supplierRepository.findAll(storeId, filters || {});
  // Serialize Decimal fields to numbers for Client Components
  return {
    suppliers: serializeSuppliers(result.suppliers),
    total: result.total,
  };
}

/**
 * Fetch production batches for a store
 */
export async function fetchProductionBatchesForPage(
  storeId: string,
  filters?: ProductionBatchFilters
): Promise<ProductionBatchesResponse> {
  const result = await productionBatchRepository.findAll(storeId, filters || {});
  // Serialize Decimal fields to numbers for Client Components
  return {
    batches: serializeProductionBatches(result.batches),
    total: result.total,
  };
}

/**
 * Fetch supplier orders for a store
 * Note: No repository exists, so we fetch directly via Prisma
 */
export async function fetchSupplierOrdersForPage(
  storeId: string
): Promise<SupplierOrdersResponse> {
  const orders = await prisma.supplierOrder.findMany({
    where: { storeId },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      items: {
        include: {
          material: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
            },
          },
        },
      },
    },
    orderBy: {
      orderDate: "desc",
    },
  });

  // Transform to match SupplierOrder type from hook
  const transformedOrders: SupplierOrder[] = orders.map((order) => ({
    id: order.id,
    storeId: order.storeId,
    supplierId: order.supplierId,
    supplier: {
      id: order.supplier.id,
      name: order.supplier.name,
      email: order.supplier.email,
      phone: order.supplier.phone,
    },
    orderNumber: order.orderNumber,
    status: order.status,
    orderDate: order.orderDate.toISOString(),
    expectedDate: order.expectedDate?.toISOString() || null,
    receivedDate: order.receivedDate?.toISOString() || null,
    subtotal: Number(order.subtotal),
    tax: Number(order.tax),
    shipping: Number(order.shipping),
    total: Number(order.total),
    notes: order.notes,
    items: order.items.map((item) => ({
      id: item.id,
      materialId: item.materialId,
      material: {
        id: item.material.id,
        name: item.material.name,
        sku: item.material.sku || "",
        unit: item.material.unit,
      },
      quantity: Number(item.quantity),
      unit: item.unit,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  }));

  return { orders: transformedOrders };
}

/**
 * Fetch alerts for a store
 * Note: Alerts are computed from materials (low stock), so we fetch and process
 */
export async function fetchAlertsForPage(storeId: string): Promise<AlertsResponse> {
  // Get all active materials for the store
  const allMaterials = await prisma.material.findMany({
    where: {
      storeId,
      isActive: true,
    },
    include: {
      materialSuppliers: {
        where: {
          supplier: {
            isActive: true,
          },
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
        },
      },
    },
  });

  // Filter materials where currentStock <= minStock
  const lowStockMaterials = allMaterials
    .filter((material) => {
      const currentStock = Number(material.currentStock);
      const minStock = Number(material.minStock);
      return currentStock <= minStock;
    })
    .sort((a, b) => {
      // Sort by stock percentage (most critical first)
      const aPercent = Number(a.minStock) > 0 ? Number(a.currentStock) / Number(a.minStock) : 0;
      const bPercent = Number(b.minStock) > 0 ? Number(b.currentStock) / Number(b.minStock) : 0;
      if (aPercent !== bPercent) return aPercent - bPercent;
      return a.name.localeCompare(b.name);
    });

  // Format alerts to match Alert type from hook
  const alerts: Alert[] = lowStockMaterials.map((material) => {
    const currentStockNum = Number(material.currentStock);
    const minStockNum = Number(material.minStock);
    const stockPercentage = minStockNum > 0 ? (currentStockNum / minStockNum) * 100 : 0;

    let severity: "critical" | "warning" = "warning";
    if (stockPercentage <= 25) {
      severity = "critical";
    }

    return {
      id: material.id,
      type: "LOW_STOCK" as const,
      severity,
      materialId: material.id,
      materialName: material.name,
      materialSku: material.sku || "",
      currentStock: currentStockNum,
      minStock: minStockNum,
      unit: material.unit,
      stockPercentage,
      suppliers: material.materialSuppliers
        .filter((ms) => ms.supplier)
        .map((ms) => ({
          id: ms.supplier!.id,
          name: ms.supplier!.name,
          price: Number(ms.price),
          isPreferred: ms.isPreferred,
          phone: ms.supplier!.phone || null,
        })),
      createdAt: new Date().toISOString(),
    };
  });

  return { alerts };
}

/**
 * Fetch user profile
 */
export async function fetchUserProfile(userId: string): Promise<UserProfileDto | null> {
  return userRepository.getProfile(userId);
}

