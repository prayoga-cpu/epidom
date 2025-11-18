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
 *
 * POST /api/upload
 * - Body: multipart/form-data with 'file' field
 * - Returns: { url: string, key: string, size: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { getStorageAdapter } from "@/lib/storage";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
export async function POST(request: NextRequest) {
  try {
    // Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.",
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "File size exceeds 5MB limit.",
        },
        { status: 400 }
      );
    }

    // Get storage adapter
    const storage = getStorageAdapter();

    // Check if storage is configured
    if (!storage.isConfigured()) {
      return NextResponse.json(
        {
          success: false,
          message: "Storage service is not configured. Please contact support.",
        },
        { status: 500 }
      );
    }

    // Upload file
    // Use user ID and timestamp for unique path
    const userId = session.user.id;
    const timestamp = Date.now();
    const path = `users/${userId}/images`;

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
    return NextResponse.json({
      success: true,
      url: result.url,
      key: result.key,
      size: result.size,
      contentType: result.contentType,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An error occurred while uploading the file";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload
 * Delete an uploaded image
 */
export async function DELETE(request: NextRequest) {
  try {
    // Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ success: false, message: "Invalid URL" }, { status: 400 });
    }

    // Get storage adapter
    const storage = getStorageAdapter();

    // Delete file
    await storage.delete(url);

    // Return success response
    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An error occurred while deleting the file";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/upload
 * Handle preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
