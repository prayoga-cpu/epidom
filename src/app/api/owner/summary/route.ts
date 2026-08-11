/**
 * GET /api/owner/summary
 *
 * Aggregates metrics across all stores in the authenticated user's business.
 * Gated to ENTERPRISE plan.
 *
 * Returns per-store revenue + COGS/gross-profit/margin breakdown + rolled-up
 * totals for the given date range. COGS/waste are fetched with one batched
 * query across every store (storeId IN [...]) rather than looping the
 * per-store /finance/summary logic once per store — cheap regardless of how
 * many outlets the business has.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { MovementType } from "@prisma/client";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { planHasFeature } from "@/lib/plans/entitlements";
import { getExchangeRate } from "@/lib/services/exchange-rate.service";
import { storefrontService } from "@/lib/services/storefront.service";
import { getBusinessFinanceSettings } from "@/lib/services/finance-settings.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
      status: 401,
    });
  }

  const userId = session.user.id;

  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  const plan = subscription?.plan ?? "FREE";
  if (!planHasFeature(plan, "finance")) {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.FORBIDDEN, "Owner summary requires ENTERPRISE plan"),
      { status: 403 }
    );
  }

  const business = await prisma.business.findUnique({
    where: { userId },
    include: {
      stores: { select: { id: true, name: true, image: true } },
    },
  });

  if (!business) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "No business found"), {
      status: 404,
    });
  }

  // Order.total (→ revenue) is already a literal value in the business's own
  // currency, but Material.unitCost/WasteEntry.totalValue (→ cogs/wasteLoss)
  // are stored in IDR, the platform base currency. Mixing them in
  // `revenue - cogs` without converting first produces a nonsensical number
  // for any non-IDR business (subtracting IDR-scale cost from e.g. a EUR
  // total) — convert cogs/waste into the business's currency before combining.
  // This rolls up across every store in the business, so the shared
  // business-level currency (BusinessFinanceSettings) is the one source that
  // makes sense here, regardless of any individual store's own override.
  const ownerCurrency = (await getBusinessFinanceSettings(business.id)).currency;
  const ownerRate =
    ownerCurrency === "IDR" ? 1 : (await getExchangeRate("IDR", ownerCurrency)).rate;

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const from = new Date(
    searchParams.get("from") ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  );
  const to = new Date(searchParams.get("to") ?? now.toISOString());
  const storeIds = business.stores.map((s) => s.id);

  // Per-store revenue + pending-payment count in parallel. "Pending" here
  // means paymentStatus PENDING (orders needing a payment follow-up), not
  // OrderStatus — production no longer gates on payment clearing, so there's
  // no order-status value left that means "awaiting confirmation."
  const storeMetricsPromise = Promise.all(
    business.stores.map(async (store) => {
      const [agg, pendingCount] = await Promise.all([
        prisma.order.aggregate({
          where: {
            storeId: store.id,
            status: { notIn: NON_REVENUE_STATUSES },
            orderDate: { gte: from, lte: to },
          },
          _sum: { total: true },
          _count: { id: true },
        }),
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
        revenue: Math.round(Number(agg._sum.total ?? 0) * 100) / 100,
        orderCount: agg._count.id,
        pendingOrders: pendingCount,
      };
    })
  );

  // COGS across every store in one query, bucketed client-side by storeId —
  // the whole point of batching instead of one query per store.
  const cogsMovementsPromise = prisma.stockMovement.findMany({
    where: {
      type: MovementType.SALE,
      materialId: { not: null },
      order: {
        storeId: { in: storeIds },
        orderDate: { gte: from, lte: to },
        status: { notIn: NON_REVENUE_STATUSES },
      },
    },
    select: {
      quantity: true,
      order: { select: { storeId: true } },
      material: { select: { unitCost: true } },
    },
  });

  // Waste loss across every store in one query, same batching principle.
  const wasteEntriesPromise = prisma.wasteEntry.findMany({
    where: { storeId: { in: storeIds }, createdAt: { gte: from, lte: to } },
    select: { storeId: true, totalValue: true },
  });

  const [storeMetrics, cogsMovements, wasteEntries] = await Promise.all([
    storeMetricsPromise,
    cogsMovementsPromise,
    wasteEntriesPromise,
  ]);

  const cogsByStore = new Map<string, number>();
  for (const m of cogsMovements) {
    if (!m.order) continue;
    const qty = Math.abs(Number(m.quantity));
    const cost = Number(m.material?.unitCost ?? 0);
    const storeId = m.order.storeId;
    cogsByStore.set(storeId, (cogsByStore.get(storeId) ?? 0) + qty * cost);
  }

  const wasteByStore = new Map<string, number>();
  for (const w of wasteEntries) {
    wasteByStore.set(w.storeId, (wasteByStore.get(w.storeId) ?? 0) + Number(w.totalValue));
  }

  const enrichedStores = storeMetrics.map((m) => {
    const cogs = storefrontService.convertBaseToOwnerSync(cogsByStore.get(m.storeId) ?? 0, ownerRate);
    const wasteLoss = storefrontService.convertBaseToOwnerSync(
      wasteByStore.get(m.storeId) ?? 0,
      ownerRate
    );
    const grossProfit = Math.round((m.revenue - cogs) * 100) / 100;
    const grossMarginPct = m.revenue > 0 ? Math.round((grossProfit / m.revenue) * 1000) / 10 : 0;
    const netProfit = Math.round((grossProfit - wasteLoss) * 100) / 100;
    return { ...m, cogs, grossProfit, grossMarginPct, wasteLoss, netProfit };
  });

  const totalRevenue = enrichedStores.reduce((s, m) => s + m.revenue, 0);
  const totalOrders = enrichedStores.reduce((s, m) => s + m.orderCount, 0);
  const totalPending = enrichedStores.reduce((s, m) => s + m.pendingOrders, 0);
  const totalCogs = enrichedStores.reduce((s, m) => s + m.cogs, 0);
  const totalGrossProfit = enrichedStores.reduce((s, m) => s + m.grossProfit, 0);
  const totalWasteLoss = enrichedStores.reduce((s, m) => s + m.wasteLoss, 0);
  const totalNetProfit = enrichedStores.reduce((s, m) => s + m.netProfit, 0);

  enrichedStores.sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json(
    createSuccessResponse({
      from: from.toISOString(),
      to: to.toISOString(),
      businessName: business.name,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      totalPending,
      totalCogs: Math.round(totalCogs * 100) / 100,
      totalGrossProfit: Math.round(totalGrossProfit * 100) / 100,
      totalGrossMarginPct:
        totalRevenue > 0 ? Math.round((totalGrossProfit / totalRevenue) * 1000) / 10 : 0,
      totalWasteLoss: Math.round(totalWasteLoss * 100) / 100,
      totalNetProfit: Math.round(totalNetProfit * 100) / 100,
      storeCount: business.stores.length,
      stores: enrichedStores,
    })
  );
}
