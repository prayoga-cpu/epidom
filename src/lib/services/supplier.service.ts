import { Supplier } from "@prisma/client";
import {
  supplierRepository,
  SupplierWithRelations,
  SupplierFilters,
} from "../repositories/supplier.repository";
import { arrayToCSV } from "../utils/csv-export";

/**
 * Supplier Service
 *
 * Business logic layer for supplier operations.
 * Handles validation, authorization, and orchestrates repository calls.
 */
export class SupplierService {
  /**
   * Get all suppliers for a store with filtering
   */
  async getSuppliers(
    storeId: string,
    filters: SupplierFilters = {}
  ): Promise<{ suppliers: SupplierWithRelations[]; total: number }> {
    return supplierRepository.findAll(storeId, filters);
  }

  /**
   * Get supplier by ID
   */
  async getSupplierById(supplierId: string): Promise<SupplierWithRelations | null> {
    return supplierRepository.findById(supplierId);
  }

  /**
   * Create new supplier
   */
  async createSupplier(data: {
    storeId: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    notes?: string;
  }): Promise<SupplierWithRelations> {
    // Validate supplier name uniqueness within store
    const nameExists = await supplierRepository.existsByName(data.storeId, data.name);
    if (nameExists) {
      throw new Error(`Supplier with name "${data.name}" already exists in this store`);
    }

    return supplierRepository.create({
      name: data.name,
      contactPerson: data.contactPerson,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      country: data.country,
      notes: data.notes,

      store: {
        connect: { id: data.storeId },
      },
    });
  }

  /**
   * Update supplier
   */
  async updateSupplier(
    supplierId: string,
    storeId: string,
    data: {
      name?: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      country?: string;
      notes?: string;
    }
  ): Promise<SupplierWithRelations> {
    // Verify supplier belongs to store
    const belongsToStore = await supplierRepository.belongsToStore(supplierId, storeId);
    if (!belongsToStore) {
      throw new Error("Supplier does not belong to this store");
    }

    // If name is being updated, validate uniqueness within store
    if (data.name) {
      const nameExists = await supplierRepository.existsByName(storeId, data.name, supplierId);
      if (nameExists) {
        throw new Error(`Supplier with name "${data.name}" already exists in this store`);
      }
    }

    return supplierRepository.update(supplierId, data);
  }

  /**
   * Delete supplier (hard delete)
   * WARNING: This will permanently delete the supplier and cascade delete related records
   */
  async deleteSupplier(supplierId: string, storeId: string): Promise<Supplier> {
    // Verify supplier belongs to store
    const belongsToStore = await supplierRepository.belongsToStore(supplierId, storeId);
    if (!belongsToStore) {
      throw new Error("Supplier does not belong to this store");
    }

    return supplierRepository.delete(supplierId);
  }

  /**
   * Bulk delete suppliers (hard delete)
   * WARNING: This will permanently delete suppliers and cascade delete related records
   */
  async bulkDeleteSuppliers(
    supplierIds: string[],
    storeId: string
  ): Promise<{ count: number }> {
    // Verify all suppliers belong to the store
    const suppliers = await supplierRepository.findByIds(supplierIds);
    const invalidSuppliers = suppliers.filter((s) => s.storeId !== storeId);

    if (invalidSuppliers.length > 0) {
      throw new Error("One or more suppliers do not belong to this store");
    }

    return supplierRepository.bulkDelete(supplierIds);
  }

  /**
   * Export suppliers to CSV format
   */
  async exportSuppliers(storeId: string, filters: SupplierFilters = {}): Promise<string> {
    const { suppliers } = await supplierRepository.findAll(storeId, filters);

    // CSV headers
    const headers = [
      "Name",
      "Contact Person",
      "Email",
      "Phone",
      "Address",
      "City",
      "Country",
      "Notes",

      "Created At",
    ];

    // CSV column extractors
    const columns = [
      (supplier: Supplier) => supplier.name,
      (supplier: Supplier) => supplier.contactPerson || "",
      (supplier: Supplier) => supplier.email || "",
      (supplier: Supplier) => supplier.phone || "",
      (supplier: Supplier) => supplier.address || "",
      (supplier: Supplier) => supplier.city || "",
      (supplier: Supplier) => supplier.country || "",
      (supplier: Supplier) => supplier.notes || "",

      (supplier: Supplier) => new Date(supplier.createdAt).toISOString(),
    ];

    return arrayToCSV(suppliers, headers, columns);
  }
}

// Export singleton instance
export const supplierService = new SupplierService();
