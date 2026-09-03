import { randomUUID } from "crypto";
import { inngest } from "../client";
import { userService } from "@/lib/services";
import { runWithAuditScope, type AuditScope } from "@/lib/audit/actor-scope";
import { systemActor } from "@/lib/audit/actor";
import { beginAction, completeAction, failAction } from "@/lib/audit/record";
import { captureEntitySnapshot } from "@/lib/audit/snapshot";

/**
 * Daily sweep that permanently deletes accounts past their 365-day
 * retention window (deactivatedAt + 1 year). Reuses the existing hard-delete
 * path (userService.deleteAccount) so there's a single cascade-delete
 * implementation.
 *
 * This is one of the eight cascade-root call sites the audit catalogue
 * snapshots (docs/AUDIT_LOG_PLAN.md) — the automated equivalent of an admin
 * clicking "delete user", and the one least likely to be noticed if it goes
 * wrong, since nobody is watching it run. A full graph snapshot is captured
 * immediately before each delete, and the erasure event fired afterward tells
 * the audit trail itself to shred any residual copies of that person's data —
 * otherwise a snapshot captured seconds before permanent deletion would
 * outlive the very promise ("permanently and irreversibly deleted", Terms
 * section11) the purge exists to keep.
 */
export const purgeExpiredAccounts = inngest.createFunction(
  { id: "purge-expired-accounts", retries: 3, triggers: [{ cron: "0 3 * * *" }] },
  async ({ step }) => {
    // Only carry IDs across the step boundary — Inngest serializes step
    // output to JSON for replay, and the full User rows aren't needed here.
    const expired = await step.run("find-expired", async () => {
      const users = await userService.getAccountsPastRetention();
      return users.map((u) => ({ id: u.id, email: u.email, name: u.name }));
    });

    let purged = 0;

    for (const user of expired) {
      await step.run(`purge-${user.id}`, () => purgeOne(user));
      purged++;
    }

    return { purged: expired.length };
  }
);

async function purgeOne(user: { id: string; email: string; name: string }): Promise<void> {
  const scope: AuditScope = {
    actor: systemActor("purge-expired-accounts"),
    meta: {
      requestId: randomUUID(),
      method: "CRON",
      route: "/inngest/purge-expired-accounts",
      ipHash: null,
      userAgent: null,
      startedAt: Date.now(),
    },
    recordedActionIds: [],
  };

  await runWithAuditScope(scope, async () => {
    const actionLogId = await beginAction({
      actionType: "admin.user.delete",
      targetId: user.id,
      payload: { userId: user.id, userEmail: user.email, userName: user.name, snapshotId: null, rowCount: 0 },
      reason: "Automated retention purge: 365 days past deactivation (Terms section11).",
    });

    try {
      const snapshot = await captureEntitySnapshot({
        rootType: "User",
        rootId: user.id,
        rootLabel: user.email,
        reasonCode: "admin.user.delete",
        subjectUserIds: [user.id],
      });

      await userService.deleteAccount(user.id);

      await completeAction(actionLogId, {
        snapshotId: snapshot?.id ?? null,
        payload: {
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          snapshotId: snapshot?.id ?? null,
          rowCount: snapshot?.rowCount ?? 0,
        },
      });

      // Tell the audit trail itself to shred any residual copies of this
      // person's data once the retention promise's own deadline passes — the
      // snapshot just captured has a 90-day expiry (shorter than the 365-day
      // account retention it followed), so this mainly reaches other users'
      // ActionLog rows naming this id as a subject (e.g. an admin's earlier
      // password reset on this account).
      await inngest.send({ name: "audit/subject.erase", data: { userId: user.id } });
    } catch (error) {
      await failAction(actionLogId, error instanceof Error ? error.message : String(error));
      throw error;
    }
  });
}
