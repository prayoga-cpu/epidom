import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import { isR2Configured } from "@/lib/backup/r2-client";
import { getActingAdmin } from "@/lib/auth/require-admin-api";

export const dynamic = "force-dynamic";

/** How many recent runs to show in the history list. */
const HISTORY_LIMIT = 20;

export async function GET() {
  if (!(await getActingAdmin())) {
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
