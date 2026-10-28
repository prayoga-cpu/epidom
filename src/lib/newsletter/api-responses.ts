import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { ApiErrorCode, createErrorResponse } from "@/types/api/responses";

/** Shared error responses for the admin newsletter routes. */

export function validationFailed(error: ZodError): NextResponse {
  const first = error.issues[0];
  return NextResponse.json(
    createErrorResponse(ApiErrorCode.VALIDATION_ERROR, first?.message ?? "Invalid input", {
      fields: error.flatten().fieldErrors,
    }),
    { status: 400 }
  );
}

export function campaignMiss(reason: "not_found" | "locked"): NextResponse {
  return reason === "not_found"
    ? NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Newsletter not found"), {
        status: 404,
      })
    : NextResponse.json(
        createErrorResponse(
          ApiErrorCode.CONFLICT,
          "This newsletter has already started sending and can't be changed."
        ),
        { status: 409 }
      );
}
