import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { businessService } from "@/lib/services";
import { createBusinessSchema, updateBusinessSchema } from "@/lib/validation/business.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api";
import { ZodError } from "zod";

/**
 * GET /api/user/business
 *
 * Get current user's business.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    // Get business via service
    const business = await businessService.getBusinessByUserId(session.user.id);

    if (!business) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.BUSINESS_NOT_FOUND, "Business not found"),
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse(business));
  } catch (error) {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/business
 *
 * Create a new business for the current user.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    // Parse and validate request body
    const body = await request.json();
    const input = createBusinessSchema.parse(body);

    // Create business via service
    const business = await businessService.createBusiness(session.user.id, input);

    return NextResponse.json(createSuccessResponse(business), { status: 201 });
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
      if (error.message === "User already has a business") {
        return NextResponse.json(
          createErrorResponse(
            ApiErrorCode.CONFLICT,
            "Business already exists. Use PATCH to update."
          ),
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/business
 *
 * Update or create (upsert) business for the current user.
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    // Parse and validate request body
    const body = await request.json();
    const input = updateBusinessSchema.parse(body);

    // Upsert business via service
    const business = await businessService.upsertBusiness(session.user.id, input);

    return NextResponse.json(createSuccessResponse(business));
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

    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}
