import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { requirePlan } from "@/lib/auth/require-plan";
import { minPlanFor } from "@/lib/plans/entitlements";
import { getActiveStaffSession } from "@/lib/staff-session";
import { staffPersonaMayReadFinance } from "@/lib/auth/require-finance-access";
import type { Prisma } from "@prisma/client";
import { computeStoreFinanceSummary } from "@/lib/finance/store-summary";
import { loadChannelRows } from "@/lib/finance/channel-report";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import {
  shiftFilter,
  categoryFilter,
  departmentFilter,
  channelFilter,
  paymentMethodFilter,
  parseReportBound,
  UNCATEGORIZED,
} from "@/lib/finance/report-filters";
import {
  bucketItemsByCategory,
  bucketItemsByDepartment,
  bucketOrdersByDay,
  bucketWasteByReason,
  buildItemMarginRows,
  buildShiftRows,
  buildTenderPaymentMethodRows,
} from "@/lib/finance/report-aggregation";
import {
  bucketOrdersByScheduleShift,
  enumerateDateKeys,
  summarizeScheduleShiftCoverage,
} from "@/lib/finance/schedule-shift-bucketing";
import { expenseDateWindow, summarizeExpenses } from "@/lib/finance/expenses";
import { getBusinessDateKey, businessDateKeyToDate } from "@/lib/attendance/business-date";
import { wasteService } from "@/lib/services/waste.service";
import { storefrontService } from "@/lib/services/storefront.service";
import { FinancePrintView } from "@/features/dashboard/finance/components/finance-print-view";

// Deliberately outside the (dashboard) route group — see pos/orders/print's
// page.tsx for the original precedent. Every sub-report re-runs the same
// prisma queries the /finance/* API routes make (reusing their shared
// filter/aggregation helpers) rather than round-tripping through the API,
// matching how attendance/print and schedule/print already work.

export const dynamic = "force-dynamic";

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
  // Outside the (dashboard) group, so Finance's layout gate never runs here —
  // without its own check this printed the full report on any plan.
  await requirePlan(storeId, minPlanFor("finance"));
  await requireStaffPageAccess(storeId, "/finance");
  // Same persona rule as the Finance report routes: another outlet's persona
  // can't print this outlet's P&L.
  const staffSession = await getActiveStaffSession();
  if (staffSession && !staffPersonaMayReadFinance(staffSession, storeId)) {
    redirect(`/store/${staffSession.storeId}/pos`);
  }

  const store = await verifyStoreOwnership(storeId, session.user.id);

  const now = new Date();
  // parseReportBound widens a bare YYYY-MM-DD to the whole day, as the
  // on-screen report does — `new Date(to)` alone dropped the last day.
  const from =
    parseReportBound(firstParam(sp.from), "start") ??
    new Date(now.getFullYear(), now.getMonth(), 1);
  const to = parseReportBound(firstParam(sp.to), "end") ?? now;
  const staffId = firstParam(sp.staffId);
  const categoryId = firstParam(sp.category);
  const department = firstParam(sp.department);
  const channel = firstParam(sp.channel);
  const paymentMethod = firstParam(sp.paymentMethod);

  // The same filters, applied to the same reports, as the screen: a till
  // session arrives as its exact from/to window, staff/channel/payment narrow
  // the orders, and category/department only narrow the item reports.
  const urlParams = new URLSearchParams();
  if (staffId) urlParams.set("staffId", staffId);
  const shiftWhere = shiftFilter(urlParams);
  const channelWhere = channelFilter(channel);
  const paymentWhere = paymentMethodFilter(paymentMethod);
  const orderFilters = { ...shiftWhere, ...channelWhere, ...paymentWhere };
  const revenueOrders: Prisma.OrderWhereInput = {
    storeId,
    status: { notIn: NON_REVENUE_STATUSES },
    orderDate: { gte: from, lte: to },
  };
  const filteredOrders: Prisma.OrderWhereInput = { ...revenueOrders, ...orderFilters };
  const itemWhere: Prisma.OrderItemWhereInput = {
    order: filteredOrders,
    // Combined via AND — both filters can produce their own "OR" clause.
    AND: [categoryFilter(categoryId), departmentFilter(department)],
  };

  const [business, staffMember, categoryRecord, { currency, rate }] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
      select: {
        business: { select: { timezone: true } },
      },
    }),
    staffId
      ? prisma.staffMember.findUnique({ where: { id: staffId }, select: { name: true } })
      : null,
    categoryId && categoryId !== UNCATEGORIZED
      ? prisma.menuCategory.findUnique({ where: { id: categoryId }, select: { name: true } })
      : null,
    storefrontService.getOwnerCurrencyAndRate(storeId),
  ]);
  const timezone = business?.business.timezone ?? "UTC";

  // ─── Summary + daily ───
  // The same computeStoreFinanceSummary the on-screen report and the All
  // outlets roll-up use, so the printed P&L is the one on screen.
  const [summary, dailyOrders] = await Promise.all([
    computeStoreFinanceSummary(storeId, { from, to }, orderFilters),
    prisma.order.findMany({
      where: filteredOrders,
      select: { orderDate: true, total: true, discountAmount: true, tax: true, refundAmount: true },
      orderBy: { orderDate: "asc" },
    }),
  ]);
  const buckets = bucketOrdersByDay(dailyOrders);

  // ─── Channels, payment methods ───
  const [channels, tenderGroups, legacyGroups] = await Promise.all([
    loadChannelRows(storeId, { from, to }, { ...shiftWhere, ...paymentWhere }),
    prisma.orderPayment.groupBy({
      by: ["method"],
      where: { order: { ...revenueOrders, ...shiftWhere, ...channelWhere } },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: { ...revenueOrders, ...shiftWhere, ...channelWhere, payments: { none: {} } },
      _sum: { total: true },
      _count: { id: true },
    }),
  ]);
  const paymentMethods = buildTenderPaymentMethodRows(tenderGroups, legacyGroups);

  // ─── Top items (+ every item, for the remainder line) ───
  const [topItemGroups, itemSums, itemNames] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["name"],
      where: itemWhere,
      _sum: { total: true, quantity: true },
      _count: { id: true },
      orderBy: { _sum: { total: "desc" } },
      take: 20,
    }),
    prisma.orderItem.aggregate({ where: itemWhere, _sum: { total: true, quantity: true } }),
    prisma.orderItem.groupBy({ by: ["name"], where: itemWhere }),
  ]);
  const topItems = topItemGroups.map((item) => ({
    name: item.name,
    orderCount: item._count.id,
    totalQuantity: Number(item._sum.quantity ?? 0),
    totalRevenue: Math.round(Number(item._sum.total ?? 0) * 100) / 100,
  }));
  const topItemsTotals = {
    itemCount: itemNames.length,
    totalQuantity: Math.round(Number(itemSums._sum.quantity ?? 0) * 100) / 100,
    totalRevenue: Math.round(Number(itemSums._sum.total ?? 0) * 100) / 100,
  };

  // ─── Item margin ───
  // unitCostSnapshot/optionCostSnapshot are IDR; convert before combining.
  const marginLines = await prisma.orderItem.findMany({
    where: itemWhere,
    select: {
      name: true,
      quantity: true,
      total: true,
      unitCostSnapshot: true,
      optionCostSnapshot: true,
    },
  });
  const toOwner = (value: unknown) =>
    value != null ? storefrontService.convertBaseToOwnerSync(Number(value), rate) : null;
  const itemMargin = buildItemMarginRows(
    marginLines.map((line) => ({
      name: line.name,
      quantity: Number(line.quantity),
      total: Number(line.total),
      unitCostSnapshot: toOwner(line.unitCostSnapshot),
      optionCostSnapshot: toOwner(line.optionCostSnapshot),
    }))
  );

  // ─── By category / department ───
  const orderItems = await prisma.orderItem.findMany({
    where: { order: filteredOrders },
    select: {
      orderId: true,
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
      orderId: item.orderId,
      total: Number(item.total),
      quantity: Number(item.quantity),
      menuItem: item.menuItem ? { category: item.menuItem.category } : null,
    }))
  );
  const categoryTotals = {
    orderCount: new Set(orderItems.map((item) => item.orderId)).size,
    totalQuantity: Math.round(categories.reduce((sum, c) => sum + c.totalQuantity, 0) * 100) / 100,
    totalRevenue: Math.round(categories.reduce((sum, c) => sum + c.totalRevenue, 0) * 100) / 100,
  };
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
      where: revenueOrders,
      select: { total: true, orderDate: true },
    }),
  ]);
  const fromKey = getBusinessDateKey(from, timezone);
  const toKey = getBusinessDateKey(to, timezone);
  const dateKeys = enumerateDateKeys(fromKey, toKey);
  const scheduleShiftRawRows = bucketOrdersByScheduleShift(
    scheduleOrders,
    scheduleShifts,
    dateKeys,
    timezone
  );
  const scheduleTotals = summarizeScheduleShiftCoverage(
    scheduleOrders,
    scheduleShifts,
    dateKeys,
    timezone
  );
  const rosterRows = await prisma.staffSchedule.findMany({
    where: {
      storeId,
      status: "PUBLISHED",
      date: { gte: businessDateKeyToDate(fromKey), lte: businessDateKeyToDate(toKey) },
      scheduleShiftId: { not: null },
    },
    select: {
      date: true,
      scheduleShiftId: true,
      staffMember: { select: { id: true, name: true } },
    },
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
    reasonLabel: entry.reason === "OTHER" ? (entry.customReason ?? entry.reason) : entry.reason,
    quantity: Number(entry.quantity),
    unit: entry.unit,
    unitCostSnapshot: Number(entry.unitCostSnapshot),
    totalValue: Number(entry.totalValue),
    notes: entry.notes,
  }));

  // ─── Expenses ───
  // Read on its own so a database that hasn't had the expenses migration
  // applied yet still prints the rest of the report.
  // Only on an unfiltered whole-day report, as on screen: expenses are
  // store-wide, so subtracting them from a staff/channel/payment-filtered or
  // till-session net profit would compare unlike with unlike.
  const dateOnly = (value: string | null) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const wholeStoreView =
    !staffId &&
    !channel &&
    !paymentMethod &&
    (firstParam(sp.from) == null || dateOnly(firstParam(sp.from)));
  let expenses: ReturnType<typeof summarizeExpenses> | null = null;
  if (wholeStoreView) {
    try {
      const rows = await prisma.expense.findMany({
        where: { storeId, date: expenseDateWindow(from, to) },
        select: { category: true, amount: true },
      });
      expenses = summarizeExpenses(rows);
    } catch {
      expenses = null;
    }
  }

  return (
    <FinancePrintView
      storeName={store.name}
      currency={currency}
      from={firstParam(sp.from) ?? from.toISOString().slice(0, 10)}
      to={firstParam(sp.to) ?? to.toISOString().slice(0, 10)}
      isExactWindow={!dateOnly(firstParam(sp.from)) && firstParam(sp.from) != null}
      generatedAt={new Date().toISOString()}
      filters={{
        staffLabel: staffMember?.name ?? null,
        categoryId,
        categoryName: categoryRecord?.name ?? null,
        department,
        channel,
        paymentMethod,
      }}
      summary={{ ...summary, buckets }}
      channels={channels}
      paymentMethods={paymentMethods}
      topItems={topItems}
      topItemsTotals={topItemsTotals}
      itemMargin={itemMargin}
      categories={categories}
      categoryTotals={categoryTotals}
      departments={departments}
      customDepartmentLabel={store.customProductsEnabled ? store.customProductsLabel : null}
      shifts={shifts}
      scheduleShiftRows={scheduleShiftRows}
      scheduleTotals={scheduleTotals}
      wasteReasons={wasteReasons}
      wasteEntries={wasteEntries}
      wasteTotals={{ count: wasteList.total, value: wasteList.sumValue }}
      expenses={expenses}
    />
  );
}
