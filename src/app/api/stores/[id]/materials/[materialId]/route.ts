import { NextResponse } from "next/server";
import { materialService } from "@/lib/services/material.service";
import { updateIngredientSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";

/**
 * GET /api/stores/[id]/materials/[materialId]
 *
 * Get a single material by ID.
 */
export const GET = withApiHandler(
  async (request, { storeId, params }) => {
    const { materialId } = params;

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
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/materials/[materialId]",
    requireStoreAuth: true,
  }
);

/**
 * PATCH /api/stores/[id]/materials/[materialId]
 *
 * Update a material.
 */
export const PATCH = withApiHandler(
  async (request, { storeId, params }) => {
    const { materialId } = params;

    // Parse and validate request body
    const body = await request.json();
    const input = updateIngredientSchema.parse(body);

    // Update material via service
    const material = await materialService.updateMaterial(materialId, storeId!, input);

    return NextResponse.json(createSuccessResponse(material));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/materials/[materialId]",
    requireStoreAuth: true,
  }
);

/**
 * DELETE /api/stores/[id]/materials/[materialId]
 *
 * Delete a material.
 */
export const DELETE = withApiHandler(
  async (request, { storeId, params }) => {
    const { materialId } = params;

    // Delete material via service
    await materialService.deleteMaterial(materialId, storeId!);

    return NextResponse.json(createSuccessResponse({ message: "Material deleted successfully" }));
  },
  {
    rateLimitEndpoint: "/api/stores/[id]/materials/[materialId]",
    requireStoreAuth: true,
  }
);
