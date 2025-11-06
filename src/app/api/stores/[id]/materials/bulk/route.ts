import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { materialService } from "@/lib/services/material.service";
import { businessService } from "@/lib/services";
import { bulkDeleteSchema } from "@/lib/validation/inventory.schemas";
import {
  createSuccessResponse,
  createErrorResponse,
  ApiErrorCode,
} from "@/types/api/responses";
import { ZodError } from "zod";

/**
 * DELETE /api/stores/[id]/materials/bulk
 *
 * Bulk delete materials.
 * Request body: { ids: string[] }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    const { id: storeId } = await params;

    // Verify user owns the business that owns this store
    const business = await businessService.getBusinessByUserId(session.user.id);
    if (!business) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.BUSINESS_NOT_FOUND,
          "Business not found"
        ),
        { status: 404 }
      );
    }

    // Verify store belongs to business
    const store = await businessService.getStoreById(storeId);
    if (!store || store.businessId !== business.id) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.NOT_FOUND,
          "Store not found or does not belong to your business"
        ),
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { ids } = bulkDeleteSchema.parse(body);

    // Bulk delete materials via service
    const deletedCount = await materialService.bulkDeleteMaterials(ids, storeId);

    return NextResponse.json(
      createSuccessResponse({
        message: `Successfully deleted ${deletedCount} material(s)`,
        deletedCount,
      })
    );
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

    // Handle business logic errors
    if (error instanceof Error) {
      console.error("Error bulk deleting materials:", error.message);

      if (error.message.includes("do not belong")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.VALIDATION_ERROR, error.message),
          { status: 403 }
        );
      }

      if (error.message.includes("used in recipes")) {
        return NextResponse.json(
          createErrorResponse(
            ApiErrorCode.VALIDATION_ERROR,
            error.message
          ),
          { status: 409 }
        );
      }
    }

    console.error("Error bulk deleting materials:", error);
    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        "An unexpected error occurred"
      ),
      { status: 500 }
    );
  }
}
