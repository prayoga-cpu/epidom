import type { Prisma } from "@prisma/client";
import { materialRepository } from "@/lib/repositories/material.repository";
import { productRepository } from "@/lib/repositories/product.repository";
import { toDecimal } from "@/lib/utils/types.server";

/**
 * Shared Material/Product resolution for any flow that mutates stock
 * (stock adjustments, waste entries, ...). Materials and Products store
 * their cost under different field names/precision (Material.unitCost is
 * Decimal(14,6), Product.costPrice is Decimal(10,2)) — this normalizes both
 * to a single shape so callers don't need to branch on item kind themselves.
 */
export interface ResolvedStockItem {
  kind: "material" | "product";
  id: string;
  currentStock: number;
  unit: string;
  unitCost: number;
}

type PrismaTx = Prisma.TransactionClient;

export async function resolveStockItem(
  storeId: string,
  { materialId, productId }: { materialId?: string; productId?: string }
): Promise<ResolvedStockItem> {
  if (!materialId && !productId) {
    throw new Error("Either materialId or productId must be provided");
  }

  if (materialId) {
    const material = await materialRepository.findById(materialId);
    if (!material) {
      throw new Error("Material not found");
    }
    const belongsToStore = await materialRepository.belongsToStore(materialId, storeId);
    if (!belongsToStore) {
      throw new Error("Material does not belong to this store");
    }
    return {
      kind: "material",
      id: material.id,
      currentStock: Number(material.currentStock),
      unit: material.unit,
      unitCost: Number(material.unitCost),
    };
  }

  const product = await productRepository.findById(productId!);
  if (!product) {
    throw new Error("Product not found");
  }
  const belongsToStore = await productRepository.belongsToStore(productId!, storeId);
  if (!belongsToStore) {
    throw new Error("Product does not belong to this store");
  }
  return {
    kind: "product",
    id: product.id,
    currentStock: Number(product.currentStock),
    unit: product.unit,
    unitCost: Number(product.costPrice),
  };
}

export async function applyStockDelta(
  tx: PrismaTx,
  item: ResolvedStockItem,
  newStock: number
): Promise<void> {
  if (item.kind === "material") {
    await tx.material.update({
      where: { id: item.id },
      data: { currentStock: toDecimal(newStock) },
    });
  } else {
    await tx.product.update({
      where: { id: item.id },
      data: { currentStock: toDecimal(newStock) },
    });
  }
}
