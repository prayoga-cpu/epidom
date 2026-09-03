import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateRange, type ActivityQuery } from "@/lib/validation/audit.schemas";
import { ACTION_CATALOG, getActionDefinition } from "@/lib/audit/catalog";
import { TRAIL_WAIVERS } from "@/lib/audit/route-map";

/**
 * Read side of the audit trail.
 *
 * Pagination is server-side and cursor-based, breaking the convention every
 * other admin table follows (`take: 500` then a client-side `useMemo`). That
 * convention is fine for a few hundred users; it is not fine for a table that
 * grows by one row per mutating request forever.
 */

export interface ActivityRow {
  id: string;
  occurredAt: string;
  actorKind: string;
  actorRefId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorGrant: string | null;
  actionCode: string;
  method: string;
  route: string;
  outcome: string;
  severity: string;
  statusCode: number | null;
  storeId: string | null;
  targetType: string | null;
  targetId: string | null;
  durationMs: number | null;
  /** Present when a curated Layer 2 row exists for this request. */
  detail: {
    actionLogId: string;
    actionType: string;
    category: string;
    state: string;
    reversibility: string;
    targetLabel: string | null;
    reason: string | null;
    flaggedAt: string | null;
    lockedAt: string | null;
    /** Whether the reversal engine would even consider this row. */
    revertable: boolean;
  } | null;
}

function buildWhere(q: ActivityQuery): Prisma.ActivityEventWhereInput {
  const range = toDateRange(q.from, q.to);
  const where: Prisma.ActivityEventWhereInput = {};

  if (range.gte || range.lt) {
    where.occurredAt = { ...(range.gte ? { gte: range.gte } : {}), ...(range.lt ? { lt: range.lt } : {}) };
  }
  if (q.actorRefId) where.actorRefId = q.actorRefId;
  if (q.actorKind) where.actorKind = q.actorKind;
  if (q.storeId) where.storeId = q.storeId;
  if (q.targetType) where.targetType = q.targetType;
  if (q.targetId) where.targetId = q.targetId;
  if (q.actionCode) where.actionCode = q.actionCode;
  if (q.severity) where.severity = q.severity;
  if (q.outcome) where.outcome = q.outcome;
  if (q.detailedOnly) where.actionLogId = { not: null };
  if (q.flaggedOnly) where.actionLog = { flaggedAt: { not: null } };

  if (q.search) {
    where.OR = [
      { actorName: { contains: q.search, mode: "insensitive" } },
      { actorEmail: { contains: q.search, mode: "insensitive" } },
      { actionCode: { contains: q.search, mode: "insensitive" } },
      { route: { contains: q.search, mode: "insensitive" } },
      { targetId: { contains: q.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function queryActivity(q: ActivityQuery): Promise<{
  rows: ActivityRow[];
  nextCursor: string | null;
}> {
  const where = buildWhere(q);

  const orderBy: Prisma.ActivityEventOrderByWithRelationInput =
    q.sortBy === "severity"
      ? { severity: q.sortDir }
      : q.sortBy === "actorName"
        ? { actorName: q.sortDir }
        : q.sortBy === "actionCode"
          ? { actionCode: q.sortDir }
          : { occurredAt: q.sortDir };

  const rows = await prisma.activityEvent.findMany({
    where,
    orderBy: [orderBy, { id: "desc" }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    include: {
      actionLog: {
        select: {
          id: true,
          actionType: true,
          category: true,
          state: true,
          reversibility: true,
          targetLabel: true,
          reason: true,
          flaggedAt: true,
          lockedAt: true,
          reversesActionId: true,
        },
      },
    },
  });

  const hasMore = rows.length > q.limit;
  const page = hasMore ? rows.slice(0, q.limit) : rows;

  return {
    rows: page.map((r) => ({
      id: r.id,
      occurredAt: r.occurredAt.toISOString(),
      actorKind: r.actorKind,
      actorRefId: r.actorRefId,
      actorName: r.actorName,
      actorEmail: r.actorEmail,
      actorGrant: r.actorGrant,
      actionCode: r.actionCode,
      method: r.method,
      route: r.route,
      outcome: r.outcome,
      severity: r.severity,
      statusCode: r.statusCode,
      storeId: r.storeId,
      targetType: r.targetType,
      targetId: r.targetId,
      durationMs: r.durationMs,
      detail: r.actionLog
        ? {
            actionLogId: r.actionLog.id,
            actionType: r.actionLog.actionType,
            category: r.actionLog.category,
            state: r.actionLog.state,
            reversibility: r.actionLog.reversibility,
            targetLabel: r.actionLog.targetLabel,
            reason: r.actionLog.reason,
            flaggedAt: r.actionLog.flaggedAt?.toISOString() ?? null,
            lockedAt: r.actionLog.lockedAt?.toISOString() ?? null,
            revertable:
              r.actionLog.state === "RECORDED" &&
              !r.actionLog.reversesActionId &&
              (r.actionLog.reversibility === "REVERSIBLE" ||
                r.actionLog.reversibility === "REVERSIBLE_WITH_CAVEAT" ||
                r.actionLog.reversibility === "SNAPSHOT_RESTORE"),
          }
        : null,
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

export interface ActorSummary {
  actorRefId: string | null;
  actorKind: string;
  actorName: string | null;
  actorEmail: string | null;
  total: number;
  destructive: number;
  denied: number;
  lastSeen: string;
}

/**
 * The "sort by users" view: one row per actor with the counts that matter for
 * spotting risk — how much they did, how much of it was destructive, and how
 * often they were refused.
 */
export async function queryActorSummary(q: ActivityQuery): Promise<ActorSummary[]> {
  const where = buildWhere(q);

  const grouped = await prisma.activityEvent.groupBy({
    by: ["actorRefId", "actorKind"],
    where,
    _count: { _all: true },
    _max: { occurredAt: true },
    orderBy: { _count: { actorRefId: "desc" } },
    take: 200,
  });

  const refIds = grouped.map((g) => g.actorRefId).filter((v): v is string => Boolean(v));

  const [destructive, denied, names] = await Promise.all([
    prisma.activityEvent.groupBy({
      by: ["actorRefId"],
      where: { ...where, severity: "CRITICAL" },
      _count: { _all: true },
    }),
    prisma.activityEvent.groupBy({
      by: ["actorRefId"],
      where: { ...where, outcome: "DENIED" },
      _count: { _all: true },
    }),
    // Names are denormalised onto each row, so the most recent row carries the
    // display name as of that action — correct even after the account is gone.
    prisma.activityEvent.findMany({
      where: { actorRefId: { in: refIds } },
      distinct: ["actorRefId"],
      orderBy: { occurredAt: "desc" },
      select: { actorRefId: true, actorName: true, actorEmail: true },
    }),
  ]);

  const destructiveBy = new Map(destructive.map((d) => [d.actorRefId, d._count._all]));
  const deniedBy = new Map(denied.map((d) => [d.actorRefId, d._count._all]));
  const nameBy = new Map(names.map((n) => [n.actorRefId, n]));

  return grouped.map((g) => ({
    actorRefId: g.actorRefId,
    actorKind: g.actorKind,
    actorName: nameBy.get(g.actorRefId)?.actorName ?? null,
    actorEmail: nameBy.get(g.actorRefId)?.actorEmail ?? null,
    total: g._count._all,
    destructive: destructiveBy.get(g.actorRefId) ?? 0,
    denied: deniedBy.get(g.actorRefId) ?? 0,
    lastSeen: g._max.occurredAt?.toISOString() ?? "",
  }));
}

export interface EntitySummary {
  targetType: string | null;
  total: number;
  destructive: number;
  lastSeen: string;
}

/** The "sort by table" view: one row per Prisma model that was written to. */
export async function queryEntitySummary(q: ActivityQuery): Promise<EntitySummary[]> {
  const where = buildWhere(q);

  const grouped = await prisma.activityEvent.groupBy({
    by: ["targetType"],
    where: { ...where, targetType: { not: null } },
    _count: { _all: true },
    _max: { occurredAt: true },
    orderBy: { _count: { targetType: "desc" } },
    take: 100,
  });

  const destructive = await prisma.activityEvent.groupBy({
    by: ["targetType"],
    where: { ...where, targetType: { not: null }, severity: "CRITICAL" },
    _count: { _all: true },
  });
  const destructiveBy = new Map(destructive.map((d) => [d.targetType, d._count._all]));

  return grouped.map((g) => ({
    targetType: g.targetType,
    total: g._count._all,
    destructive: destructiveBy.get(g.targetType) ?? 0,
    lastSeen: g._max.occurredAt?.toISOString() ?? "",
  }));
}

export interface TrailStats {
  total: number;
  critical: number;
  denied: number;
  flagged: number;
  revertable: number;
  /** Oldest row, so the UI can say when logging began instead of showing an empty page. */
  earliest: string | null;
}

export async function queryStats(q: ActivityQuery): Promise<TrailStats> {
  const where = buildWhere(q);
  const [total, critical, denied, flagged, revertable, earliestRow] = await Promise.all([
    prisma.activityEvent.count({ where }),
    prisma.activityEvent.count({ where: { ...where, severity: "CRITICAL" } }),
    prisma.activityEvent.count({ where: { ...where, outcome: "DENIED" } }),
    prisma.actionLog.count({ where: { flaggedAt: { not: null } } }),
    prisma.actionLog.count({
      where: {
        state: "RECORDED",
        reversesActionId: null,
        reversibility: { in: ["REVERSIBLE", "REVERSIBLE_WITH_CAVEAT", "SNAPSHOT_RESTORE"] },
      },
    }),
    prisma.activityEvent.findFirst({ orderBy: { occurredAt: "asc" }, select: { occurredAt: true } }),
  ]);

  return {
    total,
    critical,
    denied,
    flagged,
    revertable,
    earliest: earliestRow?.occurredAt.toISOString() ?? null,
  };
}

/** One action's full record, including payload, annotations and snapshot. */
export async function getActionDetail(actionLogId: string) {
  const row = await prisma.actionLog.findUnique({
    where: { id: actionLogId },
    include: {
      annotations: { orderBy: { createdAt: "desc" } },
      snapshot: {
        select: {
          id: true,
          capturedAt: true,
          status: true,
          rootType: true,
          rootLabel: true,
          rowCount: true,
          modelCount: true,
          payloadBytes: true,
          expiresAt: true,
          schemaVersion: true,
        },
      },
      reverses: { select: { id: true, targetLabel: true, occurredAt: true } },
      reversedBy: { select: { id: true, occurredAt: true, actorName: true, reason: true } },
      activityEvent: { select: { id: true, route: true, method: true, ipHash: true } },
    },
  });

  if (!row) return null;

  const def = getActionDefinition(row.actionType);

  return {
    ...row,
    occurredAt: row.occurredAt.toISOString(),
    catalogue: def
      ? {
          category: def.category,
          reversibility: def.reversibility,
          caveat: "caveat" in def ? def.caveat : null,
          rationale: "rationale" in def ? def.rationale : null,
          compensation: "compensation" in def ? def.compensation : null,
        }
      : null,
  };
}

/**
 * Coverage manifest for the admin panel.
 *
 * An empty activity page is ambiguous — it can mean "nothing happened" or "this
 * area was never instrumented". Publishing what is and is not recorded removes
 * that ambiguity, which is the single most important property of an audit
 * trail.
 */
export function getCoverageManifest() {
  const curated = Object.entries(ACTION_CATALOG).map(([key, def]) => ({
    actionType: key,
    category: def.category,
    reversibility: def.reversibility,
    severity: def.severity,
  }));

  return {
    curated,
    curatedCount: curated.length,
    waivers: Object.entries(TRAIL_WAIVERS).map(([route, reason]) => ({ route, reason })),
    note: "Every mutating API request produces a trail row. Actions listed above additionally carry a typed payload and, where the class allows, a reverse handler.",
  };
}
