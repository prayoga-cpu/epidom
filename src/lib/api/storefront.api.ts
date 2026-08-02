import { apiClient } from "./client";
import {
  UpdateStorefrontInput,
  CreateMenuCategoryInput,
  UpdateMenuCategoryInput,
  CreateMenuItemInput,
  UpdateMenuItemInput,
} from "@/lib/validation/storefront.schemas";
import type { CategoryDeleteMode } from "@/lib/validation/inventory.schemas";

export class StorefrontApi {
  // ============ Storefront Operations ============

  async getStorefront(storeId: string): Promise<any> {
    return apiClient.get(`/stores/${storeId}/storefront`);
  }

  async updateStorefront(storeId: string, input: UpdateStorefrontInput): Promise<any> {
    return apiClient.patch(`/stores/${storeId}/storefront`, input);
  }

  // ============ Category Operations ============

  async getCategories(storeId: string): Promise<any[]> {
    return apiClient.get(`/stores/${storeId}/storefront/categories`);
  }

  async createCategory(storeId: string, input: CreateMenuCategoryInput): Promise<any> {
    return apiClient.post(`/stores/${storeId}/storefront/categories`, input);
  }

  async updateCategory(
    storeId: string,
    categoryId: string,
    input: UpdateMenuCategoryInput
  ): Promise<any> {
    return apiClient.patch(`/stores/${storeId}/storefront/categories/${categoryId}`, input);
  }

  async deleteCategory(
    storeId: string,
    categoryId: string,
    mode: CategoryDeleteMode = "uncategorize"
  ): Promise<{ success: boolean; mode: CategoryDeleteMode }> {
    return apiClient.delete(`/stores/${storeId}/storefront/categories/${categoryId}`, { mode });
  }

  // ============ Item Operations ============

  async createItem(storeId: string, input: CreateMenuItemInput): Promise<any> {
    return apiClient.post(`/stores/${storeId}/storefront/items`, input);
  }

  async updateItem(storeId: string, itemId: string, input: UpdateMenuItemInput): Promise<any> {
    return apiClient.patch(`/stores/${storeId}/storefront/items/${itemId}`, input);
  }

  async deleteItem(storeId: string, itemId: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/stores/${storeId}/storefront/items/${itemId}`);
  }
}

export const storefrontApi = new StorefrontApi();
