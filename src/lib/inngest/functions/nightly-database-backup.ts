import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { isR2Configured } from "@/lib/backup/r2-client";
import { listBackupTables, exportOneTable, todayPrefix, pruneOldBackups } from "@/lib/backup/export-tables";

/**
 * Nightly logical backup: every application table (data only — schema comes from
 * `prisma/migrations/` in git) streamed via Postgres COPY, gzipped, and uploaded to
 * Cloudflare R2 — independent of Neon/Vercel, per docs/DATABASE.md's backup target.
 * No-ops cleanly if R2 isn't configured yet (Graceful Degradation, AGENTS.md).
 */
export const nightlyDatabaseBackup = inngest.createFunction(
  { id: "nightly-database-backup", retries: 3, triggers: [{ cron: "0 2 * * *" }] },
  async ({ step }) => {
    if (!isR2Configured()) {
      return { skipped: true, reason: "R2 not configured" };
    }

    const runId = await step.run("start-backup-run", async () => {
      const run = await prisma.backupRun.create({ data: { status: "RUNNING" } });
      return run.id;
    });

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

      // Steps return void here rather than the updated record — Inngest
      // serializes step output to JSON for replay, and JSON can't carry a bigint.
      await step.run("finalize-backup-run", async () => {
        await prisma.backupRun.update({
          where: { id: runId },
          data: {
            status: "SUCCESS",
            finishedAt: new Date(),
            tableCount: tables.length,
            totalRows,
            totalBytes: BigInt(totalBytes),
          },
        });
      });

      const pruned = await step.run("prune-old-backups", () => pruneOldBackups());

      return { runId, tableCount: tables.length, totalRows, totalBytes, ...pruned };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown backup error";
      await step.run("mark-backup-run-failed", async () => {
        await prisma.backupRun.update({
          where: { id: runId },
          data: { status: "FAILED", finishedAt: new Date(), errorMessage },
        });
      });
      throw err;
    }
  }
);
