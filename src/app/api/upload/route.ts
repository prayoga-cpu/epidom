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
import { compressImageServer } from "@/lib/utils/server-image-compression";
import { ALLOWED_IMAGE_TYPES, IMAGE_RAW_UPLOAD_MAX_BYTES, clampTargetMB } from "@/lib/constants/image";

/**
 * Sharp's native binary load + multi-pass compression on a cold serverless
 * instance, plus the outbound Blob upload, can exceed the platform's
 * default function timeout — raise it rather than let cold requests 504.
 */
export const maxDuration = 30;

/**
 * Allowed image MIME types
 */
const ALLOWED_TYPES: readonly string[] = ALLOWED_IMAGE_TYPES;

/**
 * Maximum raw (pre-compression) file size accepted. This bounds processing
 * cost — it is not the guaranteed output size, see compressImageServer.
 */
const MAX_FILE_SIZE = IMAGE_RAW_UPLOAD_MAX_BYTES;

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

    // Server-side compression — the authoritative half of the image rule
    // (AGENTS.md § 6, "Images"). Guarantees every image ever stored is at
    // most `maxSizeMB` regardless of what the client sent, so client-side
    // compression is a bandwidth/UX optimization, not the only gate.
    const requestedTargetMB = Number(formData.get("maxSizeMB"));
    const targetBytes = clampTargetMB(requestedTargetMB) * 1024 * 1024;

    let uploadFile: File;
    try {
      const inputBuffer = Buffer.from(await file.arrayBuffer());
      const { buffer: compressedBuffer, contentType } = await compressImageServer(
        inputBuffer,
        file.type,
        targetBytes
      );
      uploadFile = new File([new Uint8Array(compressedBuffer)], file.name, { type: contentType });
    } catch (error) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          error instanceof Error ? error.message : "Failed to compress image."
        ),
        { status: 400 }
      );
    }

    // Upload file — the adapter appends its own timestamped, sanitized
    // filename under this prefix (see VercelBlobAdapter.upload), so `path`
    // here is a directory, not a full key.
    const path = `users/${userId}/images`;

    const result = await storage.upload(uploadFile, {
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
