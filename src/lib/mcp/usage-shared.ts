/**
 * The client-safe half of the Claude connector usage report: the ranges the
 * admin page offers and the report's shape. Kept apart from usage.ts, which
 * reads the database (Prisma, and through it the `pg` driver with `fs`/`net`),
 * so the admin page's client component can import these without pulling the
 * driver into the browser bundle (that broke the build on 2026-11-07).
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
