import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { userService } from "@/lib/services";
import { updateProfileSchema } from "@/lib/validation/auth.schemas";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api";
import { ZodError } from "zod";

/**
 * GET /api/user/profile
 *
 * Get current user's profile with business and subscription data.
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    // Get profile via service
    const profile = await userService.getProfile(session.user.id);

    return NextResponse.json(createSuccessResponse(profile));
  } catch (error) {
    if (error instanceof Error && error.message === "User not found") {
      return NextResponse.json(createErrorResponse(ApiErrorCode.USER_NOT_FOUND, "User not found"), {
        status: 404,
      });
    }

    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/profile
 *
 * Update current user's profile information.
 */
export async function PATCH(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
        status: 401,
      });
    }

    // Parse and validate request body
    const body = await request.json();
    const input = updateProfileSchema.parse(body);

    // Update profile via service
    const updatedUser = await userService.updateProfile(session.user.id, input);

    return NextResponse.json(createSuccessResponse(updatedUser));
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
    if (error instanceof Error && error.message === "User not found") {
      return NextResponse.json(createErrorResponse(ApiErrorCode.USER_NOT_FOUND, "User not found"), {
        status: 404,
      });
    }
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
      { status: 500 }
    );
  }
}
