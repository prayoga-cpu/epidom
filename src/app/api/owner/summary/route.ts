/**
 * GET /api/owner/summary
 *
 * Finance's "All outlets" scope: every store in the signed-in owner's
 * business, side by side, for one date range. Operations plan and up
 * (FEATURE_MIN_PLAN.finance), owner only.
 *
 * Each outlet's row is computeStoreFinanceSummary — the very function behind
 * that outlet's own Finance page — so a row here always equals the outlet's
 * report for the same dates. It costs a handful of queries per outlet, run in
 * parallel; worth it next to the drift a second copy of the arithmetic had
 * (net profit that ignored refunds, tax and card fees; costs converted into
 * the business currency while revenue stayed in each store's own).
 *
 * Money totals are only added up when every outlet uses the same currency —
 * summing rupiah and euros produces a number that means nothing, so a
 * mixed-currency business gets `totals: null` and per-outlet figures, each in
 * its outlet's currency.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { minPlanFor, planHasFeature, PLAN_LABELS } from "@/lib/plans/entitlements";
import { computeStoreFinanceSummary } from "@/lib/finance/store-summary";
import { getActiveStaffSession } from "@/lib/staff-session";

export const dynamic = "force-dynamic";

const round2 = (value: number) => Math.round(value * 100) / 100;

export const GET = withApiHandler(
  async (request, { userId }) => {
    // Every outlet's revenue and profit is the owner's to see. A PIN persona
    // on the owner's device carries the owner's session, so without this a
    // manager granted /finance for one outlet could read all the others.
    const staffSession = await getActiveStaffSession();
    if (staffSession && staffSession.role !== "OWNER") {
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.FORBIDDEN,
          "The all-outlets report is only available to the business owner."
        ),
        { status: 403 }
      );
    }

    // The caller's OWN business: a linked staff login has none, and so gets
    // the 404 below rather than anyone else's numbers.
    const [business, subscription] = await Promise.all([
      prisma.business.findUnique({
        where: { userId },
        select: {
          name: true,
          stores: { select: { id: true, name: true, image: true }, orderBy: { createdAt: "asc" } },
        },
      }),
      prisma.subscription.findUnique({
        where: { userId },
        select: { plan: true, status: true },
      }),
    ]);

    // Same rule as requirePlan/getStorePlan: anything not ACTIVE is FREE.
    const plan = subscription?.status === "ACTIVE" ? subscription.plan : "FREE";
    if (!planHasFeature(plan, "finance")) {
      const required = minPlanFor("finance");
      return NextResponse.json(
        createErrorResponse(
          ApiErrorCode.SUBSCRIPTION_FEATURE_LOCKED,
          `Finance reports requires the ${PLAN_LABELS[required]} plan.`,
          { feature: "finance", requiredPlan: required, upgradeRequired: true }
        ),
        { status: 403 }
      );
    }

    if (!business) {
      return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "No business found"), {
        status: 404,
      });
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const from = new Date(
      searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    );
    const to = new Date(searchParams.get("to") ?? now.toISOString());
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid date range"),
        { status: 400 }
      );
    }

    const stores = await Promise.all(
      business.stores.map(async (store) => {
        const [summary, pendingOrders] = await Promise.all([
          computeStoreFinanceSummary(store.id, { from, to }),
          // Orders still waiting on payment, whenever they were placed — a
          // follow-up list, not a period figure, so it ignores from/to.
          prisma.order.count({
            where: {
              storeId: store.id,
              paymentStatus: "PENDING",
              status: { notIn: NON_REVENUE_STATUSES },
            },
          }),
        ]);
        return {
          storeId: store.id,
          name: store.name,
          image: store.image,
          currency: summary.currency,
          revenue: round2(summary.revenue),
          orderCount: summary.orderCount,
          pendingOrders,
          cogs: summary.cogs,
          grossProfit: summary.grossProfit,
          grossMarginPct: summary.grossMarginPct,
          wasteLoss: summary.wasteLoss,
          netProfit: summary.netProfit,
        };
      })
    );

    const currencies = [...new Set(stores.map((s) => s.currency))].sort();
    const mixedCurrencies = currencies.length > 1;
    // Biggest earner first — within one currency. Across currencies a raw
    // number compares rupiah with euros, so outlets are grouped by currency.
    stores.sort((a, b) =>
      a.currency === b.currency ? b.revenue - a.revenue : a.currency.localeCompare(b.currency)
    );
    const sum = (pick: (s: (typeof stores)[number]) => number) =>
      round2(stores.reduce((total, s) => total + pick(s), 0));

    const totalRevenue = sum((s) => s.revenue);
    const totalGrossProfit = sum((s) => s.grossProfit);

    return NextResponse.json(
      createSuccessResponse({
        from: from.toISOString(),
        to: to.toISOString(),
        businessName: business.name,
        storeCount: stores.length,
        // Counts add up across currencies; money doesn't.
        totalOrders: stores.reduce((total, s) => total + s.orderCount, 0),
        totalPending: stores.reduce((total, s) => total + s.pendingOrders, 0),
        currency: mixedCurrencies ? null : (currencies[0] ?? null),
        mixedCurrencies,
        currencies,
        totals: mixedCurrencies
          ? null
          : {
              revenue: totalRevenue,
              cogs: sum((s) => s.cogs),
              grossProfit: totalGrossProfit,
              grossMarginPct:
                totalRevenue > 0 ? round2((totalGrossProfit / totalRevenue) * 100) : 0,
              wasteLoss: sum((s) => s.wasteLoss),
              netProfit: sum((s) => s.netProfit),
            },
        stores,
      })
    );
  },
  { rateLimitEndpoint: "/api/owner/summary" }
);
