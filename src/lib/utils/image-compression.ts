/**
 * Image Compression Utility
 *
 * Client-side image compression using browser-image-compression.
 * Reduces image size by 60-80% before upload.
 *
 * Features:
 * - Compresses to WebP format (better compression than JPEG/PNG)
 * - Resizes to max 1200x1200px
 * - Target file size: < 500KB
 * - Uses Web Worker for better performance
 */

import imageCompression from "browser-image-compression";

/**
 * Configuration options for image compression
 */
export interface ImageCompressionOptions {
  /** Maximum file size in MB (default: 0.5) */
  maxSizeMB?: number;
  /** Maximum width or height in pixels (default: 1200) */
  maxWidthOrHeight?: number;
  /** Use web worker for compression (default: true) */
  useWebWorker?: boolean;
  /** Output file type (default: 'image/webp') */
  fileType?: "image/webp" | "image/jpeg" | "image/png";
  /** Initial quality (0-1, default: 0.8) */
  initialQuality?: number;
}

/**
 * Default compression options
 */
const DEFAULT_OPTIONS: Required<ImageCompressionOptions> = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
  fileType: "image/webp",
  initialQuality: 0.8,
};

/**
 * Compress an image file
 *
 * @param file - Image file to compress
 * @param options - Compression options
 * @returns Compressed image file
 * @throws Error if compression fails
 */
export async function compressImage(file: File, options?: ImageCompressionOptions): Promise<File> {
  // Merge with default options
  const compressionOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  try {
    const compressedFile = await imageCompression(file, compressionOptions);

    // Log compression results
    const originalSize = (file.size / 1024 / 1024).toFixed(2);
    const compressedSize = (compressedFile.size / 1024 / 1024).toFixed(2);
    const reduction = (((file.size - compressedFile.size) / file.size) * 100).toFixed(1);
    return compressedFile;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Image compression failed: ${error.message}`);
    }
    throw new Error("Image compression failed");
  }
}

/**
 * Validate if file is a valid image
 *
 * @param file - File to validate
 * @returns true if valid image, false otherwise
 */
export function isValidImage(file: File): boolean {
  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  return validTypes.includes(file.type);
}

/**
 * Validate image file size
 *
 * @param file - File to validate
 * @param maxSizeMB - Maximum file size in MB
 * @returns true if valid size, false otherwise
 */
export function isValidImageSize(file: File, maxSizeMB: number = 5): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}

/**
 * Get image dimensions
 *
 * @param file - Image file
 * @returns Promise with width and height
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.width,
        height: img.height,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Create image preview URL
 *
 * @param file - Image file
 * @returns Object URL for preview (remember to revoke after use)
 */
export function createImagePreview(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Revoke image preview URL
 *
 * @param url - Object URL to revoke
 */
export function revokeImagePreview(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Delete an image from blob storage
 *
 * @param url - Image URL to delete (must be a blob storage URL)
 * @returns Promise that resolves when deletion is complete
 * @throws Error if deletion fails
 */
export async function deleteBlobImage(url: string): Promise<void> {
  // Only delete if it's a blob storage URL
  if (!url || !url.includes("blob.vercel-storage.com")) {
    return;
  }

  try {
    const response = await fetch("/api/upload", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete image");
    }
  } catch (error) {
    // Re-throw to allow caller to handle the error
    throw error;
  }
}
