import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
import { getStorageAdapter } from "@/lib/storage";

// Reads live DB stats — never cache.
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, isAdmin: true },
  });
  if (!user || !isAdminUser(user.email, user.isAdmin)) return null;
  return user;
}

/** How many of the largest tables (by on-disk size) to report. */
const TOP_TABLES = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Tables flagged in the infra audit as the highest row-growth risk. */
const GROWTH_TABLES = [
  { label: "Order", count: (since: Date) => prisma.order.count({ where: { createdAt: { gte: since } } }) },
  {
    label: "OrderItem",
    count: (since: Date) => prisma.orderItem.count({ where: { createdAt: { gte: since } } }),
  },
  {
    label: "StockMovement",
    count: (since: Date) => prisma.stockMovement.count({ where: { createdAt: { gte: since } } }),
  },
  {
    label: "WasteEntry",
    count: (since: Date) => prisma.wasteEntry.count({ where: { createdAt: { gte: since } } }),
  },
  {
    label: "AttendanceRecord",
    count: (since: Date) => prisma.attendanceRecord.count({ where: { createdAt: { gte: since } } }),
  },
  {
    label: "AggregatorEmail",
    count: (since: Date) => prisma.aggregatorEmail.count({ where: { createdAt: { gte: since } } }),
  },
  { label: "Alert", count: (since: Date) => prisma.alert.count({ where: { createdAt: { gte: since } } }) },
  {
    label: "OrderReceiptSend",
    count: (since: Date) => prisma.orderReceiptSend.count({ where: { sentAt: { gte: since } } }),
  },
];

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const since24h = new Date(now.getTime() - 1 * DAY_MS);
  const since7d = new Date(now.getTime() - 7 * DAY_MS);
  const since30d = new Date(now.getTime() - 30 * DAY_MS);

  const [dbSizeRows, tableRows, growthRows, storeCount, userCount, ordersByDayRows, blobUsage] =
    await Promise.all([
      prisma.$queryRaw<{ total_bytes: bigint }[]>`
        SELECT pg_database_size(current_database()) AS total_bytes
      `,
      // pg_stat_user_tables gives a cheap live-row estimate (n_live_tup) instead of a
      // full COUNT(*) scan, and auto-discovers every table — no hardcoded model list.
      prisma.$queryRaw<{ table_name: string; total_bytes: bigint; row_estimate: bigint }[]>`
        SELECT
          relname AS table_name,
          pg_total_relation_size(relid) AS total_bytes,
          n_live_tup AS row_estimate
        FROM pg_catalog.pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT ${TOP_TABLES}
      `,
      Promise.all(
        GROWTH_TABLES.map(async (t) => ({
          table: t.label,
          last24h: await t.count(since24h),
          last7d: await t.count(since7d),
          last30d: await t.count(since30d),
        }))
      ),
      prisma.store.count(),
      prisma.user.count(),
      // "orders" is the actual mapped table name (Order model has @@map("orders")) —
      // raw SQL bypasses Prisma's model->table mapping, so it must be spelled out.
      prisma.$queryRaw<{ day: string; count: bigint }[]>`
        SELECT to_char(date_trunc('day', "orderDate"), 'YYYY-MM-DD') AS day, COUNT(*) AS count
        FROM "orders"
        WHERE "orderDate" >= ${since30d}
        GROUP BY 1
        ORDER BY 1
      `,
      getStorageAdapter().getUsage(),
    ]);

  return NextResponse.json({
    data: {
      generatedAt: now.toISOString(),
      db: {
        totalBytes: Number(dbSizeRows[0]?.total_bytes ?? 0),
        tables: tableRows.map((t) => ({
          name: t.table_name,
          totalBytes: Number(t.total_bytes),
          rowEstimate: Number(t.row_estimate),
        })),
      },
      growth: growthRows,
      tenants: {
        storeCount,
        userCount,
        ordersByDay: ordersByDayRows.map((r) => ({ date: r.day, count: Number(r.count) })),
      },
      blob: blobUsage,
    },
  });
}
