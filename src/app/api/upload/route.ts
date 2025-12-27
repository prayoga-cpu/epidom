/**
 * Image Upload API Route
 *
 * Handles image upload to storage provider.
 *
 * Features:
 * - Session validation
 * - File type and size validation
 * - Upload to configured storage adapter
 * - Error handling
 * - Rate limiting
 *
 * POST /api/upload
 * - Body: multipart/form-data with 'file' field
 * - Returns: { url: string, key: string, size: number }
 */

import { NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/storage";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * Allowed image MIME types
 */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Maximum file size (5MB)
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * POST /api/upload
 * Upload an image file
 */
export const POST = withApiHandler(
  async (request, { userId }) => {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "No file provided"),
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed."
        ),
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "File size exceeds 5MB limit."),
        { status: 400 }
      );
    }

    // Get storage adapter
    const storage = getStorageAdapter();

    // Check if storage is configured
    if (!storage.isConfigured()) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INTERNAL_ERROR,
          "Storage service is not configured. Please contact support."
        ),
        { status: 500 }
      );
    }

    // Upload file
    // Use user ID and timestamp for unique path
    const timestamp = Date.now();
    const path = `users/${userId}/images/${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "")}`;

    const result = await storage.upload(file, {
      path,
      access: "public",
      cacheControl: "3600", // 1 hour cache
      metadata: {
        userId,
        uploadedAt: new Date().toISOString(),
        originalName: file.name,
      },
    });

    // Return success response
    return NextResponse.json(
      createSuccessResponse({
        url: result.url,
        key: result.key,
        size: result.size,
        contentType: result.contentType,
      })
    );
  },
  {
    // Apply strict rate limiting for uploads
    rateLimitEndpoint: "/api/upload",
  }
);

/**
 * DELETE /api/upload
 * Delete an uploaded image
 */
export const DELETE = withApiHandler(
  async (request) => {
    // Parse request body
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(createErrorResponse(ApiErrorCode.VALIDATION_ERROR, "Invalid URL"), {
        status: 400,
      });
    }

    // Get storage adapter
    const storage = getStorageAdapter();

    // Delete file
    await storage.delete(url);

    // Return success response
    return NextResponse.json(
      createSuccessResponse({
        message: "File deleted successfully",
      })
    );
  },
  {
    rateLimitEndpoint: "/api/upload",
  }
);
