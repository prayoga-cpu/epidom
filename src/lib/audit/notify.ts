import { inngest } from "@/lib/inngest/client";
import { isAdminEmail } from "@/lib/admin";

/**
 * Alerting for critical audit events.
 *
 * An audit log is detective, not preventive. Nobody sits watching
 * `/admin/activity`, least of all a solo operator, so a destructive action that
 * is merely *recorded* is still unnoticed until someone goes looking — usually
 * after the damage is reported by the customer.
 *
 * Two channels, deliberately separate:
 *  - the operator, so a destructive action is noticed within minutes;
 *  - the affected user, so an account change cannot happen silently to them.
 *
 * The second is the one that actually deters abuse. Today an admin can reset a
 * password, mint a temporary one, force `emailVerified` and change a plan, and
 * the account holder is never told — unlike the legitimate self-service flow,
 * which always emails.
 */

export type CriticalActionCode =
  | "admin.user.delete"
  | "admin.user.reset_account"
  | "admin.user.set_admin"
  | "admin.user.reset_password"
  | "admin.user.temp_password"
  | "admin.user.set_custom_price"
  | "admin.seed_demo"
  | "store.delete";

export type AccountActionCode = "reset-password" | "temp-password" | "plan-change" | "reactivated";

/**
 * Notify the operator that a critical action was recorded.
 *
 * Fire-and-forget: a failed alert must never fail the action it describes, and
 * an admin blocked from deleting an account because an email bounced would be
 * a worse outcome than a missed notification.
 */
export async function notifyCriticalAction(
  actionCode: CriticalActionCode | string,
  targetLabel: string,
  actorEmail: string
): Promise<void> {
  try {
    await inngest.send({
      name: "audit/critical.recorded",
      data: { actionCode, targetLabel, actorEmail, occurredAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error("[audit] failed to emit critical alert:", error);
  }
}

/**
 * Tell the affected account holder that an admin changed something on their
 * account, at the moment it happens.
 *
 * On a Vercel preview (dev.epidom.fr) only admins are notified. The preview runs
 * against a nightly clone of production's users but shares production's Inngest
 * and Resend keys, so a temp-password or plan change made there for a real
 * customer would email that customer about a change to a throwaway copy of their
 * account. Suppressing at the emit point holds whichever deployment Inngest
 * routes the event to. Production behaviour is unchanged.
 */
export async function notifyAccountAction(
  target: { id: string; email: string; name: string },
  action: AccountActionCode
): Promise<void> {
  if (process.env.VERCEL_ENV === "preview" && !isAdminEmail(target.email)) {
    console.info(`[audit] preview: account-change notice (${action}) suppressed for ${target.id}`);
    return;
  }

  try {
    await inngest.send({
      name: "audit/account.changed",
      data: {
        userId: target.id,
        userEmail: target.email,
        userName: target.name,
        action,
        occurredAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[audit] failed to emit account-change notice:", error);
  }
}
