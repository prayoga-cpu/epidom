import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { RETENTION } from "@/lib/audit/config";

/**
 * Nightly retention sweep for the audit trail.
 *
 * The windows are not arbitrary. Terms `section11` promises account data is
 * "permanently and irreversibly deleted" after 365 days, so nothing here may
 * outlive that — and snapshots, which hold complete row content including
 * customer orders and attendance photos, expire far sooner at 90 days.
 *
 * Rows under legal hold (`lockedAt`) are exempt from both this sweep and the
 * GDPR shredder. That exemption is a genuine conflict with an erasure request
 * and needs a written legal position before it is ever exercised; see
 * docs/AUDIT_LOG_PLAN.md §8.
 */
export const pruneAuditTrail = inngest.createFunction(
  { id: "prune-audit-trail", retries: 2, triggers: [{ cron: "0 4 * * *" }] },
  async ({ step }) => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Snapshots first: they are the largest and most sensitive payloads, so if
    // the run is interrupted the highest-risk data is already gone.
    const snapshots = await step.run("expire-snapshots", async () => {
      const result = await prisma.entitySnapshot.updateMany({
        where: {
          expiresAt: { lt: new Date(now) },
          status: "STORED",
          lockedAt: null,
        },
        // The row is kept as a tombstone; only the payload is destroyed. An
        // investigation still needs to know that something was deleted and how
        // much, long after the content itself must be gone.
        data: { status: "EXPIRED", payload: undefined, orphanRepairs: undefined },
      });
      return result.count;
    });

    const clearedPayloads = await step.run("clear-expired-snapshot-payloads", async () => {
      const expired = await prisma.entitySnapshot.findMany({
        where: { status: "EXPIRED", NOT: { payload: { equals: undefined } }, lockedAt: null },
        select: { id: true },
        take: 500,
      });
      for (const row of expired) {
        await prisma.entitySnapshot.update({
          where: { id: row.id },
          data: { payload: undefined, orphanRepairs: undefined },
        });
      }
      return expired.length;
    });

    const actions = await step.run("prune-action-logs", async () => {
      const cutoff = new Date(now - RETENTION.ACTION_LOG_DAYS * day);
      const result = await prisma.actionLog.deleteMany({
        where: { occurredAt: { lt: cutoff }, lockedAt: null },
      });
      return result.count;
    });

    const events = await step.run("prune-activity-events", async () => {
      const cutoff = new Date(now - RETENTION.ACTIVITY_EVENT_DAYS * day);
      const result = await prisma.activityEvent.deleteMany({
        where: { occurredAt: { lt: cutoff } },
      });
      return result.count;
    });

    return { snapshots, clearedPayloads, actions, events };
  }
);

/**
 * GDPR erasure shredder.
 *
 * An erasure request has to reach data held *about* a subject in the audit
 * trail, not just their own rows — a snapshot of a deleted tenant contains the
 * owner's personal data even though the User row is long gone. The
 * `subjectUserIds` array with its GIN index is what makes that findable.
 *
 * Event payloads are destroyed; the rows survive as tombstones so the trail
 * does not develop unexplained gaps.
 */
export const shredAuditSubject = inngest.createFunction(
  { id: "shred-audit-subject", retries: 3, triggers: [{ event: "audit/subject.erase" }] },
  async ({ event, step }) => {
    const userId: string = event.data.userId;

    const snapshots = await step.run("shred-snapshots", async () => {
      const rows = await prisma.entitySnapshot.findMany({
        where: { subjectUserIds: { has: userId }, scrubbedAt: null, lockedAt: null },
        select: { id: true },
      });
      for (const row of rows) {
        await prisma.entitySnapshot.update({
          where: { id: row.id },
          data: {
            status: "SHREDDED",
            payload: undefined,
            orphanRepairs: undefined,
            rootLabel: null,
            scrubbedAt: new Date(),
          },
        });
      }
      return rows.length;
    });

    const actions = await step.run("shred-action-logs", async () => {
      const rows = await prisma.actionLog.findMany({
        where: { subjectUserIds: { has: userId }, scrubbedAt: null, lockedAt: null },
        select: { id: true },
      });
      for (const row of rows) {
        await prisma.actionLog.update({
          where: { id: row.id },
          data: {
            payload: undefined,
            actorEmail: null,
            actorName: null,
            targetLabel: "[erased]",
            reason: null,
            scrubbedAt: new Date(),
          },
        });
      }
      return rows.length;
    });

    const events = await step.run("shred-activity-events", async () => {
      const result = await prisma.activityEvent.updateMany({
        where: { actorRefId: userId },
        data: { actorEmail: null, actorName: null, ipHash: null, userAgent: null },
      });
      return result.count;
    });

    // Rows held under legal hold are reported, never silently skipped: the
    // requester is entitled to know something was retained, and on what basis.
    const held = await step.run("count-legal-holds", async () => {
      const [snapHeld, actionHeld] = await Promise.all([
        prisma.entitySnapshot.count({
          where: { subjectUserIds: { has: userId }, lockedAt: { not: null } },
        }),
        prisma.actionLog.count({
          where: { subjectUserIds: { has: userId }, lockedAt: { not: null } },
        }),
      ]);
      return snapHeld + actionHeld;
    });

    return { userId, snapshots, actions, events, retainedUnderLegalHold: held };
  }
);
