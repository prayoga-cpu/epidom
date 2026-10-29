import { prisma } from "@/lib/prisma";

/**
 * Claude connector usage for Admin → Claude connector, from mcp_tool_call
 * (one row per tool call, no arguments or results) and the OAuth tables.
 */

export const USAGE_RANGES = [7, 30, 90] as const;
export type UsageRangeDays = (typeof USAGE_RANGES)[number];

export function parseUsageRange(value: string | undefined): UsageRangeDays {
  const days = Number(value);
  return (USAGE_RANGES as readonly number[]).includes(days) ? (days as UsageRangeDays) : 30;
}

export interface ConnectorUsage {
  days: UsageRangeDays;
  totals: { calls: number; errors: number; accounts: number; stores: number; connections: number };
  byDay: Array<{ day: string; calls: number; errors: number }>;
  byTool: Array<{ tool: string; calls: number; errors: number; avgMs: number }>;
  byStore: Array<{ storeId: string; name: string; calls: number }>;
  recentErrors: Array<{ at: string; tool: string; errorCode: string | null; store: string | null }>;
}

export async function getConnectorUsage(days: UsageRangeDays): Promise<ConnectorUsage> {
  const since = new Date(Date.now() - days * 86_400_000);
  const where = { createdAt: { gte: since } };

  const [calls, errors, accounts, storeGroups, toolGroups, toolErrors, connections, rows, recent] =
    await Promise.all([
      prisma.mcpToolCall.count({ where }),
      prisma.mcpToolCall.count({ where: { ...where, ok: false } }),
      prisma.mcpToolCall.groupBy({ by: ["userId"], where }),
      prisma.mcpToolCall.groupBy({
        by: ["storeId"],
        where: { ...where, storeId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { storeId: "desc" } },
        take: 20,
      }),
      prisma.mcpToolCall.groupBy({
        by: ["tool"],
        where,
        _count: { _all: true },
        _avg: { durationMs: true },
        orderBy: { _count: { tool: "desc" } },
      }),
      prisma.mcpToolCall.groupBy({
        by: ["tool"],
        where: { ...where, ok: false },
        _count: { _all: true },
      }),
      prisma.oauthConsent.count(),
      prisma.mcpToolCall.findMany({ where, select: { createdAt: true, ok: true } }),
      prisma.mcpToolCall.findMany({
        where: { ...where, ok: false },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { createdAt: true, tool: true, errorCode: true, storeId: true },
      }),
    ]);

  const storeIds = [
    ...new Set([
      ...storeGroups.map((g) => g.storeId).filter((id): id is string => Boolean(id)),
      ...recent.map((r) => r.storeId).filter((id): id is string => Boolean(id)),
    ]),
  ];
  const stores = storeIds.length
    ? await prisma.store.findMany({
        where: { id: { in: storeIds } },
        select: { id: true, name: true },
      })
    : [];
  const storeName = new Map(stores.map((s) => [s.id, s.name]));

  const perDay = new Map<string, { calls: number; errors: number }>();
  for (const row of rows) {
    const day = row.createdAt.toISOString().slice(0, 10);
    const entry = perDay.get(day) ?? { calls: 0, errors: 0 };
    entry.calls += 1;
    if (!row.ok) entry.errors += 1;
    perDay.set(day, entry);
  }
  const errorsByTool = new Map(toolErrors.map((g) => [g.tool, g._count._all]));

  return {
    days,
    totals: {
      calls,
      errors,
      accounts: accounts.length,
      stores: storeGroups.length,
      connections,
    },
    byDay: [...perDay.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([day, v]) => ({ day, ...v })),
    byTool: toolGroups.map((g) => ({
      tool: g.tool,
      calls: g._count._all,
      errors: errorsByTool.get(g.tool) ?? 0,
      avgMs: Math.round(g._avg.durationMs ?? 0),
    })),
    byStore: storeGroups.map((g) => ({
      storeId: g.storeId!,
      name: storeName.get(g.storeId!) ?? "(deleted store)",
      calls: g._count._all,
    })),
    recentErrors: recent.map((r) => ({
      at: r.createdAt.toISOString(),
      tool: r.tool,
      errorCode: r.errorCode,
      store: r.storeId ? (storeName.get(r.storeId) ?? null) : null,
    })),
  };
}
