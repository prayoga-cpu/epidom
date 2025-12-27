import { NextResponse } from "next/server";
import { getSession, type Session } from "@/lib/auth";
import { businessService } from "@/lib/services";
import { createStoreSchema } from "@/lib/validation/business.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { Prisma } from "@prisma/client";

/**
 * GET /api/stores/[id]
 *
 * Get a single store by ID.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session: Session | null = null;
  try {
    const { id } = await params;
    session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    // Verify store ownership
    await verifyStoreOwnership(id, session.user.id);

    // Get store by ID
    const store = await businessService.getStoreById(id);

    if (!store) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.STORE_NOT_FOUND, "Store not found"),
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse(store));
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "GET /api/stores/[id]",
      context: { storeId, userId: session?.user?.id },
    });
  }
}

/**
 * PATCH /api/stores/[id]
 *
 * Update a store.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session: Session | null = null;
  try {
    const { id } = await params;
    session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    // Verify store ownership
    await verifyStoreOwnership(id, session.user.id);

    // Get user's business (needed for updateStore)
    const business = await businessService.getBusinessByUserId(session.user.id);
    if (!business) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, "Business not found"),
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const input = createStoreSchema.partial().parse(body);

    // Update store via service
    const updatedStore = await businessService.updateStore(id, business.id, session.user.id, input);

    return NextResponse.json(createSuccessResponse(updatedStore));
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "PATCH /api/stores/[id]",
      context: { storeId, userId: session?.user?.id },
    });
  }
}

/**
 * DELETE /api/stores/[id]
 *
 * Hard delete a store and its image from Blob storage.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session: Session | null = null;
  try {
    const { id } = await params;
    session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    // Verify store ownership
    await verifyStoreOwnership(id, session.user.id);

    // Get user's business (needed for deleteStore)
    const business = await businessService.getBusinessByUserId(session.user.id);
    if (!business) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, "Business not found"),
        { status: 404 }
      );
    }

    // Hard delete store via service (also deletes image from Blob)
    await businessService.deleteStore(id, business.id, session.user.id);

    return NextResponse.json(createSuccessResponse({ message: "Store deleted successfully" }));
  } catch (error) {
    const { id: storeId } = await params;
    return handleApiError(error, {
      endpoint: "DELETE /api/stores/[id]",
      context: { storeId, userId: session?.user?.id },
    });
  }
}
