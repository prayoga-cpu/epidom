/**
 * Vercel Blob Storage Adapter
 *
 * Implementation of StorageAdapter for Vercel Blob Storage.
 * Uses @vercel/blob package to interact with Vercel's storage service.
 *
 * Required environment variables:
 * - BLOB_READ_WRITE_TOKEN: Token for Vercel Blob Storage
 */

import { put, del, list } from "@vercel/blob";
import type { StorageAdapter, UploadResult, UploadOptions } from "./storage-adapter.interface";

/** Safety cap on pagination pages so a runaway store can never hang the request. */
const MAX_LIST_PAGES = 200;

export class VercelBlobAdapter implements StorageAdapter {
  private token: string | undefined;

  constructor() {
    this.token = process.env.BLOB_READ_WRITE_TOKEN;
  }

  /**
   * Check if the adapter is properly configured
   */
  isConfigured(): boolean {
    return !!this.token;
  }

  /**
   * Upload a file to Vercel Blob Storage
   */
  async upload(file: File, options?: UploadOptions): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new Error(
        "Vercel Blob Storage is not configured. Please set BLOB_READ_WRITE_TOKEN environment variable."
      );
    }

    try {
      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filename = `${timestamp}-${sanitizedName}`;

      // Construct path
      const path = options?.path ? `${options.path}/${filename}` : `uploads/${filename}`;

      // Upload to Vercel Blob
      const blob = await put(path, file, {
        access: options?.access === "private" ? "public" : "public", // Vercel Blob only supports 'public'
        token: this.token,
        ...(options?.cacheControl && {
          cacheControlMaxAge: parseInt(options.cacheControl) || 3600,
        }),
        ...(options?.metadata && { addRandomSuffix: false }),
      });

      return {
        url: blob.url,
        key: blob.pathname,
        size: file.size, // Use original file size
        contentType: blob.contentType || file.type,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to upload file to Vercel Blob: ${error.message}`);
      }
      throw new Error("Failed to upload file to Vercel Blob");
    }
  }

  /**
   * Delete a file from Vercel Blob Storage
   */
  async delete(url: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error(
        "Vercel Blob Storage is not configured. Please set BLOB_READ_WRITE_TOKEN environment variable."
      );
    }

    try {
      await del(url, { token: this.token });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to delete file from Vercel Blob: ${error.message}`);
      }
      throw new Error("Failed to delete file from Vercel Blob");
    }
  }

  /**
   * Get public URL for a file
   * For Vercel Blob, the URL is already public
   */
  getUrl(key: string): string {
    // Vercel Blob URLs are returned directly from upload
    // This method is mainly for constructing URLs from keys
    // In practice, we store the full URL and return it directly
    return key;
  }

  /**
   * Total object count + bytes across the whole store, via paginated `list()`.
   */
  async getUsage(): Promise<{ count: number; totalBytes: number } | null> {
    if (!this.isConfigured()) return null;

    let count = 0;
    let totalBytes = 0;
    let cursor: string | undefined;

    for (let page = 0; page < MAX_LIST_PAGES; page++) {
      const result = await list({ token: this.token, cursor, limit: 1000 });
      count += result.blobs.length;
      totalBytes += result.blobs.reduce((sum, b) => sum + b.size, 0);
      if (!result.hasMore) break;
      cursor = result.cursor;
    }

    return { count, totalBytes };
  }
}
