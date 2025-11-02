import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import authOptions from "@/lib/auth";
import { businessService } from "@/lib/services";
import { createStoreSchema } from "@/lib/validation/business.schemas";
import {
  createSuccessResponse,
  createErrorResponse,
  ApiErrorCode,
} from "@/types/api/responses";
import { ZodError } from "zod";

/**
 * GET /api/stores
 *
 * Get all stores for the current user's business.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    // Get user's business first
    const business = await businessService.getBusinessByUserId(session.user.id);

    if (!business) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.BUSINESS_NOT_FOUND,
          "Business not found. Please create a business first."
        ),
        { status: 404 }
      );
    }

    // Get all stores for the business
    const stores = await businessService.getStoresByBusinessId(business.id);

    return NextResponse.json(createSuccessResponse(stores));
  } catch (error) {
    console.error("Error fetching stores:", error);
    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        "An unexpected error occurred"
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/stores
 *
 * Create a new store for the current user's business.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"),
        { status: 401 }
      );
    }

    // Get user's business
    const business = await businessService.getBusinessByUserId(session.user.id);

    if (!business) {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.BUSINESS_NOT_FOUND,
          "Business not found. Please create a business first."
        ),
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const input = createStoreSchema.parse(body);

    // Create store via service
    const store = await businessService.createStore(
      business.id,
      session.user.id,
      input
    );

    return NextResponse.json(createSuccessResponse(store), { status: 201 });
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
      console.error("Error creating store:", error.message);
    }

    console.error("Error creating store:", error);
    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        "An unexpected error occurred"
      ),
      { status: 500 }
    );
  }
}
