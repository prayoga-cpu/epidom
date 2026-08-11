import { NextResponse } from "next/server";
import { getSessionResult, type Session } from "@/lib/auth";
import { ApiErrorCode, createErrorResponse } from "@/types/api/responses";

/**
 * Authentication gate for API routes, replacing the
 * `const session = await getSession(); if (!session?.user?.id) → 401` block
 * that every route hand-rolled.
 *
 * The reason it exists: that block answered 401 "Unauthorized" for two very
 * different situations — the caller genuinely isn't signed in, and we simply
 * couldn't reach the database to find out (see getSessionResult). On
 * serverless Postgres the second happens intermittently, and a cashier who
 * gets "Unauthorized" halfway through a checkout has no reason to think
 * "retry" — they think they've been logged out. 503 with a retry hint is the
 * honest answer, and it's the one the client can act on.
 *
 * @returns the session, or an error NextResponse to return immediately.
 */
export async function requireSessionApi(): Promise<NonNullable<Session> | NextResponse> {
  const { session, unavailable } = await getSessionResult();

  if (session?.user?.id) return session;

  if (unavailable) {
    return NextResponse.json(
      createErrorResponse(
        ApiErrorCode.SERVICE_UNAVAILABLE,
        "Could not verify your session right now. Please try again."
      ),
      { status: 503, headers: { "Retry-After": "1" } }
    );
  }

  return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
    status: 401,
  });
}
