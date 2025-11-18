import { Material, MovementType } from "@prisma/client";
import {
  materialRepository,
  MaterialRepository,
  MaterialWithSuppliers,
  MaterialFilters,
} from "@/lib/repositories/material.repository";
import { prisma } from "@/lib/prisma";

/**
 * Material (Ingredient) Service
 *
 * Handles material management business logic:
 * - Material CRUD operations
 * - Stock movement tracking
 * - Supplier relationship management
 * - Stock status monitoring
 * - Bulk operations
 *
 * Implements business rules and validation
 */

export interface CreateMaterialInput {
  storeId: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  unitCost: number;
  currentStock?: number;
  minStock?: number;
  maxStock?: number;
  suppliers?: Array<{
    supplierId: string;
    price: number;
    isPreferred?: boolean;
  }>;
}

export interface UpdateMaterialInput {
  sku?: string;
  name?: string;
  description?: string;
  category?: string;
  unit?: string;
  unitCost?: number;
  currentStock?: number;
  minStock?: number;
  maxStock?: number;
  suppliers?: Array<{
    supplierId: string;
    price: number;
    isPreferred?: boolean;
  }>;
}

export interface UpdateSupplierInput {
  price?: number;
  isPreferred?: boolean;
}

export class MaterialService {
  constructor(private readonly materialRepo: MaterialRepository = materialRepository) {}

  /**
   * Get all materials for a store with filtering
   */
  async getMaterials(
    storeId: string,
    filters: MaterialFilters = {}
  ): Promise<{ materials: MaterialWithSuppliers[]; total: number }> {
    return this.materialRepo.findAll(storeId, filters);
  }

  /**
   * Get material by ID
   */
  async getMaterialById(materialId: string): Promise<MaterialWithSuppliers> {
    const material = await this.materialRepo.findById(materialId);
    if (!material) {
      throw new Error("Material not found");
    }
    return material;
  }

  /**
   * Get material by SKU and storeId
   */
  async getMaterialBySku(storeId: string, sku: string): Promise<MaterialWithSuppliers | null> {
    return this.materialRepo.findBySku(storeId, sku);
  }

  /**
   * Get materials with low stock
   */
  async getLowStockMaterials(storeId: string): Promise<MaterialWithSuppliers[]> {
    return this.materialRepo.findLowStock(storeId);
  }

  /**
   * Create a new material
   */
  async createMaterial(input: CreateMaterialInput): Promise<MaterialWithSuppliers> {
    const { storeId, sku, currentStock = 0, suppliers, ...rest } = input;

    // Check if SKU already exists
    const skuExists = await this.materialRepo.existsBySku(storeId, sku);
    if (skuExists) {
      throw new Error("A material with this SKU already exists in your store");
    }

    // Ensure only one supplier is marked as preferred
    if (suppliers && suppliers.length > 0) {
      const preferredCount = suppliers.filter((s) => s.isPreferred).length;
      if (preferredCount > 1) {
        throw new Error("Only one supplier can be marked as preferred");
      }
    }

    // Use transaction to ensure atomicity
    return await prisma.$transaction(async (tx) => {
      // Create material with suppliers
      const material = await this.materialRepo.create({
        storeId,
        sku,
        currentStock,
        suppliers,
        ...rest,
      });

      // If initial stock > 0, create initial stock movement
      if (currentStock > 0) {
        await tx.stockMovement.create({
          data: {
            materialId: material.id,
            type: MovementType.ADJUSTMENT,
            quantity: currentStock,
            unit: material.unit,
            balanceAfter: currentStock,
            notes: "Initial stock",
          },
        });
      }

      return material;
    });
  }

  /**
   * Adjust stock for a material or product
   * Creates a stock movement record with reason, notes, and referenceId
   */
  async adjustStock(
    storeId: string,
    input: {
      materialId?: string;
      productId?: string;
      adjustmentType: "IN" | "OUT";
      quantity: number;
      reason: string;
      notes?: string;
      referenceId?: string;
    }
  ): Promise<{ material?: Material; product?: any; movement: any }> {
    if (!input.materialId && !input.productId) {
      throw new Error("Either materialId or productId must be provided");
    }

    // For now, only support materials (products can be added later)
    if (!input.materialId) {
      throw new Error("Product stock adjustment not yet implemented");
    }

    const material = await this.materialRepo.findById(input.materialId);
    if (!material) {
      throw new Error("Material not found");
    }

    const belongsToStore = await this.materialRepo.belongsToStore(input.materialId, storeId);
    if (!belongsToStore) {
      throw new Error("Material does not belong to this store");
    }

    const oldStock = Number(material.currentStock);
    const adjustmentQuantity = input.quantity;
    const isIncrease = input.adjustmentType === "IN";
    const newStock = isIncrease ? oldStock + adjustmentQuantity : oldStock - adjustmentQuantity;

    if (newStock < 0) {
      throw new Error("Stock cannot be negative");
    }

    // Use transaction to ensure atomicity
    return await prisma.$transaction(async (tx) => {
      // Create stock movement with all adjustment data
      const movement = await tx.stockMovement.create({
        data: {
          materialId: input.materialId,
          type: MovementType.ADJUSTMENT,
          quantity: isIncrease ? adjustmentQuantity : -adjustmentQuantity, // Signed quantity
          unit: material.unit,
          balanceAfter: newStock,
          notes: input.notes || undefined,
          reason: input.reason,
          referenceId: input.referenceId || undefined,
        },
      });

      // Update material stock
      const updatedMaterial = await tx.material.update({
        where: { id: input.materialId },
        data: {
          currentStock: newStock as any,
        },
      });

      return {
        material: updatedMaterial,
        movement,
      };
    });
  }

  /**
   * Update material
   */
  async updateMaterial(
    materialId: string,
    storeId: string,
    input: UpdateMaterialInput
  ): Promise<Material> {
    // Verify material exists and belongs to store
    const material = await this.materialRepo.findById(materialId);
    if (!material) {
      throw new Error("Material not found");
    }

    const belongsToStore = await this.materialRepo.belongsToStore(materialId, storeId);
    if (!belongsToStore) {
      throw new Error("Material does not belong to this store");
    }

    // If updating SKU, check uniqueness
    if (input.sku && input.sku !== material.sku) {
      const skuExists = await this.materialRepo.existsBySku(storeId, input.sku, materialId);
      if (skuExists) {
        throw new Error("A material with this SKU already exists in your store");
      }
    }

    // Ensure only one supplier is marked as preferred
    if (input.suppliers && input.suppliers.length > 0) {
      const preferredCount = input.suppliers.filter((s) => s.isPreferred).length;
      if (preferredCount > 1) {
        throw new Error("Only one supplier can be marked as preferred");
      }
    }

    // Use transaction if stock is changing or suppliers are being updated
    if (
      (input.currentStock !== undefined && input.currentStock !== Number(material.currentStock)) ||
      input.suppliers !== undefined
    ) {
      return await prisma.$transaction(async (tx) => {
        // Handle stock changes
        if (
          input.currentStock !== undefined &&
          input.currentStock !== Number(material.currentStock)
        ) {
          const oldStock = Number(material.currentStock);
          const newStock = input.currentStock!;
          const difference = newStock - oldStock;

          // Create stock movement with signed quantity
          await tx.stockMovement.create({
            data: {
              materialId: materialId,
              type: MovementType.ADJUSTMENT,
              quantity: difference, // Keep the sign: positive for increase, negative for decrease
              unit: material.unit,
              balanceAfter: newStock,
              notes: `Stock ${difference > 0 ? "increase" : "decrease"} - Manual adjustment`,
            },
          });
        }

        // Handle supplier updates
        if (input.suppliers !== undefined) {
          // Delete existing supplier relationships
          await tx.materialSupplier.deleteMany({
            where: { materialId },
          });

          // Create new supplier relationships if any
          if (input.suppliers.length > 0) {
            await tx.materialSupplier.createMany({
              data: input.suppliers.map((s) => ({
                materialId,
                supplierId: s.supplierId,
                price: s.price,
                isPreferred: s.isPreferred ?? false,
              })),
            });
          }
        }

        // Convert numbers to Decimal for Prisma
        const updateData: Partial<Material> = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.sku !== undefined) updateData.sku = input.sku;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.category !== undefined) updateData.category = input.category;
        if (input.unit !== undefined) updateData.unit = input.unit;
        if (input.unitCost !== undefined) updateData.unitCost = input.unitCost as any;
        if (input.currentStock !== undefined) updateData.currentStock = input.currentStock as any;
        if (input.minStock !== undefined) updateData.minStock = input.minStock as any;
        if (input.maxStock !== undefined) updateData.maxStock = input.maxStock as any;

        // Update material
        return await tx.material.update({
          where: { id: materialId },
          data: updateData,
        });
      });
    }

    // No stock change and no suppliers update, just update basic properties
    // Convert numbers to Decimal for Prisma
    const updateData: Partial<Material> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.sku !== undefined) updateData.sku = input.sku;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.unit !== undefined) updateData.unit = input.unit;
    if (input.unitCost !== undefined) updateData.unitCost = input.unitCost as any;
    if (input.currentStock !== undefined) updateData.currentStock = input.currentStock as any;
    if (input.minStock !== undefined) updateData.minStock = input.minStock as any;
    if (input.maxStock !== undefined) updateData.maxStock = input.maxStock as any;

    return this.materialRepo.update(materialId, updateData);
  }

  /**
   * Delete material
   */
  async deleteMaterial(materialId: string, storeId: string): Promise<void> {
    // Verify ownership
    const belongsToStore = await this.materialRepo.belongsToStore(materialId, storeId);
    if (!belongsToStore) {
      throw new Error("Material does not belong to this store");
    }

    // Check if material is used in any recipes
    const material = await this.materialRepo.findById(materialId);
    if (material) {
      const recipeCount = await prisma.recipeIngredient.count({
        where: { materialId: materialId },
      });

      if (recipeCount > 0) {
        throw new Error(
          `Cannot delete material because it is used in ${recipeCount} recipe(s). Please remove it from recipes first.`
        );
      }
    }

    await this.materialRepo.delete(materialId);
  }

  /**
   * Bulk delete materials
   */
  async bulkDeleteMaterials(materialIds: string[], storeId: string): Promise<number> {
    // Verify all materials belong to store
    const materials = await this.materialRepo.findByIds(materialIds);

    const invalidMaterials = materials.filter((m) => m.storeId !== storeId);
    if (invalidMaterials.length > 0) {
      throw new Error("Some materials do not belong to this store");
    }

    // Check if any materials are used in recipes
    const recipeCount = await prisma.recipeIngredient.count({
      where: { materialId: { in: materialIds } },
    });

    if (recipeCount > 0) {
      throw new Error(
        "Cannot delete materials because some are used in recipes. Please remove them from recipes first."
      );
    }

    return this.materialRepo.bulkDelete(materialIds);
  }

  /**
   * Add supplier to material
   */
  async addSupplier(
    materialId: string,
    storeId: string,
    supplierId: string,
    price: number,
    isPreferred: boolean = false
  ): Promise<void> {
    // Verify material belongs to store
    const belongsToStore = await this.materialRepo.belongsToStore(materialId, storeId);
    if (!belongsToStore) {
      throw new Error("Material does not belong to this store");
    }

    // Verify supplier belongs to same store
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { storeId: true },
    });

    if (!supplier || supplier.storeId !== storeId) {
      throw new Error("Supplier not found or does not belong to this store");
    }

    // Check if supplier is already linked
    const material = await this.materialRepo.findById(materialId);
    if (material?.materialSuppliers.some((s) => s.supplierId === supplierId)) {
      throw new Error("Supplier is already linked to this material");
    }

    await this.materialRepo.addSupplier(materialId, supplierId, price, isPreferred);
  }

  /**
   * Remove supplier from material
   */
  async removeSupplier(materialId: string, storeId: string, supplierId: string): Promise<void> {
    // Verify material belongs to store
    const belongsToStore = await this.materialRepo.belongsToStore(materialId, storeId);
    if (!belongsToStore) {
      throw new Error("Material does not belong to this store");
    }

    await this.materialRepo.removeSupplier(materialId, supplierId);
  }

  /**
   * Update supplier for material
   */
  async updateSupplier(
    materialId: string,
    storeId: string,
    supplierId: string,
    input: UpdateSupplierInput
  ): Promise<void> {
    // Verify material belongs to store
    const belongsToStore = await this.materialRepo.belongsToStore(materialId, storeId);
    if (!belongsToStore) {
      throw new Error("Material does not belong to this store");
    }

    await this.materialRepo.updateSupplier(materialId, supplierId, input);
  }

  /**
   * Export materials to CSV
   */
  async exportMaterialsToCSV(storeId: string, filters: MaterialFilters = {}): Promise<string> {
    const { materials } = await this.materialRepo.findAll(storeId, filters);

    // CSV header
    const headers = [
      "SKU",
      "Name",
      "Category",
      "Unit",
      "Unit Cost",
      "Current Stock",
      "Min Stock",
      "Max Stock",
      "Stock Status",
      "Suppliers",
      "Description",
    ];

    // CSV rows
    const rows = materials.map((material) => {
      const current = Number(material.currentStock);
      const min = Number(material.minStock);
      const max = Number(material.maxStock);

      let stockStatus = "In Stock";
      if (current <= 0) stockStatus = "Out of Stock";
      else if (current <= min) stockStatus = "Low Stock";
      else if (current > max) stockStatus = "Overstocked";

      const suppliers = material.materialSuppliers
        .map((s) => `${s.supplier.name} ($${Number(s.price).toFixed(2)})`)
        .join("; ");

      return [
        material.sku,
        material.name,
        material.category || "",
        material.unit,
        Number(material.unitCost).toFixed(2),
        current,
        min,
        max,
        stockStatus,
        suppliers || "No suppliers",
        material.description || "",
      ];
    });

    // Build CSV
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => {
            // Escape quotes and wrap in quotes if contains comma or quotes
            const cellStr = String(cell);
            if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(",")
      ),
    ].join("\n");

    return csvContent;
  }

  /**
   * Record stock purchase (restock from supplier)
   */
  async recordPurchase(
    materialId: string,
    storeId: string,
    quantity: number,
    supplierId?: string,
    notes?: string
  ): Promise<void> {
    // Verify material belongs to store
    const belongsToStore = await this.materialRepo.belongsToStore(materialId, storeId);
    if (!belongsToStore) {
      throw new Error("Material does not belong to this store");
    }

    const material = await this.materialRepo.findById(materialId);
    if (!material) {
      throw new Error("Material not found");
    }

    await prisma.$transaction(async (tx) => {
      // Update stock
      const newStock = Number(material.currentStock) + quantity;
      await tx.material.update({
        where: { id: materialId },
        data: { currentStock: newStock },
      });

      // Create stock movement
      await tx.stockMovement.create({
        data: {
          materialId: materialId,
          type: MovementType.PURCHASE,
          quantity,
          unit: material.unit,
          balanceAfter: newStock,
          notes: notes || `Purchase${supplierId ? " from supplier" : ""}`,
        },
      });
    });
  }
}

// Export singleton instance
export const materialService = new MaterialService();
