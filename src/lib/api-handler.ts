/**
 * API Handler Wrapper
 *
 * Provides a higher-order function to wrap API routes with common functionality:
 * - Rate limiting
 * - Authentication
 * - Store ownership verification (optional)
 * - Audit trail capture (Layer 1)
 * - Centralized error handling
 */

import { NextResponse } from "next/server";
import { type Session } from "@/lib/auth";
import { requireSessionApi } from "@/lib/auth/require-session";
import { checkRateLimitByUser } from "@/lib/middleware/rate-limit";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { buildRequestMeta } from "@/lib/audit/request-meta";
import { runWithAuditScope, type AuditScope } from "@/lib/audit/actor-scope";
import { resolveActor, publicActor } from "@/lib/audit/actor";
import { captureRequestActivity } from "@/lib/audit/activity";
import { isMutatingMethod, resolveRouteAction } from "@/lib/audit/route-map";

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
  allowDeactivated?: boolean; // Allow deactivated accounts to hit this route (e.g. account-settings)
  /**
   * Skip audit trail capture for this route. Use only for high-volume,
   * non-state-changing endpoints, and add a matching entry to TRAIL_WAIVERS in
   * src/lib/audit/route-map.ts explaining why — the admin coverage panel
   * renders that list, so an unexplained waiver reads as an unrecorded action.
   */
  skipAudit?: boolean;
}

/**
 * Higher-Order Function to wrap API routes with common functionality:
 * 1. Rate Limiting
 * 2. Authentication
 * 3. Store Ownership Verification (optional)
 * 4. Audit trail capture
 * 5. Error Handling
 */
export const withApiHandler = (handler: ApiHandler, options: HandlerOptions = {}) => {
  return async (request: Request, { params }: { params: Promise<any> }) => {
    const resolvedParams = await params;
    const endpoint = options.rateLimitEndpoint || new URL(request.url).pathname;

    // Request metadata is built up front so a 401 is still attributable to a
    // route, a time and an origin — a denied attempt on a destructive endpoint
    // is exactly the signal the trail exists to surface.
    const meta = buildRequestMeta(request);

    // Only mutating, non-waived routes are recorded. Reads are excluded by
    // design: the volume would dwarf the signal, and POS runs a lot of them.
    const auditable =
      !options.skipAudit &&
      isMutatingMethod(meta.method) &&
      resolveRouteAction(meta.method, meta.route) !== null;

    try {
      // ========================================
      // Authentication (FIRST - we need user ID for rate limiting)
      // ========================================
      const session = await requireSessionApi();
      if (session instanceof NextResponse) {
        if (auditable) {
          captureRequestActivity({
            actor: publicActor(),
            meta,
            statusCode: session.status,
          });
        }
        return session;
      }

      if (session.user.deactivatedAt && !options.allowDeactivated) {
        const denied = NextResponse.json(
          createErrorResponse(ApiErrorCode.FORBIDDEN, "Account is deactivated"),
          { status: 403 }
        );
        if (auditable) {
          const actor = await resolveActor(session as NonNullable<Session>);
          captureRequestActivity({ actor, meta, statusCode: 403 });
        }
        return denied;
      }

      // ========================================
      // Rate Limiting (uses authenticated user ID)
      // ========================================
      if (options.rateLimitEndpoint) {
        const rateLimitResult = await checkRateLimitByUser(
          session.user.id,
          options.rateLimitEndpoint
        );
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
      // Audit scope + Execute Business Logic
      // ========================================
      if (!auditable) {
        return await handler(request, {
          params: resolvedParams,
          session: session as NonNullable<Session>,
          userId: session.user.id,
          storeId,
        });
      }

      // The staff lookup only runs for store-scoped mutations. A cashier on a
      // shared iPad carries the owner's better-auth cookie *and* a staff PIN
      // cookie; resolving from the session alone would attribute every till
      // action to the owner, which is a confident wrong answer rather than a
      // missing one.
      const actor = await resolveActor(session as NonNullable<Session>, {
        checkStaff: Boolean(storeId),
      });

      const scope: AuditScope = { actor, meta, storeId, recordedActionIds: [] };

      return await runWithAuditScope(scope, async () => {
        let response: Response;
        try {
          response = await handler(request, {
            params: resolvedParams,
            session: session as NonNullable<Session>,
            userId: session.user.id,
            storeId,
          });
        } catch (error) {
          // Record the failed attempt before the error handler rewrites it, so
          // a mutation that threw is still visible in the trail.
          captureRequestActivity({ actor: scope.actor, meta, statusCode: 500, storeId });
          throw error;
        }

        captureRequestActivity({
          actor: scope.actor,
          meta,
          statusCode: response.status,
          storeId,
          actionLogId: scope.recordedActionIds[0] ?? null,
        });

        return response;
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
