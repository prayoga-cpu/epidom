/**
 * API Handler Wrapper
 *
 * Provides a higher-order function to wrap API routes with common functionality:
 * - Rate limiting
 * - Authentication
 * - Store ownership verification (optional)
 * - Centralized error handling
 */

import { NextResponse } from "next/server";
import { getSession, type Session } from "@/lib/auth";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * Context passed to API route handlers
 */
export type ApiContext = {
  params: any; // Route params (can vary, storeId is type-checked separately)
  session: NonNullable<Session>;
  userId: string;
  storeId?: string;
};

/**
 * API route handler function signature
 */
type ApiHandler = (request: Request, context: ApiContext) => Promise<Response>;

/**
 * Options for the API handler wrapper
 */
interface HandlerOptions {
  rateLimitEndpoint?: string; // Endpoint identifier for rate limiter
  requireStoreAuth?: boolean; // Whether to verify store ownership
}

/**
 * Higher-Order Function to wrap API routes with common functionality:
 * 1. Rate Limiting
 * 2. Authentication
 * 3. Store Ownership Verification (optional)
 * 4. Error Handling
 */
export const withApiHandler = (handler: ApiHandler, options: HandlerOptions = {}) => {
  return async (request: Request, { params }: { params: Promise<any> }) => {
    const resolvedParams = await params;
    const endpoint = options.rateLimitEndpoint || new URL(request.url).pathname;

    try {
      // ========================================
      // Rate Limiting
      // ========================================
      if (options.rateLimitEndpoint) {
        const rateLimitResult = await rateLimitMiddleware(request, options.rateLimitEndpoint);
        if (rateLimitResult) {
          return NextResponse.json(
            createErrorResponse(
              ApiErrorCode.RATE_LIMIT_EXCEEDED,
              `Rate limit exceeded. Please try again in ${rateLimitResult.reset} seconds.`
            ),
            {
              status: 429,
              headers: {
                "X-RateLimit-Limit": rateLimitResult.limit.toString(),
                "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
                "X-RateLimit-Reset": rateLimitResult.reset.toString(),
              },
            }
          );
        }
      }

      // ========================================
      // Authentication
      // ========================================
      const session = await getSession();
      if (!session?.user?.id) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
          status: 401,
        });
      }

      // ========================================
      // Store Ownership Verification (Optional)
      // ========================================
      let storeId: string | undefined;

      if (options.requireStoreAuth) {
        storeId = resolvedParams.id || resolvedParams.storeId;

        if (!storeId) {
          throw new Error("Store ID not found in route parameters");
        }

        await verifyStoreOwnership(storeId, session.user.id);
      }

      // ========================================
      // Execute Business Logic
      // ========================================
      return await handler(request, {
        params: resolvedParams,
        session: session as NonNullable<Session>,
        userId: session.user.id,
        storeId,
      });
    } catch (error) {
      // ========================================
      // Error Handling
      // ========================================
      return handleApiError(error, {
        endpoint: endpoint,
        context: {
          ...resolvedParams,
          userId: "session_user_id", // Don't log actual user ID for security
        },
      });
    }
  };
};
