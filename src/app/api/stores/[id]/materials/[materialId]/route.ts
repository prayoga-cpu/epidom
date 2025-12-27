import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { materialService } from "@/lib/services/material.service";
import { updateIngredientSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";

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
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    const { id: storeId, materialId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

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
    const { id: storeId, materialId } = await params;
    return handleApiError(error, {
      endpoint: "GET /api/stores/[id]/materials/[materialId]",
      context: { storeId, materialId },
    });
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
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    const { id: storeId, materialId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    // Parse and validate request body
    const body = await request.json();
    const input = updateIngredientSchema.parse(body);

    // Update material via service
    const material = await materialService.updateMaterial(materialId, storeId, input);

    return NextResponse.json(createSuccessResponse(material));
  } catch (error) {
    const { id: storeId, materialId } = await params;
    return handleApiError(error, {
      endpoint: "PATCH /api/stores/[id]/materials/[materialId]",
      context: { storeId, materialId },
    });
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
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    const { id: storeId, materialId } = await params;

    // Verify store ownership
    await verifyStoreOwnership(storeId, session.user.id);

    // Delete material via service
    await materialService.deleteMaterial(materialId, storeId);

    return NextResponse.json(createSuccessResponse({ message: "Material deleted successfully" }));
  } catch (error) {
    const { id: storeId, materialId } = await params;
    return handleApiError(error, {
      endpoint: "DELETE /api/stores/[id]/materials/[materialId]",
      context: { storeId, materialId },
    });
  }
}
