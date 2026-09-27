import { inngest } from "../client";
import { isR2Configured } from "@/lib/backup/r2-client";
import {
  listBackupTables,
  exportOneTable,
  todayPrefix,
  pruneOldBackups,
} from "@/lib/backup/export-tables";
import { claimBackupRun, finishBackupRun, failBackupRun } from "@/lib/backup/run-backup";
import { NIGHTLY_RUN_ID_PREFIX } from "@/lib/backup/constants";

/**
 * Nightly logical backup: every application table (data only — schema comes from
 * `prisma/migrations/` in git) streamed via Postgres COPY, gzipped, and uploaded to
 * Cloudflare R2 — independent of Neon/Vercel, per docs/DATABASE.md's backup target.
 * No-ops cleanly if R2 isn't configured yet (Graceful Degradation, AGENTS.md).
 */
export const nightlyDatabaseBackup = inngest.createFunction(
  { id: "nightly-database-backup", retries: 3, triggers: [{ cron: "0 2 * * *" }] },
  async ({ step, runId: inngestRunId }) => {
    if (!isR2Configured()) {
      return { skipped: true, reason: "R2 not configured" };
    }

    // Keyed on the Inngest run so a re-executed claim step finds its own row.
    // Not exclusive: a manual run writes its own folder, so the nightly never
    // waits on one or gets skipped for one.
    const runId = await step.run("start-backup-run", async () => {
      const run = await claimBackupRun({
        id: `${NIGHTLY_RUN_ID_PREFIX}${inngestRunId}`,
        exclusive: false,
      });
      return run!.id; // a non-exclusive claim always returns a run
    });

    let summary;
    try {
      const tables = await step.run("discover-tables", () => listBackupTables());
      const datePrefix = todayPrefix();

      let totalBytes = 0;
      for (const table of tables) {
        const bytes = await step.run(`export-${table.name}`, () =>
          exportOneTable(table.name, datePrefix)
        );
        totalBytes += bytes;
      }

      const totalRows = tables.reduce((sum, t) => sum + t.rowEstimate, 0);
      summary = { tableCount: tables.length, totalRows, totalBytes };

      // Steps return void here rather than the updated record — Inngest
      // serializes step output to JSON for replay, and JSON can't carry a bigint.
      await step.run("finalize-backup-run", () => finishBackupRun(runId, summary!));
    } catch (err) {
      await step.run("mark-backup-run-failed", () => failBackupRun(runId, err));
      throw err;
    }

    // Outside the try: the backup is already recorded SUCCESS, and a failed
    // retention sweep must not flip it to FAILED.
    let deletedObjects = 0;
    try {
      ({ deletedObjects } = await step.run("prune-old-backups", () => pruneOldBackups()));
    } catch (err) {
      console.error("[NIGHTLY_BACKUP] prune failed", err);
    }

    return { runId, ...summary, deletedObjects };
  }
);
