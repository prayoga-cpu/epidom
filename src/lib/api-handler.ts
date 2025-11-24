import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { Session } from "next-auth";

// Define a type for the context that will be passed to the handler
export type ApiContext = {
  params: any; // Using any for params as they can vary, but we'll type check storeId specifically
  session: Session;
  userId: string;
  storeId?: string;
};

// Define the handler type
type ApiHandler = (request: Request, context: ApiContext) => Promise<NextResponse>;

// Options for the wrapper
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
export const withApiHandler = (
  handler: ApiHandler,
  options: HandlerOptions = {}
) => {
  return async (request: Request, { params }: { params: Promise<any> }) => {
    // Resolve params once
    const resolvedParams = await params;

    // Determine endpoint name for logging/rate limiting
    // If not provided, try to construct from URL or default to generic
    const endpoint = options.rateLimitEndpoint || new URL(request.url).pathname;

    try {
      // 1. Rate Limiting
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

      // 2. Authentication
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
          status: 401,
        });
      }

      // 3. Store Verification (Optional)
      let storeId: string | undefined;

      if (options.requireStoreAuth) {
        // Expect 'id' or 'storeId' in params
        storeId = resolvedParams.id || resolvedParams.storeId;

        if (!storeId) {
           // Fallback: try to get from query params or body if not in route params?
           // For now, strict requirement: must be in route params if requireStoreAuth is true
           throw new Error("Store ID not found in route parameters");
        }

        await verifyStoreOwnership(storeId, session.user.id);
      }

      // 4. Execute Business Logic
      return await handler(request, {
        params: resolvedParams,
        session,
        userId: session.user.id,
        storeId,
      });

    } catch (error) {
      // 5. Centralized Error Handling
      return handleApiError(error, {
        endpoint: endpoint,
        context: {
          ...resolvedParams,
          userId: "session_user_id" // Don't log actual user ID if session might be null, or handle safely
        },
      });
    }
  };
};
