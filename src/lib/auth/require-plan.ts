import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SubscriptionPlan } from "@prisma/client";
import { planRank, upgradeHrefFor } from "@/lib/plans/entitlements";

/**
 * Server-side plan gate. Call at the top of any route layout or page that
 * requires a minimum subscription tier.
 *
 * - Redirects to /login if no session.
 * - Redirects to /pricing?upgrade=true if plan is below the required tier.
 * - Returns the resolved userId on success so callers can reuse it.
 */
export async function requirePlan(
  storeId: string,
  minPlan: SubscriptionPlan
): Promise<{ userId: string }> {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;

  // Resolve storeId → businessId → userId to verify ownership and get the plan.
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      business: {
        select: {
          userId: true,
          user: {
            select: {
              subscription: { select: { plan: true, status: true } },
            },
          },
        },
      },
    },
  });

  if (!store || store.business.userId !== userId) {
    redirect("/stores");
  }

  const subscription = store.business.user.subscription;
  let currentPlan: SubscriptionPlan = "FREE";

  if (subscription && subscription.status === "ACTIVE") {
    currentPlan = subscription.plan;
  }

  if (planRank(currentPlan) < planRank(minPlan)) {
    redirect(upgradeHrefFor(minPlan));
  }

  return { userId };
}
