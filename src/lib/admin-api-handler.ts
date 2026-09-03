/**
 * Admin API Handler Wrapper
 *
 * The nine routes under `src/app/api/admin/**` never went through
 * `withApiHandler` — each hand-rolled its own guard and returned a bare
 * `NextResponse`. That is precisely why admin actions were the least recorded
 * part of the product while being the most destructive: the wrapper that grew
 * the audit trail was the one they did not use.
 *
 * This wrapper gives them the same treatment without forcing them onto
 * `withApiHandler`, whose store-ownership and rate-limit machinery does not
 * apply to platform-level routes.
 */

import { NextResponse } from "next/server";
import { getActingAdmin, type ActingAdmin } from "@/lib/auth/require-admin-api";
import { handleApiError } from "@/lib/utils/api-error-handler";
import { buildRequestMeta } from "@/lib/audit/request-meta";
import { runWithAuditScope, type AuditActor, type AuditScope } from "@/lib/audit/actor-scope";
import { captureRequestActivity } from "@/lib/audit/activity";
import { isMutatingMethod, resolveRouteAction } from "@/lib/audit/route-map";

export type AdminApiContext = {
  params: any;
  admin: ActingAdmin;
};

type AdminApiHandler = (request: Request, context: AdminApiContext) => Promise<Response>;

/** Audit actor for an acting admin, carrying how they qualified. */
export function adminActor(admin: ActingAdmin): AuditActor {
  return {
    kind: "USER",
    refId: admin.id,
    displayName: admin.name,
    email: admin.email,
    adminGrantSource: admin.grantSource,
  };
}

/**
 * Wrap an admin route with the admin gate, an audit scope and trail capture.
 *
 * A rejected request is recorded too. Someone probing `/api/admin/users` and
 * getting a 403 is a stronger signal than most successful actions, and it is
 * invisible today.
 */
export const withAdminApiHandler = (handler: AdminApiHandler) => {
  return async (request: Request, context?: { params?: Promise<any> }) => {
    const resolvedParams = context?.params ? await context.params : {};
    const meta = buildRequestMeta(request);

    // GET routes on the admin panel are reads of aggregate platform data, not
    // actions. They are excluded for the same reason reads are excluded
    // everywhere else: volume without signal.
    const auditable =
      isMutatingMethod(meta.method) && resolveRouteAction(meta.method, meta.route) !== null;

    const admin = await getActingAdmin();

    if (!admin) {
      if (auditable) {
        captureRequestActivity({
          actor: {
            kind: "PUBLIC",
            refId: null,
            displayName: null,
            email: null,
            adminGrantSource: null,
          },
          meta,
          statusCode: 403,
        });
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const actor = adminActor(admin);

    if (!auditable) {
      try {
        return await handler(request, { params: resolvedParams, admin });
      } catch (error) {
        return handleApiError(error, { endpoint: meta.route, context: resolvedParams });
      }
    }

    const scope: AuditScope = { actor, meta, recordedActionIds: [] };

    return runWithAuditScope(scope, async () => {
      try {
        const response = await handler(request, { params: resolvedParams, admin });
        captureRequestActivity({
          actor: scope.actor,
          meta,
          statusCode: response.status,
          storeId: scope.storeId,
          actionLogId: scope.recordedActionIds[0] ?? null,
        });
        return response;
      } catch (error) {
        captureRequestActivity({ actor: scope.actor, meta, statusCode: 500 });
        return handleApiError(error, { endpoint: meta.route, context: resolvedParams });
      }
    });
  };
};
