import { NextResponse } from "next/server";
import { authService } from "@/lib/services";
import { registerSchema } from "@/lib/validation/auth.schemas";
import {
  createSuccessResponse,
  createErrorResponse,
  ApiErrorCode,
} from "@/types/api";
import { ZodError } from "zod";

/**
 * POST /api/auth/signup
 *
 * Register a new user with optional business creation.
 * Uses service layer for business logic and Zod for validation.
 */
export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const input = registerSchema.parse(body);

    // Register user via service
    const result = await authService.register(input);

    // Return standardized success response
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
      if (error.message === "Email already exists") {
        return NextResponse.json(
          createErrorResponse(
            ApiErrorCode.EMAIL_ALREADY_EXISTS,
            "User with this email already exists"
          ),
          { status: 409 }
        );
      }
    }

    // Handle unexpected errors
    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.INTERNAL_ERROR,
        "An unexpected error occurred"
      ),
      { status: 500 }
    );
  }
}
