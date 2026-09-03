import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ActivityOutcome, AuditSeverity } from "@prisma/client";
import { isAuditCaptureEnabled } from "./config";
import { getAuditScope, type AuditActor, type AuditRequestMeta } from "./actor-scope";
import { extractStoreId, resolveRouteAction } from "./route-map";

/**
 * Layer 1 — the activity trail writer.
 *
 * One narrow row per mutating request, holding who/what/where/when and no row
 * content. This is the coverage floor: it cannot tell you what a value changed
 * *to*, but it guarantees that an empty Activity page means nothing happened,
 * rather than that the recorder was not wired up on that route.
 *
 * The write is deferred to `after()` so it never sits on the response path. A
 * failure is swallowed and logged: an audit write must not be able to turn a
 * working request into a 500.
 */

export interface ActivityEventInput {
  actor: AuditActor;
  meta: AuditRequestMeta;
  actionCode: string;
  severity: AuditSeverity;
  outcome: ActivityOutcome;
  statusCode?: number;
  storeId?: string | null;
  businessId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  actionLogId?: string | null;
}

/** Write one trail row. Never throws. */
export async function writeActivityEvent(input: ActivityEventInput): Promise<void> {
  if (!isAuditCaptureEnabled()) return;

  try {
    await prisma.activityEvent.create({
      data: {
        requestId: input.meta.requestId,
        actorKind: input.actor.kind,
        actorRefId: input.actor.refId,
        actorName: input.actor.displayName,
        actorEmail: input.actor.email,
        actorGrant: input.actor.adminGrantSource,
        storeId: input.storeId ?? null,
        businessId: input.businessId ?? null,
        actionCode: input.actionCode,
        method: input.meta.method,
        route: input.meta.route,
        statusCode: input.statusCode ?? null,
        outcome: input.outcome,
        severity: input.severity,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        durationMs: Math.max(0, Date.now() - input.meta.startedAt),
        ipHash: input.meta.ipHash,
        userAgent: input.meta.userAgent,
        actionLogId: input.actionLogId ?? null,
      },
    });
  } catch (error) {
    // Deliberately swallowed. The alternative — letting a trail write fail the
    // request it describes — would make enabling audit capture strictly worse
    // than leaving it off. The console line is what the gap detector reconciles
    // against; see docs/AUDIT_LOG_PLAN.md §9.
    console.error("[audit] activity event write failed:", error);
  }
}

/**
 * Schedule a trail row for the current request, resolved from the route map.
 *
 * Called by the API wrapper once the response status is known. Returns
 * immediately; the database write happens after the response is sent.
 */
export function captureRequestActivity(params: {
  actor: AuditActor;
  meta: AuditRequestMeta;
  statusCode: number;
  storeId?: string;
  actionLogId?: string | null;
}): void {
  if (!isAuditCaptureEnabled()) return;

  const resolved = resolveRouteAction(params.meta.method, params.meta.route);
  if (!resolved) return;

  const outcome: ActivityOutcome =
    params.statusCode === 401 || params.statusCode === 403
      ? "DENIED"
      : params.statusCode >= 400
        ? "FAILED"
        : "SUCCESS";

  // A denied or failed attempt on a destructive route is more interesting than
  // a successful read, not less — someone probing what they cannot do is
  // exactly the pattern this trail exists to surface. So severity is raised,
  // never lowered, when the outcome is not SUCCESS.
  const severity: AuditSeverity =
    outcome === "DENIED" && resolved.severity === "INFO" ? "NOTICE" : resolved.severity;

  const scope = getAuditScope();

  after(async () => {
    await writeActivityEvent({
      actor: params.actor,
      meta: params.meta,
      actionCode: resolved.code,
      severity,
      outcome,
      statusCode: params.statusCode,
      storeId: params.storeId ?? scope?.storeId ?? extractStoreId(params.meta.route) ?? null,
      targetType: resolved.targetType ?? null,
      targetId: resolved.targetId ?? null,
      actionLogId: params.actionLogId ?? null,
    });
  });
}
