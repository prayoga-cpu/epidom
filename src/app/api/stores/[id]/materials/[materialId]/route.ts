import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { materialService } from "@/lib/services/material.service";
import { businessService } from "@/lib/services";
import { updateIngredientSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { ZodError } from "zod";

/**
 * GET /api/stores/[id]/materials/[materialId]
 *
 * Get a single material by ID.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string; materialId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    const storeId = await params.id;
    const materialId = params.materialId;

    // Verify user owns the business that owns this store
    const business = await businessService.getBusinessByUserId(session.user.id);
    if (!business) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, "Business not found"),
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
  { params }: { params: { id: string; materialId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    const storeId = params.id;
    const materialId = params.materialId;

    // Verify user owns the business that owns this store
    const business = await businessService.getBusinessByUserId(session.user.id);
    if (!business) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, "Business not found"),
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
  { params }: { params: { id: string; materialId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    const storeId = params.id;
    const materialId = params.materialId;

    // Verify user owns the business that owns this store
    const business = await businessService.getBusinessByUserId(session.user.id);
    if (!business) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, "Business not found"),
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
