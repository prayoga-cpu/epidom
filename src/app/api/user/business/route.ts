/**
 * User Business API Routes
 *
 * Handles business CRUD operations for authenticated users.
 * Each user can have one business which can contain multiple stores.
 */

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
 *
 * @route GET /api/user/business
 * @access Private (requires authentication)
 * @returns {ApiResponse<Business>} User's business data
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

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
 * Returns 409 Conflict if user already has a business.
 *
 * @route POST /api/user/business
 * @access Private (requires authentication)
 * @body {CreateBusinessInput} Business creation data
 * @returns {ApiResponse<Business>} Created business data
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    const body = await request.json();
    const input = createBusinessSchema.parse(body);

    const business = await businessService.createBusiness(session.user.id, input);

    return NextResponse.json(createSuccessResponse(business), { status: 201 });
  } catch (error) {
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
 * Creates business if it doesn't exist, updates if it does.
 *
 * @route PATCH /api/user/business
 * @access Private (requires authentication)
 * @body {UpdateBusinessInput} Business update data
 * @returns {ApiResponse<Business>} Updated or created business data
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    const body = await request.json();
    const input = updateBusinessSchema.parse(body);

    const business = await businessService.upsertBusiness(session.user.id, input);

    return NextResponse.json(createSuccessResponse(business));
  } catch (error) {
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
