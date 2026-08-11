import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { MovementType, type OrderSource } from "@prisma/client";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { shiftFilter, categoryFilter, departmentFilter, UNCATEGORIZED } from "@/lib/finance/report-filters";
import {
  bucketItemsByCategory,
  bucketItemsByDepartment,
  bucketWasteByReason,
  buildShiftRows,
} from "@/lib/finance/report-aggregation";
import { bucketOrdersByScheduleShift, enumerateDateKeys } from "@/lib/finance/schedule-shift-bucketing";
import { getBusinessDateKey, businessDateKeyToDate } from "@/lib/attendance/business-date";
import { commissionRate, AGGREGATOR_LABELS } from "@/config/aggregator.config";
import { wasteService } from "@/lib/services/waste.service";
import { storefrontService } from "@/lib/services/storefront.service";
import { FinancePrintView } from "@/features/dashboard/finance/components/finance-print-view";

// Deliberately outside the (dashboard) route group — see pos/orders/print's
// page.tsx for the original precedent. Every sub-report re-runs the same
// prisma queries the /finance/* API routes make (reusing their shared
// filter/aggregation helpers) rather than round-tripping through the API,
// matching how attendance/print and schedule/print already work.

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<OrderSource, string> = {
  MANUAL: "Manual",
  STOREFRONT: "Storefront",
  POS: "POS Cashier",
  GOFOOD: AGGREGATOR_LABELS.GOFOOD,
  GRABFOOD: AGGREGATOR_LABELS.GRABFOOD,
  SHOPEEFOOD: AGGREGATOR_LABELS.SHOPEEFOOD,
  TOKOPEDIA: AGGREGATOR_LABELS.TOKOPEDIA,
};

function firstParam(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

interface PrintPageProps {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FinancePrintPage({ params, searchParams }: PrintPageProps) {
  const { storeId } = await params;
  const sp = await searchParams;

  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }
  await requireStaffPageAccess(storeId, "/finance");

  const store = await verifyStoreOwnership(storeId, session.user.id);

  const now = new Date();
  const from = new Date(
    firstParam(sp.from) ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  );
  const to = new Date(firstParam(sp.to) ?? now.toISOString());
  const staffId = firstParam(sp.staffId);
  const categoryId = firstParam(sp.category);
  const department = firstParam(sp.department);

  const urlParams = new URLSearchParams();
  if (staffId) urlParams.set("staffId", staffId);
  const shiftWhere = shiftFilter(urlParams);

  const [business, staffMember, categoryRecord, { currency, rate: ownerRate }] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
      select: {
        business: { select: { timezone: true } },
      },
    }),
    staffId ? prisma.staffMember.findUnique({ where: { id: staffId }, select: { name: true } }) : null,
    categoryId && categoryId !== UNCATEGORIZED
      ? prisma.menuCategory.findUnique({ where: { id: categoryId }, select: { name: true } })
      : null,
    storefrontService.getOwnerCurrencyAndRate(storeId),
  ]);
  const timezone = business?.business.timezone ?? "UTC";

  // ─── Summary ───
  const revenueResult = await prisma.order.aggregate({
    where: {
      storeId,
      status: { notIn: NON_REVENUE_STATUSES },
      orderDate: { gte: from, lte: to },
      ...shiftWhere,
    },
    _sum: { total: true, tax: true, serviceCharge: true },
    _count: { id: true },
  });
  const revenue = Number(revenueResult._sum.total ?? 0);
  const orderCount = revenueResult._count.id;
  const taxCollected = Number(revenueResult._sum.tax ?? 0);
  const serviceCharge = Number(revenueResult._sum.serviceCharge ?? 0);

  const processingFeeResult = await prisma.order.aggregate({
    where: {
      storeId,
      status: { notIn: NON_REVENUE_STATUSES },
      paymentStatus: "PAID",
      orderDate: { gte: from, lte: to },
      ...shiftWhere,
    },
    _sum: { processingFee: true },
  });
  const processingFee = Number(processingFeeResult._sum.processingFee ?? 0);

  const cogsMovements = await prisma.stockMovement.findMany({
    where: {
      type: MovementType.SALE,
      order: {
        storeId,
        orderDate: { gte: from, lte: to },
        status: { notIn: NON_REVENUE_STATUSES },
        ...shiftWhere,
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
  // revenue is already literal in the owner's own currency; cogs comes
  // from Material.unitCost, stored in IDR (the platform base currency).
  // Convert before combining, or the result mixes units for any non-IDR
  // store — mirrors the fix in /api/stores/[id]/finance/summary.
  const cogs = storefrontService.convertBaseToOwnerSync(cogsRaw, ownerRate);

  const grossProfit = revenue - cogs;
  const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  const wasteResult = await prisma.wasteEntry.aggregate({
    where: { storeId, createdAt: { gte: from, lte: to } },
    _sum: { totalValue: true },
  });
  const wasteLoss = storefrontService.convertBaseToOwnerSync(
    Number(wasteResult._sum.totalValue ?? 0),
    ownerRate
  );

  const netRevenue = revenue - taxCollected - processingFee;
  const netProfit = netRevenue - cogs - wasteLoss;

  const rawOrders = await prisma.order.findMany({
    where: { storeId, status: { notIn: NON_REVENUE_STATUSES }, orderDate: { gte: from, lte: to }, ...shiftWhere },
    select: { orderDate: true, total: true },
    orderBy: { orderDate: "asc" },
  });
  const bucketMap = new Map<string, number>();
  for (const d of rawOrders) {
    const dateKey = d.orderDate.toISOString().split("T")[0];
    bucketMap.set(dateKey, (bucketMap.get(dateKey) ?? 0) + Number(d.total ?? 0));
  }
  const buckets = Array.from(bucketMap.entries()).map(([date, rev]) => ({ date, revenue: rev }));

  // ─── Channels ───
  const [channelGrouped, channelFeeGrouped] = await Promise.all([
    prisma.order.groupBy({
      by: ["source"],
      where: { storeId, status: { notIn: NON_REVENUE_STATUSES }, orderDate: { gte: from, lte: to }, ...shiftWhere },
      _sum: { total: true, tax: true },
      _count: { id: true },
    }),
    prisma.order.groupBy({
      by: ["source"],
      where: {
        storeId,
        status: { notIn: NON_REVENUE_STATUSES },
        paymentStatus: "PAID",
        orderDate: { gte: from, lte: to },
        ...shiftWhere,
      },
      _sum: { processingFee: true },
    }),
  ]);
  const feeBySource = new Map(channelFeeGrouped.map((g) => [g.source, Number(g._sum.processingFee ?? 0)]));
  const channels = channelGrouped
    .map((g) => {
      const rev = Number(g._sum.total ?? 0);
      const taxAmount = Math.round(Number(g._sum.tax ?? 0) * 100) / 100;
      const processingFeeAmount = Math.round((feeBySource.get(g.source) ?? 0) * 100) / 100;
      const commission = commissionRate(g.source);
      const commissionAmount = Math.round(rev * commission * 100) / 100;
      const netRev = Math.round((rev - commissionAmount - processingFeeAmount - taxAmount) * 100) / 100;
      return {
        source: g.source,
        label: SOURCE_LABELS[g.source] ?? g.source,
        orderCount: g._count.id,
        revenue: Math.round(rev * 100) / 100,
        commissionPct: commission * 100,
        commissionAmount,
        taxAmount,
        processingFeeAmount,
        netRevenue: netRev,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // ─── Top items ───
  const topItemGroups = await prisma.orderItem.groupBy({
    by: ["name"],
    where: {
      order: { storeId, status: { notIn: NON_REVENUE_STATUSES }, orderDate: { gte: from, lte: to }, ...shiftWhere },
      AND: [categoryFilter(categoryId), departmentFilter(department)],
    },
    _sum: { total: true, quantity: true },
    _count: { id: true },
    orderBy: { _sum: { total: "desc" } },
    take: 20,
  });
  const topItems = topItemGroups.map((item) => ({
    name: item.name,
    orderCount: item._count.id,
    totalQuantity: Number(item._sum.quantity ?? 0),
    totalRevenue: Math.round(Number(item._sum.total ?? 0) * 100) / 100,
  }));

  // ─── By category / department ───
  const orderItems = await prisma.orderItem.findMany({
    where: { order: { storeId, status: { notIn: NON_REVENUE_STATUSES }, orderDate: { gte: from, lte: to }, ...shiftWhere } },
    select: {
      total: true,
      quantity: true,
      menuItem: {
        select: {
          category: { select: { id: true, name: true } },
          department: true,
          product: { select: { productLine: true } },
        },
      },
    },
  });
  const categories = bucketItemsByCategory(
    orderItems.map((item) => ({
      total: Number(item.total),
      quantity: Number(item.quantity),
      menuItem: item.menuItem ? { category: item.menuItem.category } : null,
    }))
  );
  const departments = bucketItemsByDepartment(
    orderItems.map((item) => ({
      total: Number(item.total),
      quantity: Number(item.quantity),
      // CUSTOM-productLine items (the optional second product line) get
      // their own real "CUSTOM" bucket instead of their inert stored
      // department — see FEATURES.md/Product.productLine.
      menuItem: !item.menuItem
        ? null
        : {
            department: (item.menuItem.product?.productLine === "CUSTOM"
              ? "CUSTOM"
              : item.menuItem.department) as "KITCHEN" | "BAR" | "CUSTOM",
          },
    }))
  );

  // ─── By shift ───
  const shiftGrouped = await prisma.order.groupBy({
    by: ["shiftId"],
    where: {
      storeId,
      status: { notIn: NON_REVENUE_STATUSES },
      orderDate: { gte: from, lte: to },
      ...(staffId && { shift: { staffMemberId: staffId } }),
    },
    _sum: { total: true },
    _count: { id: true },
  });
  const shiftIds = shiftGrouped.map((g) => g.shiftId).filter((id): id is string => id !== null);
  const shiftLookups = await prisma.shift.findMany({
    where: { id: { in: shiftIds } },
    include: { staffMember: { select: { id: true, name: true, role: true } } },
  });
  const shifts = buildShiftRows(shiftGrouped, shiftLookups);

  // ─── By schedule shift ───
  const [scheduleShifts, scheduleOrders] = await Promise.all([
    prisma.scheduleShift.findMany({
      where: { storeId, isActive: true },
      select: { id: true, name: true, startTime: true, endTime: true, color: true },
    }),
    prisma.order.findMany({
      where: { storeId, status: { notIn: NON_REVENUE_STATUSES }, orderDate: { gte: from, lte: to } },
      select: { total: true, orderDate: true },
    }),
  ]);
  const fromKey = getBusinessDateKey(from, timezone);
  const toKey = getBusinessDateKey(to, timezone);
  const dateKeys = enumerateDateKeys(fromKey, toKey);
  const scheduleShiftRawRows = bucketOrdersByScheduleShift(scheduleOrders, scheduleShifts, dateKeys, timezone);
  const rosterRows = await prisma.staffSchedule.findMany({
    where: {
      storeId,
      status: "PUBLISHED",
      date: { gte: businessDateKeyToDate(fromKey), lte: businessDateKeyToDate(toKey) },
      scheduleShiftId: { not: null },
    },
    select: { date: true, scheduleShiftId: true, staffMember: { select: { id: true, name: true } } },
  });
  const rosterKey = (dateKey: string, scheduleShiftId: string) => `${dateKey}:${scheduleShiftId}`;
  const rosterMap = new Map<string, { staffMemberId: string; name: string }[]>();
  for (const r of rosterRows) {
    if (!r.scheduleShiftId) continue;
    const key = rosterKey(getBusinessDateKey(r.date, timezone), r.scheduleShiftId);
    const list = rosterMap.get(key) ?? [];
    list.push({ staffMemberId: r.staffMember.id, name: r.staffMember.name });
    rosterMap.set(key, list);
  }
  const colorByShiftId = new Map(scheduleShifts.map((s) => [s.id, s.color]));
  const scheduleShiftRows = scheduleShiftRawRows.map((row) => ({
    ...row,
    color: colorByShiftId.get(row.scheduleShiftId) ?? null,
    staffOnDuty: rosterMap.get(rosterKey(row.date, row.scheduleShiftId)) ?? [],
  }));

  // ─── Waste ───
  const wasteEntryRecords = await prisma.wasteEntry.findMany({
    where: { storeId, createdAt: { gte: from, lte: to } },
    select: { reason: true, customReason: true, quantity: true, totalValue: true },
  });
  const wasteReasons = bucketWasteByReason(
    wasteEntryRecords.map((e) => ({
      reason: e.reason,
      customReason: e.customReason,
      quantity: Number(e.quantity),
      totalValue: Number(e.totalValue),
    }))
  );
  const wasteList = await wasteService.listWasteEntries(storeId, {
    from,
    to,
    take: 100,
  });
  const wasteEntries = wasteList.entries.map((entry) => ({
    id: entry.id,
    createdAt: entry.createdAt.toISOString(),
    itemName: entry.material?.name ?? entry.product?.name ?? "—",
    reasonLabel: entry.reason === "OTHER" ? entry.customReason ?? entry.reason : entry.reason,
    quantity: Number(entry.quantity),
    unit: entry.unit,
    unitCostSnapshot: Number(entry.unitCostSnapshot),
    totalValue: Number(entry.totalValue),
    notes: entry.notes,
  }));

  return (
    <FinancePrintView
      storeName={store.name}
      currency={currency}
      from={firstParam(sp.from) ?? from.toISOString().slice(0, 10)}
      to={firstParam(sp.to) ?? to.toISOString().slice(0, 10)}
      generatedAt={new Date().toISOString()}
      filters={{
        staffLabel: staffMember?.name ?? null,
        categoryId,
        categoryName: categoryRecord?.name ?? null,
        department,
      }}
      summary={{
        revenue: Math.round(revenue * 100) / 100,
        cogs: Math.round(cogs * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossMarginPct: Math.round(grossMarginPct * 100) / 100,
        wasteLoss: Math.round(wasteLoss * 100) / 100,
        taxCollected: Math.round(taxCollected * 100) / 100,
        serviceCharge: Math.round(serviceCharge * 100) / 100,
        processingFee: Math.round(processingFee * 100) / 100,
        netRevenue: Math.round(netRevenue * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        orderCount,
        buckets,
      }}
      channels={channels}
      topItems={topItems}
      categories={categories}
      departments={departments}
      customDepartmentLabel={store.customProductsEnabled ? store.customProductsLabel : null}
      shifts={shifts}
      scheduleShiftRows={scheduleShiftRows}
      wasteReasons={wasteReasons}
      wasteEntries={wasteEntries}
    />
  );
}
