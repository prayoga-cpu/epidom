import { after, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import { isR2Configured } from "@/lib/backup/r2-client";
import { claimBackupRun, executeBackupRun, manualBackupFolder } from "@/lib/backup/run-backup";
import { getActingAdmin } from "@/lib/auth/require-admin-api";
import { withAdminApiHandler } from "@/lib/admin-api-handler";

export const dynamic = "force-dynamic";

/**
 * The manual backup runs inside `after()`, which lives as long as the function
 * does. A full export took ~80s when this was written; 300s is allowed on every
 * Vercel plan, Hobby included. Keep MANUAL_RUN_TIME_BUDGET_MS (run-backup.ts)
 * under this, so a slow run records FAILED itself instead of being killed.
 */
export const maxDuration = 300;

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

/**
 * POST /api/admin/backups
 * "Run backup now": starts a backup immediately instead of waiting for the
 * nightly Inngest cron, and doesn't depend on Inngest at all, so it still works
 * when the cron has stopped firing. Answers 202 as soon as the RUNNING row
 * exists; the admin page polls GET until the row settles.
 */
export const POST = withAdminApiHandler(async () => {
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "R2 is not configured, so there is nowhere to write a backup." },
      { status: 503 }
    );
  }

  const run = await claimBackupRun({ exclusive: true });
  if (!run) {
    return NextResponse.json({ error: "A backup is already running." }, { status: 409 });
  }

  const folder = manualBackupFolder(run.startedAt);
  after(() => executeBackupRun(run.id, folder));

  return NextResponse.json({ data: { runId: run.id, folder } }, { status: 202 });
});
