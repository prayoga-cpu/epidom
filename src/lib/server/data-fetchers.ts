/**
 * Server-side data fetching utilities
 *
 * These functions fetch data directly from repositories for Server Components.
 * They return data in the same format as API responses for compatibility with
 * TanStack Query initialData.
 */

import {
  materialRepository,
  type MaterialWithSuppliers,
  type MaterialFilters,
} from "@/lib/repositories/material.repository";
import { recipeRepository, type RecipeFilters } from "@/lib/repositories/recipe.repository";
import { productRepository, type ProductFilters } from "@/lib/repositories/product.repository";
import {
  supplierRepository,
  type SupplierWithRelations,
  type SupplierFilters,
} from "@/lib/repositories/supplier.repository";
import type { RecipeWithIngredients } from "@/features/dashboard/data/recipes/hooks/use-recipes";
import type { Product } from "@/features/dashboard/data/products/hooks/use-products";
import {
  productionBatchRepository,
  type ProductionBatchWithRelations,
  type ProductionBatchFilters,
} from "@/lib/repositories/production-batch.repository";
import { userRepository } from "@/lib/repositories/user.repository";
import type { UserProfileDto } from "@/types/dto";
import { prisma } from "@/lib/prisma";
import type {
  SupplierOrder,
  SupplierOrdersResponse,
} from "@/features/dashboard/tracking/hooks/use-supplier-orders";
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
  // Use default filters matching client-side defaults for query key matching
  const defaultFilters: RecipeFilters = {
    sortBy: "createdAt",
    sortOrder: "desc",
    skip: 0,
    take: 20,
    ...filters,
  };

  const result = await recipeRepository.findAll(storeId, defaultFilters);
  // Serialize Decimal fields to numbers for Client Components
  const serialized = {
    recipes: serializeRecipes(result.recipes),
    total: result.total,
  };

  // Deep serialize using JSON to ensure all Decimal objects are converted
  // This is a safety measure to catch any Decimal objects that might have been missed
  // Note: Date objects will be converted to ISO strings, which is fine for Next.js serialization
  return JSON.parse(
    JSON.stringify(serialized, (key, value) => {
      // Handle Date objects - convert to ISO string (Next.js will handle this correctly)
      if (value instanceof Date) {
        return value.toISOString();
      }
      // If value is a Decimal object (has toString method and is object), convert to number
      if (value !== null && typeof value === "object" && typeof value.toString === "function") {
        // Check if it looks like a Decimal (has toString that returns a number string)
        // Exclude Date objects (they have toString but return ISO strings)
        try {
          const str = value.toString();
          // Skip if it's a Date string (contains T or Z)
          if (str.includes("T") || str.includes("Z")) {
            return value;
          }
          const num = parseFloat(str);
          // Check if it's a valid number string
          if (!isNaN(num) && str.match(/^-?\d*\.?\d+$/)) {
            return num;
          }
        } catch {
          // Not a Decimal, return as is
        }
      }
      return value;
    })
  );
}

/**
 * Fetch products for a store
 */
export async function fetchProductsForPage(
  storeId: string,
  filters?: ProductFilters
): Promise<ProductsResponse> {
  // Use default filters matching client-side defaults for query key matching
  const defaultFilters: ProductFilters = {
    sortBy: "createdAt",
    sortOrder: "desc",
    skip: 0,
    take: 20,
    ...filters,
  };

  const result = await productRepository.findAll(storeId, defaultFilters);
  // Serialize Decimal fields to numbers for Client Components
  const serialized = {
    products: serializeProducts(result.products),
    total: result.total,
  };

  // Deep serialize using JSON to ensure all Decimal objects are converted
  // This is a safety measure to catch any Decimal objects that might have been missed
  // Note: Date objects will be converted to ISO strings, which is fine for Next.js serialization
  return JSON.parse(
    JSON.stringify(serialized, (key, value) => {
      // Handle Date objects - convert to ISO string (Next.js will handle this correctly)
      if (value instanceof Date) {
        return value.toISOString();
      }
      // If value is a Decimal object (has toString method and is object), convert to number
      if (value !== null && typeof value === "object" && typeof value.toString === "function") {
        // Check if it looks like a Decimal (has toString that returns a number string)
        // Exclude Date objects (they have toString but return ISO strings)
        try {
          const str = value.toString();
          // Skip if it's a Date string (contains T or Z)
          if (str.includes("T") || str.includes("Z")) {
            return value;
          }
          const num = parseFloat(str);
          // Check if it's a valid number string
          if (!isNaN(num) && str.match(/^-?\d*\.?\d+$/)) {
            return num;
          }
        } catch {
          // Not a Decimal, return as is
        }
      }
      return value;
    })
  );
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
export async function fetchSupplierOrdersForPage(storeId: string): Promise<SupplierOrdersResponse> {
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
  // Optimize: Use raw query to filter at DB level (currentStock <= minStock)
  // This avoids loading thousands of items into memory just to find a few alerts
  // Note: We use double quotes for column names to handle case sensitivity in Postgres if needed,
  // but Prisma usually creates columns matching field names unless mapped.
  // Table name is "ingredients" based on @@map("ingredients") in schema
  const lowStockIds = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "ingredients"
    WHERE "storeId" = ${storeId}
    AND "currentStock" <= "minStock"
    ORDER BY "currentStock" ASC
    LIMIT 100
  `;

  // If no low stock items, return empty early
  if (!lowStockIds.length) {
    return { alerts: [] };
  }

  // Fetch full details only for the filtered items
  const lowStockMaterials = await prisma.material.findMany({
    where: {
      id: {
        in: lowStockIds.map((row) => row.id),
      },
    },
    include: {
      materialSuppliers: {
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
    // Maintain the sort order from the raw query effectively by sorting in memory
    // or we can trust the ID order if we map carefully, but explicit sort is safer here
    // since we want most critical (lowest stock %) first
  });

  // Sort by severity (stock percentage) logic
  lowStockMaterials.sort((a, b) => {
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
