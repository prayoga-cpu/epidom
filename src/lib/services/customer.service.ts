import { Prisma, type Customer, type LoyaltyEntry } from "@prisma/client";
import {
  customerRepository,
  CustomerRepository,
  EMPTY_AGGREGATE,
  type CustomerOrderAggregate,
} from "@/lib/repositories/customer.repository";
import { NotFoundError } from "@/lib/errors";
import { FieldConflictError, FieldError } from "@/lib/errors/field-error";
import { arrayToCSV } from "@/lib/utils/csv-export";
import { callingCodeForCurrency, normalizePhone } from "@/lib/utils/phone";
import { getFinanceSettings } from "@/lib/services/finance-settings.service";
import type {
  AdjustPointsInput,
  CreateCustomerInput,
  CustomerListQuery,
  UpdateCustomerInput,
} from "@/lib/validation/customers.schemas";
import type {
  CustomerDetailDto,
  CustomerListDto,
  CustomerRowDto,
  LoyaltyEntryDto,
} from "@/types/api/cashier";

/**
 * Customer Service
 *
 * Business rules for the Customer table: phone canonicalisation, one customer
 * per phone per store, computed (never cached) spend figures, and the manual
 * loyalty-points adjustment. Money on the DTOs is literal in the store's
 * display currency — Order.total is stored that way, so nothing here converts.
 */

const DETAIL_ORDERS = 20;
const DETAIL_LEDGER = 30;
/** Export walks the table in pages of this size... */
const EXPORT_PAGE = 500;
/** ...and stops here, so one request can never stream an unbounded table. */
const EXPORT_MAX_ROWS = 10_000;

export function toCustomerRowDto(
  customer: Customer,
  aggregate: CustomerOrderAggregate = EMPTY_AGGREGATE
): CustomerRowDto {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    notes: customer.notes,
    points: customer.points,
    memberSince: customer.memberSince ? customer.memberSince.toISOString() : null,
    createdAt: customer.createdAt.toISOString(),
    lifetimeSpend: aggregate.lifetimeSpend,
    orderCount: aggregate.orderCount,
    lastOrderAt: aggregate.lastOrderAt ? aggregate.lastOrderAt.toISOString() : null,
  };
}

function toLoyaltyEntryDto(entry: LoyaltyEntry): LoyaltyEntryDto {
  return {
    id: entry.id,
    type: entry.type,
    points: entry.points,
    note: entry.note,
    orderId: entry.orderId,
    createdAt: entry.createdAt.toISOString(),
  };
}

/**
 * Free-text cells a cashier typed can start with "=", "+", "-" or "@", which a
 * spreadsheet then evaluates as a formula. A leading apostrophe makes it text.
 * Not applied to the phone column: an E.164 number legitimately starts with "+".
 */
export function neutralizeSpreadsheetFormula(value: string | null | undefined): string {
  if (!value) return "";
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export class CustomerService {
  constructor(private readonly repo: CustomerRepository = customerRepository) {}

  /**
   * Canonical E.164 for a typed phone, or a field error the form can show under
   * the input. The store's default country calling code is only looked up when
   * the number was typed WITHOUT its own "+<country>" prefix.
   */
  private async resolvePhone(storeId: string, raw: string): Promise<string> {
    let normalized = normalizePhone(raw);
    if (!normalized && !/^\s*(\+|00)/.test(raw)) {
      let defaultCallingCode: string | undefined;
      try {
        defaultCallingCode = callingCodeForCurrency((await getFinanceSettings(storeId)).currency);
      } catch {
        // No resolvable currency: only a fully international number can pass.
      }
      normalized = normalizePhone(raw, { defaultCallingCode });
    }
    if (!normalized) {
      throw new FieldError(
        "phone",
        "Enter a valid phone number, including the country code (e.g. +33 6 12 34 56 78)"
      );
    }
    return normalized;
  }

  private async assertPhoneFree(storeId: string, phone: string, excludeId?: string) {
    const existing = await this.repo.findByPhone(storeId, phone, excludeId);
    if (existing) {
      throw new FieldConflictError(
        "phone",
        `A customer with this phone number already exists (${existing.name})`
      );
    }
  }

  async list(storeId: string, query: CustomerListQuery): Promise<CustomerListDto> {
    const [page, summary] = await Promise.all([
      this.repo.findPage(storeId, query),
      query.includeSummary ? this.repo.summary(storeId) : Promise.resolve(undefined),
    ]);
    const aggregates = await this.repo.aggregateOrders(
      storeId,
      page.customers.map((c) => c.id)
    );

    return {
      customers: page.customers.map((c) => toCustomerRowDto(c, aggregates.get(c.id))),
      nextCursor: page.nextCursor,
      totalCount: page.totalCount,
      ...(summary && { summary }),
    };
  }

  async create(storeId: string, input: CreateCustomerInput): Promise<CustomerRowDto> {
    const phone = input.phone ? await this.resolvePhone(storeId, input.phone) : null;
    if (phone) await this.assertPhoneFree(storeId, phone);

    // The schema guarantees a name or a phone. A nameless customer is recorded
    // under their number — the owner can rename them in Back Office later.
    const name = input.name ?? phone;
    if (!name) throw new FieldError("name", "Enter a name or a phone number");

    try {
      const created = await this.repo.create({
        storeId,
        name,
        phone,
        email: input.email ?? null,
        notes: input.notes ?? null,
      });
      return toCustomerRowDto(created);
    } catch (error) {
      // Two tills adding the same number at once both pass the pre-check; the
      // unique index is the real guard, and its violation is the same 409.
      if (isUniqueViolation(error)) {
        throw new FieldConflictError("phone", "A customer with this phone number already exists");
      }
      throw error;
    }
  }

  async getDetail(storeId: string, customerId: string): Promise<CustomerDetailDto> {
    const customer = await this.repo.findById(storeId, customerId);
    if (!customer) throw new NotFoundError("Customer");

    const [aggregates, orders, entries] = await Promise.all([
      this.repo.aggregateOrders(storeId, [customer.id]),
      this.repo.recentOrders(storeId, customer.id, DETAIL_ORDERS),
      this.repo.recentLoyaltyEntries(customer.id, DETAIL_LEDGER),
    ]);

    return {
      ...toCustomerRowDto(customer, aggregates.get(customer.id)),
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        orderDate: o.orderDate.toISOString(),
        total: Number(o.total),
        status: o.status,
      })),
      loyaltyEntries: entries.map(toLoyaltyEntryDto),
    };
  }

  async update(
    storeId: string,
    customerId: string,
    input: UpdateCustomerInput
  ): Promise<CustomerDetailDto> {
    const existing = await this.repo.findById(storeId, customerId);
    if (!existing) throw new NotFoundError("Customer");

    const data: Prisma.CustomerUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.email !== undefined) data.email = input.email;
    if (input.notes !== undefined) data.notes = input.notes;

    if (input.phone !== undefined) {
      if (input.phone === null) {
        data.phone = null;
      } else {
        const phone = await this.resolvePhone(storeId, input.phone);
        if (phone !== existing.phone) await this.assertPhoneFree(storeId, phone, customerId);
        data.phone = phone;
      }
    }

    try {
      await this.repo.update(customerId, data);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new FieldConflictError("phone", "A customer with this phone number already exists");
      }
      throw error;
    }
    return this.getDetail(storeId, customerId);
  }

  async adjustPoints(
    storeId: string,
    customerId: string,
    input: AdjustPointsInput
  ): Promise<CustomerRowDto> {
    const outcome = await this.repo.adjustPoints(storeId, customerId, input.points, input.note);

    if (outcome.kind === "not_found") throw new NotFoundError("Customer");
    if (outcome.kind === "insufficient") {
      // A 400 pinned to the points input — the dialog shows it under the field.
      throw new FieldError(
        "points",
        `This customer only has ${outcome.balance} point${outcome.balance === 1 ? "" : "s"}, so ${-input.points} can't be removed`
      );
    }

    const aggregates = await this.repo.aggregateOrders(storeId, [customerId]);
    return toCustomerRowDto(outcome.customer, aggregates.get(customerId));
  }

  /**
   * CSV of the customers matching `q`. Headers are English like every other
   * export in the app. lifetimeSpend is in the store's display currency.
   */
  async exportCsv(storeId: string, q?: string): Promise<string> {
    const rows: CustomerRowDto[] = [];
    let cursor: string | undefined;

    while (rows.length < EXPORT_MAX_ROWS) {
      const page = await this.repo.findPage(storeId, {
        q,
        limit: EXPORT_PAGE,
        cursor,
        sort: "name",
      });
      const aggregates = await this.repo.aggregateOrders(
        storeId,
        page.customers.map((c) => c.id)
      );
      for (const c of page.customers) rows.push(toCustomerRowDto(c, aggregates.get(c.id)));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }

    const headers = [
      "Name",
      "Phone",
      "Email",
      "Notes",
      "Customer since",
      "Member since",
      "Points",
      "Lifetime spend",
      "Orders",
      "Last visit",
    ];
    const columns: Array<(c: CustomerRowDto) => unknown> = [
      (c) => neutralizeSpreadsheetFormula(c.name),
      (c) => c.phone ?? "",
      (c) => neutralizeSpreadsheetFormula(c.email),
      (c) => neutralizeSpreadsheetFormula(c.notes),
      (c) => c.createdAt,
      (c) => c.memberSince ?? "",
      (c) => c.points,
      (c) => c.lifetimeSpend.toFixed(2),
      (c) => c.orderCount,
      (c) => c.lastOrderAt ?? "",
    ];
    return arrayToCSV(rows, headers, columns);
  }
}

export const customerService = new CustomerService();
