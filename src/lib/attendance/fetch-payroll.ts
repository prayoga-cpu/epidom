import { prisma } from "@/lib/prisma";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { getFinanceSettings } from "@/lib/services/finance-settings.service";
import { addDaysToDateKey, businessLocalToUTC } from "./business-date";
import { fetchHoursReport, type StoreHoursSettings } from "./fetch-hours-report";
import { computeStaffPayroll, roundMoney, type StaffPayroll } from "./payroll";
import type { StaffRole } from "@prisma/client";

export interface StaffPayrollWithName extends StaffPayroll {
  name: string;
  role: StaffRole;
  payRate: number | null;
  overtimeRate: number | null;
}

export interface PayrollReport {
  fromKey: string;
  toKey: string;
  currency: string;
  standardWorkMinutesPerDay: number;
  staff: StaffPayrollWithName[];
  total: number;
}

export interface FetchPayrollParams {
  storeId: string;
  fromKey: string;
  toKey: string;
  /** One staff member only — My Pay, or the Salary tab's staff filter. */
  staffId?: string | null;
  settings: StoreHoursSettings;
  now?: Date;
}

/**
 * The salary report: every non-owner staff member who is active or has
 * attendance in the period, priced by computeStaffPayroll. The owner's own
 * staff row is left out — an owner doesn't pay themselves a wage through here.
 */
export async function fetchPayroll({
  storeId,
  fromKey,
  toKey,
  staffId,
  settings,
  now = new Date(),
}: FetchPayrollParams): Promise<PayrollReport> {
  const [hours, financeSettings] = await Promise.all([
    fetchHoursReport({ storeId, fromKey, toKey, staffId, settings, now }),
    getFinanceSettings(storeId),
  ]);

  const withAttendance = [...new Set(hours.rows.map((row) => row.staffMemberId))];
  const staff = await prisma.staffMember.findMany({
    where: {
      storeId,
      role: { not: "OWNER" },
      ...(staffId ? { id: staffId } : { OR: [{ isActive: true }, { id: { in: withAttendance } }] }),
    },
    select: {
      id: true,
      name: true,
      role: true,
      payType: true,
      payRate: true,
      overtimeRate: true,
      allowances: {
        select: { id: true, name: true, amount: true, basis: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Commission staff only: sales on the till shifts they opened, the same
  // attribution and revenue rule as Finance's by-shift report.
  const salesStaff = staff.filter((s) => s.payType === "SALES");
  const salesByStaff = new Map<string, number>();
  if (salesStaff.length > 0) {
    const rangeStart = businessLocalToUTC(fromKey, "00:00", settings.timeZone);
    const rangeEnd = businessLocalToUTC(addDaysToDateKey(toKey, 1), "00:00", settings.timeZone);
    await Promise.all(
      salesStaff.map(async (s) => {
        const result = await prisma.order.aggregate({
          where: {
            storeId,
            status: { notIn: NON_REVENUE_STATUSES },
            orderDate: { gte: rangeStart, lt: rangeEnd },
            shift: { staffMemberId: s.id },
          },
          _sum: { total: true },
        });
        salesByStaff.set(s.id, Number(result._sum.total ?? 0));
      })
    );
  }

  const rowsByStaff = new Map<string, typeof hours.rows>();
  for (const row of hours.rows) {
    const list = rowsByStaff.get(row.staffMemberId) ?? [];
    list.push(row);
    rowsByStaff.set(row.staffMemberId, list);
  }

  const payroll = staff.map((s): StaffPayrollWithName => {
    const payRate = s.payRate !== null ? Number(s.payRate) : null;
    const overtimeRate = s.overtimeRate !== null ? Number(s.overtimeRate) : null;
    const computed = computeStaffPayroll({
      staff: {
        staffMemberId: s.id,
        payType: s.payType,
        payRate,
        overtimeRate,
        allowances: s.allowances.map((a) => ({
          id: a.id,
          name: a.name,
          amount: Number(a.amount),
          basis: a.basis,
        })),
        attributedSales: salesByStaff.get(s.id) ?? null,
      },
      days: rowsByStaff.get(s.id) ?? [],
      fromKey,
      toKey,
    });
    return { ...computed, name: s.name, role: s.role, payRate, overtimeRate };
  });

  return {
    fromKey,
    toKey,
    currency: financeSettings.currency,
    standardWorkMinutesPerDay: settings.standardWorkMinutesPerDay,
    staff: payroll,
    total: roundMoney(payroll.reduce((sum, p) => sum + p.total, 0)),
  };
}
