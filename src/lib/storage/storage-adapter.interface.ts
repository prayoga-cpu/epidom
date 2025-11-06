/**
 * Storage Adapter Interface
 *
 * Defines the contract for storage providers.
 * Allows easy switching between Vercel Blob, Cloudflare R2, UploadThing, etc.
 */

/**
 * Result of a successful upload operation
 */
export interface UploadResult {
  /** Public URL to access the uploaded file */
  url: string;
  /** Unique key/path of the uploaded file */
  key: string;
  /** Size of the uploaded file in bytes */
  size: number;
  /** Content type of the uploaded file */
  contentType: string;
}

/**
 * Options for upload operation
 */
export interface UploadOptions {
  /** Custom path/folder for the file */
  path?: string;
  /** Access level (public, private) */
  access?: "public" | "private";
  /** Cache control header */
  cacheControl?: string;
  /** Additional metadata */
  metadata?: Record<string, string>;
}

/**
 * Storage adapter interface
 *
 * Implement this interface to create a new storage provider adapter
 */
export interface StorageAdapter {
  /**
   * Upload a file to storage
   * @param file - File to upload
   * @param options - Upload options
   * @returns Upload result with URL and metadata
   */
  upload(file: File, options?: UploadOptions): Promise<UploadResult>;

  /**
   * Delete a file from storage
   * @param url - URL or key of the file to delete
   */
  delete(url: string): Promise<void>;

  /**
   * Get public URL for a file
   * @param key - File key/path
   * @returns Public URL
   */
  getUrl(key: string): string;

  /**
   * Check if adapter is properly configured
   * @returns true if configured, false otherwise
   */
  isConfigured(): boolean;
}
