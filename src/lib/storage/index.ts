/**
 * Storage Factory
 *
 * Provides centralized access to storage adapters.
 * Allows easy switching between storage providers via environment variables.
 *
 * Environment variables:
 * - STORAGE_PROVIDER: 'vercel-blob' | 'cloudflare-r2' | 'uploadthing' (default: 'vercel-blob')
 */

import type { StorageAdapter } from "./storage-adapter.interface";
import { VercelBlobAdapter } from "./vercel-blob-adapter";

/**
 * Supported storage providers
 */
export type StorageProvider = "vercel-blob" | "cloudflare-r2" | "uploadthing";

/**
 * Get configured storage adapter
 *
 * @returns Configured storage adapter instance
 * @throws Error if provider is not supported
 */
export function getStorageAdapter(): StorageAdapter {
  const provider = (process.env.STORAGE_PROVIDER as StorageProvider) || "vercel-blob";

  switch (provider) {
    case "vercel-blob":
      return new VercelBlobAdapter();

    // Future providers can be added here:
    // case 'cloudflare-r2':
    //   return new CloudflareR2Adapter();
    // case 'uploadthing':
    //   return new UploadThingAdapter();

    default:
      return new VercelBlobAdapter();
  }
}

/**
 * Validate that storage is properly configured
 *
 * @throws Error if storage is not configured
 */
export function validateStorageConfig(): void {
  const adapter = getStorageAdapter();

  if (!adapter.isConfigured()) {
    throw new Error("Storage is not properly configured. Please check your environment variables.");
  }
}

// Re-export types
export type { StorageAdapter, UploadResult, UploadOptions } from "./storage-adapter.interface";
