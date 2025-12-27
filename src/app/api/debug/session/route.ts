import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * GET /api/debug/session
 *
 * Debug endpoint to check session status.
 * SECURITY: Only available in development mode.
 */
export async function GET() {
  // Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Debug endpoint not available in production" },
      { status: 404 }
    );
  }

  try {
    const session = await getSession();

    return NextResponse.json({
      hasSession: !!session,
      session: session
        ? {
            userId: session.user?.id,
            userEmail: session.user?.email,
            userName: session.user?.name,
          }
        : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[DEBUG] Session error:", message);

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}
