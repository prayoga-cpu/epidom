/**
 * @file api/session/route.ts
 * @description Custom Session API
 * Provides a cached, client-side friendly session object.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createSuccessResponse } from "@/types/api/responses";

// Cache session response for 5 seconds to reduce database load
const CACHE_MAX_AGE = 5;

/**
 * GET /api/session
 *
 * Retrieves the current authenticated user session.
 * Uses aggressive client-side caching to minimize server load.
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      // Return null data for authenticated state, but 200 OK
      return NextResponse.json(createSuccessResponse(null), {
        status: 200,
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      });
    }

    // Return standardized success response
    return NextResponse.json(
      createSuccessResponse({
        session: session.session,
        user: session.user,
      }),
      {
        headers: {
          // Private cache (browser only) - No store to prevent stale session status on redirect
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("[Session API] Error:", error);
    // Graceful degradation: return null session on error
    return NextResponse.json(createSuccessResponse(null), {
      status: 200,
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  }
}

export const dynamic = "force-dynamic";
