import { inngest } from "../client";
import { userService } from "@/lib/services";

/**
 * Daily sweep that permanently deletes accounts past their 365-day
 * retention window (deactivatedAt + 1 year). Reuses the existing hard-delete
 * path (userService.deleteAccount) so there's a single cascade-delete
 * implementation.
 */
export const purgeExpiredAccounts = inngest.createFunction(
  { id: "purge-expired-accounts", retries: 3, triggers: [{ cron: "0 3 * * *" }] },
  async ({ step }) => {
    // Only carry IDs across the step boundary — Inngest serializes step
    // output to JSON for replay, and the full User rows aren't needed here.
    const expiredIds = await step.run("find-expired", async () => {
      const users = await userService.getAccountsPastRetention();
      return users.map((u) => u.id);
    });

    for (const id of expiredIds) {
      await step.run(`purge-${id}`, () => userService.deleteAccount(id));
    }

    return { purged: expiredIds.length };
  }
);
