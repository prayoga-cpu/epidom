/**
 * GET /api/stores/[id]/finance/summary
 *
 * Returns revenue, COGS, and gross margin for a date range.
 *
 * Query params:
 *   from  — ISO date (default: start of current month)
 *   to    — ISO date (default: now)
 *   period — "day" | "week" | "month" (groups result buckets)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSuccessResponse, createErrorResponse, ApiErrorCode } from "@/types/api/responses";
import { withApiHandler } from "@/lib/api-handler";
import { MovementType } from "@prisma/client";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { shiftFilter, channelFilter, paymentMethodFilter } from "@/lib/finance/report-filters";
import { storefrontService } from "@/lib/services/storefront.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async (request, { storeId }) => {
    const { searchParams } = new URL(request.url);

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1); // start of month
    const from = new Date(searchParams.get("from") ?? defaultFrom.toISOString());
    const to = new Date(searchParams.get("to") ?? now.toISOString());
    const shiftWhere = shiftFilter(searchParams);
    const channelWhere = channelFilter(searchParams.get("channel"));
    const paymentWhere = paymentMethodFilter(searchParams.get("paymentMethod"));

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json(
        createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid date range"),
        { status: 400 }
      );
    }

    // Revenue: sum of completed order totals
    const revenueResult = await prisma.order.aggregate({
      where: {
        storeId,
        status: { notIn: NON_REVENUE_STATUSES },
        orderDate: { gte: from, lte: to },
        ...shiftWhere,
        ...channelWhere,
        ...paymentWhere,
      },
      _sum: {
        total: true,
        subtotal: true,
        tax: true,
        serviceCharge: true,
        discountAmount: true,
        refundAmount: true,
      },
      _count: { id: true },
    });

    // `total` is already post-discount (computeOrderCharges applies the
    // discount before subtotal/tax/total are derived) — grossRevenue backs
    // the pre-discount figure out for the P&L statement view, it is not an
    // independent sum.
    const revenue = Number(revenueResult._sum.total ?? 0);
    const orderCount = revenueResult._count.id;
    const taxCollected = Number(revenueResult._sum.tax ?? 0);
    const serviceCharge = Number(revenueResult._sum.serviceCharge ?? 0);
    const discountAmount = Number(revenueResult._sum.discountAmount ?? 0);
    const refundAmount = Number(revenueResult._sum.refundAmount ?? 0);
    const grossRevenue = revenue + discountAmount;

    // Processing fee only accrues on orders that actually got charged —
    // an abandoned/unpaid QRIS order never incurred a fee.
    const processingFeeResult = await prisma.order.aggregate({
      where: {
        storeId,
        status: { notIn: NON_REVENUE_STATUSES },
        paymentStatus: "PAID",
        orderDate: { gte: from, lte: to },
        ...shiftWhere,
        ...channelWhere,
        ...paymentWhere,
      },
      _sum: { processingFee: true },
    });
    const processingFee = Number(processingFeeResult._sum.processingFee ?? 0);

    // COGS: sum of SALE stock movements (negative qty = cost)
    // balanceAfter is not cost; use qty * material.unitCost via joining
    const cogsMovements = await prisma.stockMovement.findMany({
      where: {
        type: MovementType.SALE,
        order: {
          storeId,
          orderDate: { gte: from, lte: to },
          status: { notIn: NON_REVENUE_STATUSES },
          ...shiftWhere,
          ...channelWhere,
          ...paymentWhere,
        },
        materialId: { not: null },
      },
      include: { material: { select: { unitCost: true } } },
    });

    const cogsRaw = cogsMovements.reduce((sum, m) => {
      const qty = Math.abs(Number(m.quantity));
      const cost = Number(m.material?.unitCost ?? 0);
      return sum + qty * cost;
    }, 0);

    // revenue (and everything derived from Order.total) is already a
    // literal value in the owner's own currency; cogs comes from
    // Material.unitCost, stored in IDR (the platform base currency).
    // Mixing them in `revenue - cogs` without converting first produces a
    // nonsensical figure for any non-IDR store — convert cogs (and waste
    // loss, below) into the owner's currency before combining with revenue.
    const { rate: ownerRate } = await storefrontService.getOwnerCurrencyAndRate(storeId!);
    const cogs = storefrontService.convertBaseToOwnerSync(cogsRaw, ownerRate);

    const grossProfit = revenue - cogs;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    // Waste loss (expired/damaged/spoiled/... inventory): shrinkage, not
    // cost-of-goods-sold for items that actually sold, so it's kept out of
    // cogs/grossProfit and only reduces the netProfit bottom line. Note: not
    // scoped by shiftWhere — WasteEntry has no shift/order linkage (v1).
    const wasteResult = await prisma.wasteEntry.aggregate({
      where: { storeId, createdAt: { gte: from, lte: to } },
      _sum: { totalValue: true },
    });
    const wasteLoss = storefrontService.convertBaseToOwnerSync(
      Number(wasteResult._sum.totalValue ?? 0),
      ownerRate
    );

    // netRevenue excludes tax (it's the government's, not the business's),
    // the payment-processing fee (the provider's cut), and any refunds
    // issued (money that left the business). netProfit further subtracts
    // COGS and waste loss. See src/lib/finance/order-charges.ts for how
    // discount/tax/fee amounts are computed and frozen onto each order, and
    // src/lib/finance/order-charges.ts's computeRefund for refunds. Refunds
    // are attributed to the original order's orderDate (accrual-style, not
    // the later refundedAt) — simplest and matches how every other figure
    // here is already scoped to the queried range.
    const netRevenue = revenue - refundAmount - taxCollected - processingFee;
    const netProfit = netRevenue - cogs - wasteLoss;

    // Daily breakdown for chart using memory grouping to avoid Prisma groupBy timezone/timestamp issues
    const rawOrders = await prisma.order.findMany({
      where: {
        storeId,
        status: { notIn: NON_REVENUE_STATUSES },
        orderDate: { gte: from, lte: to },
        ...shiftWhere,
        ...channelWhere,
        ...paymentWhere,
      },
      select: { orderDate: true, total: true },
      orderBy: { orderDate: "asc" },
    });

    const bucketMap = new Map<string, number>();
    for (const d of rawOrders) {
      const dateKey = d.orderDate.toISOString().split("T")[0];
      const current = bucketMap.get(dateKey) ?? 0;
      bucketMap.set(dateKey, current + Number(d.total ?? 0));
    }

    const buckets = Array.from(bucketMap.entries()).map(([date, revenue]) => ({
      date,
      revenue,
    }));

    return NextResponse.json(
      createSuccessResponse({
        from: from.toISOString(),
        to: to.toISOString(),
        revenue,
        grossRevenue: Math.round(grossRevenue * 100) / 100,
        discountAmount: Math.round(discountAmount * 100) / 100,
        refundAmount: Math.round(refundAmount * 100) / 100,
        cogs: Math.round(cogs * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossMarginPct: Math.round(grossMargin * 100) / 100,
        wasteLoss: Math.round(wasteLoss * 100) / 100,
        taxCollected: Math.round(taxCollected * 100) / 100,
        serviceCharge: Math.round(serviceCharge * 100) / 100,
        processingFee: Math.round(processingFee * 100) / 100,
        netRevenue: Math.round(netRevenue * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        orderCount,
        buckets,
      })
    );
  },
  { rateLimitEndpoint: "/api/stores/[id]/finance/summary", requireStoreAuth: true }
);
