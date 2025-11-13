import { NextResponse } from "next/server";
import { materialService } from "@/lib/services/material.service";
import { bulkDeleteSchema } from "@/lib/validation/inventory.schemas";
import {
  createSuccessResponse,
  createErrorResponse,
  ApiErrorCode,
} from "@/types/api/responses";
import { ZodError } from "zod";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

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
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const result = await verifyStoreAccessFromRequest(userId, params);

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { id: storeId } = await params;

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
