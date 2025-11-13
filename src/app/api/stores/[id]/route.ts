import { NextResponse } from "next/server";
import { businessService } from "@/lib/services";
import { createStoreSchema } from "@/lib/validation/business.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

/**
 * GET /api/stores/[id]
 *
 * Get a single store by ID.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const result = await verifyStoreAccessFromRequest(userId, params);

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { store } = result;

    return NextResponse.json(createSuccessResponse(store));
  } catch (error) {
    console.error("Error fetching store:", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/stores/[id]
 *
 * Update a store.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const result = await verifyStoreAccessFromRequest(userId, params);

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { store, business, userId: verifiedUserId } = result;
    const storeId = store.id;

    // Parse and validate request body
    const body = await request.json();
    const input = createStoreSchema.partial().parse(body);

    // Update store via service
    const updatedStore = await businessService.updateStore(storeId, business.id, verifiedUserId, input);

    return NextResponse.json(createSuccessResponse(updatedStore));
  } catch (error) {
    // Handle validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          "Invalid input data",
          error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          }))
        ),
        { status: 400 }
      );
    }

    // Handle Prisma-specific errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2024: Connection pool timeout
      if (error.code === "P2024") {
        return NextResponse.json(
          createErrorResponse(
            ApiErrorCode.INTERNAL_ERROR,
            "Database connection timeout. Please try again in a moment."
          ),
          { status: 503 }
        );
      }
      // P2025: Record not found
      if (error.code === "P2025") {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.STORE_NOT_FOUND, "Store not found"),
          { status: 404 }
        );
      }
    }

    console.error("Error updating store:", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stores/[id]
 *
 * Hard delete a store and its image from Blob storage.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const result = await verifyStoreAccessFromRequest(userId, params);

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { store, business, userId: verifiedUserId } = result;
    const storeId = store.id;

    // Hard delete store via service (also deletes image from Blob)
    await businessService.deleteStore(storeId, business.id, verifiedUserId);

    return NextResponse.json(createSuccessResponse({ message: "Store deleted successfully" }));
  } catch (error) {
    console.error("Error deleting store:", error);

    // Handle Prisma-specific errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2024: Connection pool timeout
      if (error.code === "P2024") {
        return NextResponse.json(
          createErrorResponse(
            ApiErrorCode.INTERNAL_ERROR,
            "Database connection timeout. Please try again in a moment."
          ),
          { status: 503 }
        );
      }
      // P2025: Record not found
      if (error.code === "P2025") {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.STORE_NOT_FOUND, "Store not found"),
          { status: 404 }
        );
      }
    }

    // Handle connection errors
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.INTERNAL_ERROR,
          "Database connection error. Please try again later."
        ),
        { status: 503 }
      );
    }

    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}
