import { prisma } from "@/lib/prisma";
import { listBackupTables, exportOneTable, pruneOldBackups } from "./export-tables";
import {
  ACTIVE_RUN_WINDOW_MINUTES,
  NIGHTLY_ACTIVE_RUN_WINDOW_MINUTES,
  NIGHTLY_RUN_ID_PREFIX,
} from "./constants";

export interface BackupSummary {
  tableCount: number;
  totalRows: number;
  totalBytes: number;
}

export interface ClaimedBackupRun {
  id: string;
  startedAt: Date;
}

/**
 * How long a manual run may spend exporting before it gives up and records
 * FAILED itself. It must stay under the route's `maxDuration` (300s): a run the
 * platform kills never reaches its catch block, and its row would sit RUNNING
 * until the next claim sweeps it.
 */
export const MANUAL_RUN_TIME_BUDGET_MS = 270 * 1000;

/**
 * Starts a backup run's row under an advisory lock shared by every caller.
 *
 * First sweeps RUNNING rows past their active window (constants.ts) to FAILED:
 * a process killed mid-run never records its own outcome.
 *
 * - `id` makes the claim idempotent. The nightly Inngest function passes one
 *   derived from its run id, so a re-executed claim step finds its own row
 *   instead of creating a second one.
 * - `exclusive` refuses (returns null) while another MANUAL run is active. The
 *   admin button sets it; the nightly doesn't. The two write to different
 *   folders, so neither waits on the other: the nightly must never be skipped,
 *   and the button must still work while a nightly is stuck.
 */
export async function claimBackupRun(opts: {
  id?: string;
  exclusive: boolean;
}): Promise<ClaimedBackupRun | null> {
  const now = Date.now();
  const manualCutoff = new Date(now - ACTIVE_RUN_WINDOW_MINUTES * 60 * 1000);
  const nightlyCutoff = new Date(now - NIGHTLY_ACTIVE_RUN_WINDOW_MINUTES * 60 * 1000);
  const nightly = { id: { startsWith: NIGHTLY_RUN_ID_PREFIX } };
  const abandoned = (minutes: number) => ({
    status: "FAILED" as const,
    finishedAt: new Date(now),
    errorMessage: `Abandoned: still running after ${minutes} minutes, so the process was stopped before it could record an outcome.`,
  });

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('epidom-backup-run'))`;

    await tx.backupRun.updateMany({
      where: { status: "RUNNING", startedAt: { lt: manualCutoff }, NOT: nightly },
      data: abandoned(ACTIVE_RUN_WINDOW_MINUTES),
    });
    await tx.backupRun.updateMany({
      where: { status: "RUNNING", startedAt: { lt: nightlyCutoff }, ...nightly },
      data: abandoned(NIGHTLY_ACTIVE_RUN_WINDOW_MINUTES),
    });

    if (opts.id) {
      const own = await tx.backupRun.findUnique({
        where: { id: opts.id },
        select: { id: true, startedAt: true },
      });
      if (own) return own;
    }

    if (opts.exclusive) {
      const active = await tx.backupRun.findFirst({
        where: { status: "RUNNING", startedAt: { gte: manualCutoff }, NOT: nightly },
        select: { id: true },
      });
      if (active) return null;
    }

    return tx.backupRun.create({
      data: { ...(opts.id ? { id: opts.id } : {}), status: "RUNNING" },
      select: { id: true, startedAt: true },
    });
  });
}

/**
 * R2 folder for a manual run: `<YYYY-MM-DD>-manual-<HHMMSS>` (UTC start time).
 * It is a sibling of the nightly's `<YYYY-MM-DD>` folder, never the same one:
 * tables are overwritten one at a time, so a manual run that failed halfway
 * through the nightly's folder would leave a mix of two snapshots that
 * restore-from-backup.ts would load without complaint.
 */
export function manualBackupFolder(startedAt: Date): string {
  const iso = startedAt.toISOString(); // 2026-09-26T14:03:27.123Z
  return `${iso.slice(0, 10)}-manual-${iso.slice(11, 19).replaceAll(":", "")}`;
}

export async function finishBackupRun(runId: string, summary: BackupSummary): Promise<void> {
  await prisma.backupRun.update({
    where: { id: runId },
    data: {
      status: "SUCCESS",
      finishedAt: new Date(),
      // A slow run swept as abandoned can still finish: drop the stale message.
      errorMessage: null,
      tableCount: summary.tableCount,
      totalRows: summary.totalRows,
      totalBytes: BigInt(summary.totalBytes),
    },
  });
}

export async function failBackupRun(runId: string, err: unknown): Promise<void> {
  await prisma.backupRun.update({
    where: { id: runId },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      errorMessage: err instanceof Error ? err.message : "Unknown backup error",
    },
  });
}

/**
 * Runs a claimed manual backup start to finish in one process: the path behind
 * the admin "Run backup now" button. The nightly Inngest function does the
 * same work split into durable steps. Never throws; the outcome lands on the
 * run's row, which is what the admin page reads.
 */
export async function executeBackupRun(
  runId: string,
  folder: string,
  timeBudgetMs: number = MANUAL_RUN_TIME_BUDGET_MS
): Promise<void> {
  const deadline = Date.now() + timeBudgetMs;
  try {
    const tables = await listBackupTables();
    let totalBytes = 0;
    for (const [i, table] of tables.entries()) {
      if (Date.now() > deadline) {
        throw new Error(
          `Stopped after ${Math.round(timeBudgetMs / 1000)}s with ${i} of ${tables.length} tables exported, before the function time limit. Folder ${folder} is incomplete.`
        );
      }
      totalBytes += await exportOneTable(table.name, folder);
    }
    await finishBackupRun(runId, {
      tableCount: tables.length,
      totalRows: tables.reduce((sum, t) => sum + t.rowEstimate, 0),
      totalBytes,
    });
  } catch (err) {
    console.error("[BACKUP_RUN]", runId, err);
    await failBackupRun(runId, err).catch((e) => console.error("[BACKUP_RUN] mark failed", e));
    return;
  }

  // Retention is housekeeping: a failed prune must not turn a good backup red.
  await pruneOldBackups().catch((err) => console.error("[BACKUP_RUN] prune", err));
}
