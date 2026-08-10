import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { sendBackupAlertEmail } from "@/lib/services/email.service";
import { isR2Configured } from "@/lib/backup/r2-client";

/** How stale the last successful backup can be before this pages the team. */
const STALE_AFTER_HOURS = 36;

/**
 * Daily check that the nightly backup is actually succeeding — the piece that
 * catches "it silently stopped working and nobody noticed."
 */
export const checkBackupFreshness = inngest.createFunction(
  { id: "check-backup-freshness", retries: 3, triggers: [{ cron: "0 9 * * *" }] },
  async ({ step }) => {
    if (!isR2Configured()) {
      return { skipped: true, reason: "R2 not configured" };
    }

    const lastSuccess = await step.run("find-last-success", async () => {
      const run = await prisma.backupRun.findFirst({
        where: { status: "SUCCESS" },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true },
      });
      return run?.finishedAt?.toISOString() ?? null;
    });

    const hoursSince = lastSuccess
      ? (Date.now() - new Date(lastSuccess).getTime()) / (60 * 60 * 1000)
      : null;
    const isStale = hoursSince === null || hoursSince > STALE_AFTER_HOURS;

    if (!isStale) {
      return { stale: false, lastSuccess };
    }

    const reason = lastSuccess
      ? `No successful database backup in over ${STALE_AFTER_HOURS} hours.`
      : "No successful database backup has ever been recorded.";

    await step.run("send-alert", () => sendBackupAlertEmail(reason, lastSuccess));

    return { stale: true, lastSuccess, reason };
  }
);
