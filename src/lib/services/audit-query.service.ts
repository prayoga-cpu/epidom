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

/**
 * A parsed query plus anything that had to be resolved against the database
 * before the filter could be built.
 *
 * `searchStoreIds` exists because "which restaurant" is the question this page
 * is most often asked, and `ActivityEvent.storeId` is a bare column with no
 * relation to `Store` — so a search term can only reach a store *name* via a
 * separate lookup. Resolving it here, once, at the request boundary rather than
 * inside `buildWhere` matters: the route runs two query functions in parallel,
 * and an async `buildWhere` would run that lookup twice per request.
 */
export type ResolvedActivityQuery = ActivityQuery & { searchStoreIds?: string[] };

/** Resolve the parts of a query that need a database round trip. */
export async function resolveActivityQuery(q: ActivityQuery): Promise<ResolvedActivityQuery> {
  if (!q.search) return q;
  const stores = await prisma.store.findMany({
    where: { name: { contains: q.search, mode: "insensitive" } },
    select: { id: true },
    take: 100,
  });
  return stores.length ? { ...q, searchStoreIds: stores.map((s) => s.id) } : q;
}

function buildWhere(q: ResolvedActivityQuery): Prisma.ActivityEventWhereInput {
  const range = toDateRange(q.from, q.to);
  const where: Prisma.ActivityEventWhereInput = {};

  if (range.gte || range.lt) {
    where.occurredAt = {
      ...(range.gte ? { gte: range.gte } : {}),
      ...(range.lt ? { lt: range.lt } : {}),
    };
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
      // Searching a restaurant by name is the whole point of the store column,
      // and the event only stores the id — see resolveActivityQuery.
      ...(q.searchStoreIds?.length ? [{ storeId: { in: q.searchStoreIds } }] : []),
    ];
  }

  return where;
}

export async function queryActivity(q: ResolvedActivityQuery): Promise<{
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

/** A restaurant an actor was seen working in, with how much of it they did. */
export interface ActorStoreRef {
  id: string;
  name: string;
  events: number;
}

export interface ActorSummary {
  actorRefId: string | null;
  actorKind: string;
  actorName: string | null;
  actorEmail: string | null;
  /** Restaurants this actor's recorded actions touched, busiest first. */
  stores: ActorStoreRef[];
  /** Job title for STAFF actors, whose identity only means anything per store. */
  staffRole: string | null;
  total: number;
  destructive: number;
  denied: number;
  lastSeen: string;
}

/**
 * An actor is only unique per (kind, refId), never by refId alone: SYSTEM uses a
 * job name as its ref and WEBHOOK uses a provider name, so the id spaces
 * genuinely overlap. Keying a rollup on refId alone merges two different actors
 * the moment a job and a provider share a name.
 */
function actorKey(kind: string, refId: string | null): string {
  return `${kind}:${refId ?? ""}`;
}

function storeRefName(id: string, names: Map<string, string>): string {
  // Naming a store we can no longer resolve by its id stub is the honest
  // answer; inventing "Unknown" would hide that the restaurant was deleted.
  return names.get(id) ?? `Deleted store ${id.slice(0, 6)}`;
}

/**
 * The "sort by users" view: one row per actor with the counts that matter for
 * spotting risk — how much they did, how much of it was destructive, and how
 * often they were refused.
 *
 * A name alone does not identify anyone: staff personas are per-store and share
 * first names across restaurants, and an owner account is named after the
 * business. So each row also carries the restaurants it acted in and an email,
 * which together answer "which specific person is this?".
 */
export async function queryActorSummary(q: ResolvedActivityQuery): Promise<ActorSummary[]> {
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
  const staffRefIds = grouped
    .filter((g) => g.actorKind === "STAFF")
    .map((g) => g.actorRefId)
    .filter((v): v is string => Boolean(v));

  const [destructive, denied, identities, storeFacets, staffRows] = await Promise.all([
    prisma.activityEvent.groupBy({
      by: ["actorRefId", "actorKind"],
      // `AND`, not a spread. `{ ...where, severity }` REPLACES an admin's own
      // severity filter, so filtering to INFO used to report destructive counts
      // drawn from a wider population than the total sitting next to them.
      where: { AND: [where, { severity: "CRITICAL" }] },
      _count: { _all: true },
    }),
    prisma.activityEvent.groupBy({
      by: ["actorRefId", "actorKind"],
      where: { AND: [where, { outcome: "DENIED" }] },
      _count: { _all: true },
    }),
    // Identity is read deliberately OUTSIDE `where`: the newest row an actor has
    // carries their current display name, and a narrow filter window can
    // legitimately hold only rows recorded before they were ever named.
    prisma.activityEvent.findMany({
      where: { actorRefId: { in: refIds } },
      distinct: ["actorRefId", "actorKind"],
      orderBy: { occurredAt: "desc" },
      select: { actorRefId: true, actorKind: true, actorName: true, actorEmail: true },
    }),
    // Which restaurants each actor touched, inside the filtered window. storeId
    // is a bare column with no relation to Store, so names come separately.
    prisma.activityEvent.groupBy({
      by: ["actorRefId", "actorKind", "storeId"],
      where: { AND: [where, { actorRefId: { in: refIds } }, { storeId: { not: null } }] },
      _count: { _all: true },
      orderBy: { _count: { actorRefId: "desc" } },
      take: 500,
    }),
    // A STAFF event never carries an email — resolveActor sets it to null
    // because a staff persona is established by PIN, not by an address — so
    // both the email and the job title have to come from the StaffMember row.
    staffRefIds.length
      ? prisma.staffMember.findMany({
          where: { id: { in: staffRefIds } },
          select: { id: true, email: true, role: true, customRoleLabel: true, storeId: true },
        })
      : Promise.resolve([]),
  ]);

  const storeIds = new Set<string>();
  for (const f of storeFacets) if (f.storeId) storeIds.add(f.storeId);
  for (const s of staffRows) storeIds.add(s.storeId);

  const stores = storeIds.size
    ? await prisma.store.findMany({
        where: { id: { in: [...storeIds] } },
        select: { id: true, name: true },
      })
    : [];

  const storeNames = new Map(stores.map((s) => [s.id, s.name]));
  const destructiveBy = new Map(
    destructive.map((d) => [actorKey(d.actorKind, d.actorRefId), d._count._all])
  );
  const deniedBy = new Map(denied.map((d) => [actorKey(d.actorKind, d.actorRefId), d._count._all]));
  const identityBy = new Map(identities.map((n) => [actorKey(n.actorKind, n.actorRefId), n]));
  const staffById = new Map(staffRows.map((s) => [s.id, s]));

  const storesBy = new Map<string, ActorStoreRef[]>();
  for (const f of storeFacets) {
    if (!f.storeId) continue;
    const key = actorKey(f.actorKind, f.actorRefId);
    const list = storesBy.get(key) ?? [];
    list.push({ id: f.storeId, name: storeRefName(f.storeId, storeNames), events: f._count._all });
    storesBy.set(key, list);
  }
  for (const list of storesBy.values()) list.sort((a, b) => b.events - a.events);

  return grouped.map((g) => {
    const key = actorKey(g.actorKind, g.actorRefId);
    const identity = identityBy.get(key);
    const staff = g.actorKind === "STAFF" && g.actorRefId ? staffById.get(g.actorRefId) : undefined;

    let actorStores = storesBy.get(key) ?? [];
    // A staff persona exists inside exactly one restaurant, so it can still be
    // placed even if every one of its events somehow recorded no store.
    if (actorStores.length === 0 && staff) {
      actorStores = [
        { id: staff.storeId, name: storeRefName(staff.storeId, storeNames), events: 0 },
      ];
    }

    return {
      actorRefId: g.actorRefId,
      actorKind: g.actorKind,
      actorName: identity?.actorName ?? null,
      actorEmail: identity?.actorEmail ?? staff?.email ?? null,
      stores: actorStores,
      staffRole: staff ? (staff.customRoleLabel ?? staff.role) : null,
      total: g._count._all,
      destructive: destructiveBy.get(key) ?? 0,
      denied: deniedBy.get(key) ?? 0,
      lastSeen: g._max.occurredAt?.toISOString() ?? "",
    };
  });
}

export interface EntitySummary {
  targetType: string | null;
  total: number;
  destructive: number;
  lastSeen: string;
}

/** The "sort by table" view: one row per Prisma model that was written to. */
export async function queryEntitySummary(q: ResolvedActivityQuery): Promise<EntitySummary[]> {
  const where = buildWhere(q);

  const grouped = await prisma.activityEvent.groupBy({
    by: ["targetType"],
    // `AND` rather than a spread, so an explicit ?targetType= filter survives
    // instead of being overwritten by this "any target at all" guard.
    where: { AND: [where, { targetType: { not: null } }] },
    _count: { _all: true },
    _max: { occurredAt: true },
    orderBy: { _count: { targetType: "desc" } },
    take: 100,
  });

  const destructive = await prisma.activityEvent.groupBy({
    by: ["targetType"],
    where: { AND: [where, { targetType: { not: null }, severity: "CRITICAL" }] },
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

export async function queryStats(q: ResolvedActivityQuery): Promise<TrailStats> {
  const where = buildWhere(q);
  const [total, critical, denied, flagged, revertable, earliestRow] = await Promise.all([
    prisma.activityEvent.count({ where }),
    // `AND`, not a spread: a spread let this count overwrite the admin's own
    // severity/outcome filter and report a wider population than `total`.
    prisma.activityEvent.count({ where: { AND: [where, { severity: "CRITICAL" }] } }),
    prisma.activityEvent.count({ where: { AND: [where, { outcome: "DENIED" }] } }),
    // `flagged` and `revertable` are counted over ActionLog, which the
    // ActivityEvent filter cannot address, so both are all-time totals. The UI
    // labels them as such rather than passing them off as filtered.
    prisma.actionLog.count({ where: { flaggedAt: { not: null } } }),
    prisma.actionLog.count({
      where: {
        state: "RECORDED",
        reversesActionId: null,
        reversibility: { in: ["REVERSIBLE", "REVERSIBLE_WITH_CAVEAT", "SNAPSHOT_RESTORE"] },
      },
    }),
    prisma.activityEvent.findFirst({
      orderBy: { occurredAt: "asc" },
      select: { occurredAt: true },
    }),
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
