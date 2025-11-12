import { apiClient } from "./client";
import {
  CreateBusinessInput,
  UpdateBusinessInput,
  CreateStoreInput,
  UpdateStoreInput,
} from "@/lib/validation/business.schemas";
import { BusinessDto, BusinessWithStoresDto, StoreDto } from "@/types/dto";

/**
 * Business API Client
 *
 * Type-safe methods for business and store operations
 */
export class BusinessApi {
  // ============ Business Operations ============

  /**
   * Get current user's business
   */
  async getBusiness(): Promise<BusinessDto> {
    return apiClient.get("/user/business");
  }

  /**
   * Get business with stores
   */
  async getBusinessWithStores(): Promise<BusinessWithStoresDto> {
    return apiClient.get("/user/business?include=stores");
  }

  /**
   * Create business
   */
  async createBusiness(input: CreateBusinessInput): Promise<BusinessDto> {
    return apiClient.post("/user/business", input);
  }

  /**
   * Update business
   */
  async updateBusiness(input: UpdateBusinessInput): Promise<BusinessDto> {
    return apiClient.patch("/user/business", input);
  }

  /**
   * Delete business
   */
  async deleteBusiness(): Promise<{ message: string }> {
    return apiClient.delete("/user/business");
  }

  /**
   * Get business statistics
   */
  async getBusinessStats(): Promise<{
    totalStores: number;
    activeStores: number;
  }> {
    return apiClient.get("/user/business/stats");
  }

  // ============ Store Operations ============

  /**
   * Get all stores for current business
   */
  async getStores(): Promise<StoreDto[]> {
    return apiClient.get("/user/business/stores");
  }

  /**
   * Get store by ID
   */
  async getStore(storeId: string): Promise<StoreDto> {
    return apiClient.get(`/user/business/stores/${storeId}`);
  }

  /**
   * Create store
   */
  async createStore(input: CreateStoreInput): Promise<StoreDto> {
    return apiClient.post("/user/business/stores", input);
  }

  /**
   * Update store
   */
  async updateStore(storeId: string, input: UpdateStoreInput): Promise<StoreDto> {
    return apiClient.patch(`/user/business/stores/${storeId}`, input);
  }

  /**
   * Delete store (hard delete)
   * WARNING: This will permanently delete the store and cascade delete all related data
   */
  async deleteStore(storeId: string): Promise<{ message: string }> {
    return apiClient.delete(`/user/business/stores/${storeId}`);
  }
}

// Export singleton instance
export const businessApi = new BusinessApi();
