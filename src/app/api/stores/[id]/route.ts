import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { businessService } from "@/lib/services";
import { createStoreSchema } from "@/lib/validation/business.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { ZodError } from "zod";

/**
 * GET /api/stores/[id]
 *
 * Get a single store by ID.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    // Get user's business
    const business = await businessService.getBusinessByUserId(session.user.id);

    if (!business) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, "Business not found"),
        { status: 404 }
      );
    }

    // Get store by ID
    const store = await businessService.getStoreById(id);

    if (!store) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.STORE_NOT_FOUND, "Store not found"),
        { status: 404 }
      );
    }

    // Verify store belongs to user's business
    if (store.businessId !== business.id) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.FORBIDDEN,
          "You don't have permission to access this store"
        ),
        { status: 403 }
      );
    }

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
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    // Get user's business
    const business = await businessService.getBusinessByUserId(session.user.id);

    if (!business) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, "Business not found"),
        { status: 404 }
      );
    }

    // Check if store exists and belongs to user's business
    const existingStore = await businessService.getStoreById(id);

    if (!existingStore) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.STORE_NOT_FOUND, "Store not found"),
        { status: 404 }
      );
    }

    if (existingStore.businessId !== business.id) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.FORBIDDEN,
          "You don't have permission to update this store"
        ),
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const input = createStoreSchema.partial().parse(body);

    // Update store via service
    const updatedStore = await businessService.updateStore(id, business.id, session.user.id, input);

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
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    // Get user's business
    const business = await businessService.getBusinessByUserId(session.user.id);

    if (!business) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, "Business not found"),
        { status: 404 }
      );
    }

    // Check if store exists and belongs to user's business
    const existingStore = await businessService.getStoreById(id);

    if (!existingStore) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.STORE_NOT_FOUND, "Store not found"),
        { status: 404 }
      );
    }

    if (existingStore.businessId !== business.id) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.FORBIDDEN,
          "You don't have permission to delete this store"
        ),
        { status: 403 }
      );
    }

    // Hard delete store via service (also deletes image from Blob)
    await businessService.deleteStore(id, business.id, session.user.id);

    return NextResponse.json(createSuccessResponse({ message: "Store deleted successfully" }));
  } catch (error) {
    console.error("Error deleting store:", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}
