import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SubscriptionPlan } from "@prisma/client";
import { planRank, upgradeHrefFor } from "@/lib/plans/entitlements";
import { verifyStoreAccess } from "@/lib/utils/store-verification";

/**
 * Server-side plan gate. Call at the top of any route layout or page that
 * requires a minimum subscription tier.
 *
 * - Redirects to /login if no session.
 * - Redirects to /pricing?upgrade=true if plan is below the required tier.
 * - Returns the resolved userId on success so callers can reuse it.
 *
 * The plan is always the STORE OWNER's subscription. A linked staff account
 * (StaffMember.userId) has no subscription of its own and isn't the one who
 * pays — it reaches the store on the owner's plan, and if that plan doesn't
 * cover the page (or is suspended) it is sent back to the store list rather
 * than to a pricing/billing page it can neither use nor is allowed to open.
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
              subscription: {
                select: { plan: true, status: true, customPricePendingAt: true },
              },
            },
          },
        },
      },
    },
  });

  if (!store) {
    redirect("/stores");
  }

  const isOwner = store.business.userId === userId;
  if (!isOwner) {
    const access = await verifyStoreAccess(storeId, userId).catch(() => null);
    if (!access) {
      redirect("/stores");
    }
  }

  const subscription = store.business.user.subscription;

  // Access is suspended behind an admin-quoted custom price. /pricing can't
  // sell them anything — the offer is only payable from their Billing page,
  // which is owner-only: sending a staff account there would just bounce it
  // between two guards.
  if (subscription?.customPricePendingAt) {
    redirect(isOwner ? `/store/${storeId}/billing?customPrice=pending` : "/stores");
  }

  let currentPlan: SubscriptionPlan = "FREE";

  if (subscription && subscription.status === "ACTIVE") {
    currentPlan = subscription.plan;
  }

  if (planRank(currentPlan) < planRank(minPlan)) {
    redirect(isOwner ? upgradeHrefFor(minPlan) : "/stores");
  }

  return { userId };
}
