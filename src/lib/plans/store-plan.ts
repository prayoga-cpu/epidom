import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { PlanTier } from "./entitlements";

/**
 * The plan a STORE runs on: its owner's subscription, whoever is asking — a
 * linked staff account has no subscription of its own. The same rule as
 * requirePlan, as a plain read with no redirects, for pages that show or hide
 * a section by plan rather than gate the whole page. Anything not ACTIVE counts
 * as FREE.
 */
export const getStorePlan = cache(async function getStorePlan(storeId: string): Promise<PlanTier> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      business: {
        select: { user: { select: { subscription: { select: { plan: true, status: true } } } } },
      },
    },
  });
  const subscription = store?.business.user.subscription;
  return subscription?.status === "ACTIVE" ? subscription.plan : "FREE";
});
