import { inngest } from "../client";
import { sendAuditCriticalEmail, sendAccountChangedEmail } from "@/lib/services/email.service";

/**
 * Alerting for the audit trail.
 *
 * Detection with no notification is not prevention — a solo operator will not
 * sit watching an activity page. These two functions are what turn a recorded
 * event into something a human actually sees.
 */

export const sendAuditCriticalAlert = inngest.createFunction(
  {
    id: "send-audit-critical-alert",
    retries: 3,
    triggers: [{ event: "audit/critical.recorded" }],
  },
  async ({ event }) => {
    const result = await sendAuditCriticalEmail({
      actionCode: event.data.actionCode,
      targetLabel: event.data.targetLabel,
      actorEmail: event.data.actorEmail,
      occurredAt: event.data.occurredAt,
    });

    // Throw so Inngest retries — the email service returns rather than throwing.
    if (!result.success) {
      throw new Error(`Failed to send critical audit alert for ${event.data.actionCode}`);
    }

    return { sent: true, actionCode: event.data.actionCode };
  }
);

/**
 * Tell the account holder an admin changed something on their account.
 *
 * This is the control that actually deters abuse: a password reset the user
 * never hears about is indistinguishable from a compromise, from their side.
 */
export const sendAccountChangedNotice = inngest.createFunction(
  {
    id: "send-account-changed-notice",
    retries: 3,
    triggers: [{ event: "audit/account.changed" }],
  },
  async ({ event }) => {
    const result = await sendAccountChangedEmail({
      userEmail: event.data.userEmail,
      userName: event.data.userName,
      action: event.data.action,
      occurredAt: event.data.occurredAt,
    });

    if (!result.success) {
      throw new Error(`Failed to send account-changed notice to ${event.data.userEmail}`);
    }

    return { sent: true, userId: event.data.userId };
  }
);
