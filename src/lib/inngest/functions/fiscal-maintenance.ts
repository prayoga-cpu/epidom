import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { runFiscalMaintenance } from "@/lib/fiscal/maintenance";

/**
 * Hourly pass over every store with a fiscal journal (or a recent paid order
 * that should have started one): late entries, then the day, month and year
 * closures that are due, then the month archives (src/lib/fiscal/maintenance.ts).
 *
 * Hourly rather than nightly because "the day is over" happens at each
 * store's own midnight. The same pass also runs when a sale opens a new
 * business day and when the owner opens the Fiscal journal page, so the
 * journal still closes its days while this job isn't synced with Inngest.
 */
export const fiscalMaintenance = inngest.createFunction(
  { id: "fiscal-maintenance", retries: 2, triggers: [{ cron: "15 * * * *" }] },
  async ({ step }) => {
    const storeIds = await step.run("find-stores", async () => {
      const rows = await prisma.$queryRaw<{ storeId: string }[]>`
        SELECT "storeId" FROM "fiscal_chain_heads" WHERE "chain" = 'ENTRY'
        UNION
        SELECT DISTINCT "storeId" FROM "orders"
        WHERE "createdAt" >= now() - interval '2 days'
          AND "paymentStatus"::text IN ('PAID', 'REFUNDED')`;
      return rows.map((r) => r.storeId);
    });

    let failed = 0;
    for (const storeId of storeIds) {
      try {
        await step.run(`store-${storeId}`, () => runFiscalMaintenance(storeId));
      } catch (err) {
        // One store's failure must not leave every other store's day open.
        failed++;
        console.error(`[FISCAL_MAINTENANCE] ${storeId}:`, err);
      }
    }
    return { stores: storeIds.length, failed };
  }
);
