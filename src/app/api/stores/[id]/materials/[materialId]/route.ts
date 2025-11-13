import { NextResponse } from "next/server";
import { materialService } from "@/lib/services/material.service";
import { updateIngredientSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { ZodError } from "zod";
import { verifyStoreAccessFromRequest, getAuthenticatedUserId } from "@/lib/api/auth-helpers";

/**
 * GET /api/stores/[id]/materials/[materialId]
 *
 * Get a single material by ID.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const resolvedParams = await params;
    const result = await verifyStoreAccessFromRequest(userId, { id: resolvedParams.id });

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { id: storeId, materialId } = resolvedParams;

    // Get material
    const material = await materialService.getMaterialById(materialId);

    // Verify material belongs to store
    if (material.storeId !== storeId) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.NOT_FOUND, "Material not found in this store"),
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse(material));
  } catch (error) {
    if (error instanceof Error && error.message === "Material not found") {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Material not found"), {
        status: 404,
      });
    }

    console.error("Error fetching material:", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/stores/[id]/materials/[materialId]
 *
 * Update a material.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const resolvedParams = await params;
    const result = await verifyStoreAccessFromRequest(userId, { id: resolvedParams.id });

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { id: storeId, materialId } = resolvedParams;

    // Parse and validate request body
    const body = await request.json();
    const input = updateIngredientSchema.parse(body);

    // Update material via service
    const material = await materialService.updateMaterial(materialId, storeId, input);

    return NextResponse.json(createSuccessResponse(material));
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
      console.error("Error updating material:", error.message);

      if (error.message.includes("not found")) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, error.message), {
          status: 404,
        });
      }

      if (error.message.includes("SKU already exists")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.VALIDATION_ERROR, error.message),
          { status: 409 }
        );
      }
    }

    console.error("Error updating material:", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stores/[id]/materials/[materialId]
 *
 * Delete a material.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    // Verify authentication and store access
    const userId = await getAuthenticatedUserId();
    const resolvedParams = await params;
    const result = await verifyStoreAccessFromRequest(userId, { id: resolvedParams.id });

    // If result is NextResponse, it's an error - return it
    if (result instanceof NextResponse) {
      return result;
    }

    const { id: storeId, materialId } = resolvedParams;

    // Delete material via service
    await materialService.deleteMaterial(materialId, storeId);

    return NextResponse.json(createSuccessResponse({ message: "Material deleted successfully" }));
  } catch (error) {
    // Handle business logic errors
    if (error instanceof Error) {
      console.error("Error deleting material:", error.message);

      if (error.message.includes("not found") || error.message.includes("does not belong")) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, error.message), {
          status: 404,
        });
      }

      if (error.message.includes("used in")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.VALIDATION_ERROR, error.message),
          { status: 409 }
        );
      }
    }

    console.error("Error deleting material:", error);
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}
