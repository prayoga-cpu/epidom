import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { businessService } from "@/lib/services";
import { materialService } from "@/lib/services/material.service";
import { stockAdjustmentSchema } from "@/lib/validation/inventory.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { ZodError } from "zod";
import { MovementType } from "@prisma/client";

/**
 * POST /api/stores/[id]/stock/adjust
 *
 * Manual stock adjustment endpoint.
 * Creates a stock movement record and updates material/product stock.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    const { id: storeId } = await params;

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
    const input = stockAdjustmentSchema.parse(body);

    // Adjust stock via material service
    const result = await materialService.adjustStock(storeId, {
      materialId: input.materialId,
      productId: input.productId,
      adjustmentType: input.adjustmentType,
      quantity: Number(input.quantity),
      reason: input.reason,
      notes: input.notes,
      referenceId: input.referenceId,
    });

    return NextResponse.json(createSuccessResponse(result), { status: 201 });
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
      if (error.message.includes("not found")) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, error.message), {
          status: 404,
        });
      }

      if (error.message.includes("cannot be negative")) {
        return NextResponse.json(
          createErrorResponse(ApiErrorCode.VALIDATION_ERROR, error.message),
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}

