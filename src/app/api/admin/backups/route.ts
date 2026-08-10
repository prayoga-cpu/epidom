import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin";
import { isR2Configured } from "@/lib/backup/r2-client";

export const dynamic = "force-dynamic";

/** How many recent runs to show in the history list. */
const HISTORY_LIMIT = 20;

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

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const runs = await prisma.backupRun.findMany({
    orderBy: { startedAt: "desc" },
    take: HISTORY_LIMIT,
  });

  const lastSuccess = runs.find((r) => r.status === "SUCCESS") ?? null;

  return NextResponse.json({
    data: {
      r2Configured: isR2Configured(),
      lastSuccess: lastSuccess
        ? {
            finishedAt: lastSuccess.finishedAt?.toISOString() ?? null,
            tableCount: lastSuccess.tableCount,
            totalRows: lastSuccess.totalRows,
            totalBytes: lastSuccess.totalBytes.toString(),
          }
        : null,
      history: runs.map((r) => ({
        id: r.id,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        status: r.status,
        tableCount: r.tableCount,
        totalRows: r.totalRows,
        totalBytes: r.totalBytes.toString(),
        errorMessage: r.errorMessage,
      })),
    },
  });
}
