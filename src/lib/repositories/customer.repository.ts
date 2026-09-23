import { Prisma, type Customer, type LoyaltyEntry } from "@prisma/client";
import { BaseRepository } from "./base.repository";
import { NON_REVENUE_STATUSES } from "@/lib/constants/order-status";
import { phoneSearchDigits } from "@/lib/utils/phone";
import type { CustomerSort } from "@/lib/validation/customers.schemas";

/**
 * Customer Repository
 *
 * Data access for the Customer table and its loyalty ledger. Every query is
 * scoped to `storeId` — a customer id alone never crosses tenants.
 *
 * Lifetime spend / order count / last visit are NOT columns: Order is an
 * immutable ledger, and a cached total silently drifts the moment an order is
 * refunded or cancelled. They are aggregated from Order for exactly the page of
 * customers being returned (aggregateOrders) and never stored.
 */

export interface CustomerOrderAggregate {
  lifetimeSpend: number;
  orderCount: number;
  lastOrderAt: Date | null;
}

export const EMPTY_AGGREGATE: CustomerOrderAggregate = {
  lifetimeSpend: 0,
  orderCount: 0,
  lastOrderAt: null,
};

export interface CustomerPageQuery {
  q?: string;
  limit: number;
  cursor?: string;
  sort: CustomerSort;
}

export interface CustomerPage {
  customers: Customer[];
  nextCursor: string | null;
  totalCount: number;
}

export interface CustomerSummaryCounts {
  members: number;
  nonMembers: number;
  pointsRedeemedTotal: number;
}

export type PointsAdjustOutcome =
  | { kind: "ok"; customer: Customer }
  | { kind: "not_found" }
  | { kind: "insufficient"; balance: number };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Stable total order: every sort ends in `id` so a cursor never skips or repeats a row. */
export function orderByFor(sort: CustomerSort): Prisma.CustomerOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ createdAt: "desc" }, { id: "desc" }];
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "points":
      return [{ points: "desc" }, { name: "asc" }, { id: "asc" }];
    case "name":
    default:
      return [{ name: "asc" }, { id: "asc" }];
  }
}

export function buildCustomerWhere(storeId: string, q?: string): Prisma.CustomerWhereInput {
  const term = q?.trim();
  if (!term) return { storeId };

  const or: Prisma.CustomerWhereInput[] = [
    { name: { contains: term, mode: "insensitive" } },
    { phone: { contains: term } },
    { email: { contains: term, mode: "insensitive" } },
  ];
  // The stored phone is E.164 but people type national numbers — see phoneSearchDigits.
  const digits = phoneSearchDigits(term);
  if (digits && digits !== term) or.push({ phone: { contains: digits } });

  return { storeId, OR: or };
}

export class CustomerRepository extends BaseRepository {
  async findPage(storeId: string, query: CustomerPageQuery): Promise<CustomerPage> {
    const where = buildCustomerWhere(storeId, query.q);

    const [rows, totalCount] = await Promise.all([
      this.db.customer.findMany({
        where,
        orderBy: orderByFor(query.sort),
        // One extra row tells us whether there is a next page without a second query.
        take: query.limit + 1,
        ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      }),
      this.db.customer.count({ where }),
    ]);

    const hasMore = rows.length > query.limit;
    const customers = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      customers,
      nextCursor: hasMore ? customers[customers.length - 1].id : null,
      totalCount,
    };
  }

  /**
   * Σ (total − refundAmount), order count and latest order date per customer,
   * over REVENUE orders only (NON_REVENUE_STATUSES — cancelled and held — are
   * excluded, same rule as customers/analytics and every finance report).
   * One grouped query for the whole page, not one per row.
   */
  async aggregateOrders(
    storeId: string,
    customerIds: string[]
  ): Promise<Map<string, CustomerOrderAggregate>> {
    const result = new Map<string, CustomerOrderAggregate>();
    if (customerIds.length === 0) return result;

    const groups = await this.db.order.groupBy({
      by: ["customerId"],
      where: {
        storeId,
        customerId: { in: customerIds },
        status: { notIn: NON_REVENUE_STATUSES },
      },
      _sum: { total: true, refundAmount: true },
      _count: { _all: true },
      _max: { orderDate: true },
    });

    for (const g of groups) {
      if (!g.customerId) continue;
      result.set(g.customerId, {
        lifetimeSpend: round2(Number(g._sum.total ?? 0) - Number(g._sum.refundAmount ?? 0)),
        orderCount: g._count._all,
        lastOrderAt: g._max.orderDate ?? null,
      });
    }
    return result;
  }

  /** Store-wide tiles — independent of any search the list is showing. */
  async summary(storeId: string): Promise<CustomerSummaryCounts> {
    const [members, total, redeemed] = await Promise.all([
      this.db.customer.count({ where: { storeId, memberSince: { not: null } } }),
      this.db.customer.count({ where: { storeId } }),
      this.db.loyaltyEntry.aggregate({
        where: { type: "REDEEM", customer: { storeId } },
        _sum: { points: true },
      }),
    ]);

    return {
      members,
      nonMembers: Math.max(total - members, 0),
      // REDEEM entries are stored negative; the tile shows how many were spent.
      pointsRedeemedTotal: Math.abs(redeemed._sum.points ?? 0),
    };
  }

  async findById(storeId: string, customerId: string): Promise<Customer | null> {
    return this.db.customer.findFirst({ where: { id: customerId, storeId } });
  }

  async findByPhone(storeId: string, phone: string, excludeId?: string): Promise<Customer | null> {
    return this.db.customer.findFirst({
      where: { storeId, phone, ...(excludeId && { id: { not: excludeId } }) },
    });
  }

  async create(data: Prisma.CustomerUncheckedCreateInput): Promise<Customer> {
    return this.db.customer.create({ data });
  }

  async update(customerId: string, data: Prisma.CustomerUncheckedUpdateInput): Promise<Customer> {
    return this.db.customer.update({ where: { id: customerId }, data });
  }

  async recentOrders(storeId: string, customerId: string, take: number) {
    return this.db.order.findMany({
      where: { storeId, customerId },
      orderBy: { orderDate: "desc" },
      take,
      select: { id: true, orderNumber: true, orderDate: true, total: true, status: true },
    });
  }

  async recentLoyaltyEntries(customerId: string, take: number): Promise<LoyaltyEntry[]> {
    return this.db.loyaltyEntry.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  /**
   * Apply a manual points adjustment and write its ledger row in ONE
   * transaction, so Customer.points and the LoyaltyEntry sum can never
   * disagree.
   *
   * The balance floor lives in the UPDATE itself (`points >= -delta` for a
   * deduction) rather than in a read-then-write: a redemption at the till can
   * land between the two, and a check done on a stale read would push the
   * balance below zero. When no row matches, nothing is written.
   *
   * A positive adjustment also stamps `memberSince` the first time — a
   * customer who has been GIVEN points holds a balance and counts as a loyalty
   * member exactly as one who earned them.
   */
  async adjustPoints(
    storeId: string,
    customerId: string,
    delta: number,
    note: string
  ): Promise<PointsAdjustOutcome> {
    return this.db.$transaction(async (tx) => {
      const current = await tx.customer.findFirst({
        where: { id: customerId, storeId },
        select: { id: true, points: true, memberSince: true },
      });
      if (!current) return { kind: "not_found" } as const;

      const applied = await tx.customer.updateMany({
        where: {
          id: customerId,
          storeId,
          ...(delta < 0 && { points: { gte: -delta } }),
        },
        data: {
          points: { increment: delta },
          ...(delta > 0 && current.memberSince == null && { memberSince: new Date() }),
        },
      });
      if (applied.count === 0) {
        return { kind: "insufficient", balance: current.points } as const;
      }

      await tx.loyaltyEntry.create({
        data: { customerId, type: "ADJUST", points: delta, note },
      });

      const customer = await tx.customer.findFirst({ where: { id: customerId, storeId } });
      // The row cannot vanish inside the transaction; the null branch only
      // satisfies the type.
      if (!customer) return { kind: "not_found" } as const;
      return { kind: "ok", customer } as const;
    });
  }
}

export const customerRepository = new CustomerRepository();
