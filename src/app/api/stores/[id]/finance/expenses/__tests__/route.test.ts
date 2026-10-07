import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
      const params = await ctx.params;
      return handler(req, { params, storeId: params.id, userId: "u1" });
    },
}));

const prismaMock = vi.hoisted(() => ({
  expense: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const getActiveStaffSession = vi.fn();
vi.mock("@/lib/staff-session", () => ({
  getActiveStaffSession: (...a: unknown[]) => getActiveStaffSession(...a),
}));

const requireManagerOrOwnerApi = vi.fn();
vi.mock("@/lib/auth/require-manager-or-owner", () => ({
  requireManagerOrOwnerApi: (...a: unknown[]) => requireManagerOrOwnerApi(...a),
}));

const requireFinanceReportAccessApi = vi.fn();
vi.mock("@/lib/auth/require-finance-access", () => ({
  requireFinanceReportAccessApi: (...a: unknown[]) => requireFinanceReportAccessApi(...a),
}));

import { GET, POST } from "../route";
import { PATCH, DELETE } from "../[expenseId]/route";

const STORE = "store_abc12345";
const url = (path = "") => `http://localhost/api/stores/${STORE}/finance/expenses${path}`;
const ctx = (extra: Record<string, string> = {}) => ({
  params: Promise.resolve({ id: STORE, ...extra }),
});
const post = (body: unknown) =>
  POST(new Request(url(), { method: "POST", body: JSON.stringify(body) }), ctx());

const RENT = {
  id: "exp_1",
  date: new Date("2026-10-01T00:00:00Z"),
  category: "RENT",
  description: "October rent",
  amount: 1500,
  createdAt: new Date("2026-10-01T09:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  getActiveStaffSession.mockResolvedValue(null);
  requireManagerOrOwnerApi.mockResolvedValue(null);
  requireFinanceReportAccessApi.mockResolvedValue(null);
  prismaMock.expense.findMany.mockResolvedValue([RENT]);
  prismaMock.expense.create.mockResolvedValue(RENT);
  prismaMock.expense.findFirst.mockResolvedValue({ id: "exp_1" });
  prismaMock.expense.update.mockResolvedValue(RENT);
});

describe("GET /finance/expenses", () => {
  it("lists the store's expenses for whole days, with the total and category subtotals", async () => {
    const res = await GET(
      new Request(url("?from=2026-10-01T00:00:00Z&to=2026-10-31T23:59:59Z")),
      ctx()
    );

    expect(res.status).toBe(200);
    expect(prismaMock.expense.findMany.mock.calls[0][0].where).toEqual({
      storeId: STORE,
      date: { gte: new Date("2026-10-01T00:00:00Z"), lte: new Date("2026-10-31T00:00:00Z") },
    });
    const { data } = await res.json();
    expect(data.expenses[0]).toMatchObject({ date: "2026-10-01", amount: 1500 });
    expect(data.total).toBe(1500);
    expect(data.byCategory).toEqual([{ category: "RENT", count: 1, amount: 1500 }]);
  });

  it("follows the Finance report rule", async () => {
    requireFinanceReportAccessApi.mockResolvedValue(
      NextResponse.json({ success: false }, { status: 403 })
    );
    const res = await GET(new Request(url()), ctx());
    expect(res.status).toBe(403);
    expect(prismaMock.expense.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /finance/expenses", () => {
  it("records an expense on this store, dated by calendar day", async () => {
    const res = await post({ date: "2026-10-01", category: "RENT", amount: 1500 });

    expect(res.status).toBe(201);
    expect(prismaMock.expense.create.mock.calls[0][0].data).toEqual({
      storeId: STORE,
      date: new Date("2026-10-01T00:00:00Z"),
      category: "RENT",
      description: null,
      amount: 1500,
    });
  });

  it("refuses a bad amount without writing", async () => {
    const res = await post({ date: "2026-10-01", category: "RENT", amount: -5 });
    expect(res.status).toBe(400);
    expect(prismaMock.expense.create).not.toHaveBeenCalled();
  });

  it("refuses a cashier persona", async () => {
    requireManagerOrOwnerApi.mockResolvedValue(
      NextResponse.json({ success: false }, { status: 403 })
    );
    const res = await post({ date: "2026-10-01", category: "RENT", amount: 1 });
    expect(res.status).toBe(403);
    expect(prismaMock.expense.create).not.toHaveBeenCalled();
  });

  it("refuses a persona signed in to a different store, before any other check", async () => {
    getActiveStaffSession.mockResolvedValue({ storeId: "another_store" });
    const res = await post({ date: "2026-10-01", category: "RENT", amount: 1 });
    expect(res.status).toBe(403);
    expect(requireManagerOrOwnerApi).not.toHaveBeenCalled();
    expect(prismaMock.expense.create).not.toHaveBeenCalled();
  });
});

describe("PATCH / DELETE /finance/expenses/[expenseId]", () => {
  it("only touches an expense that belongs to this store", async () => {
    prismaMock.expense.findFirst.mockResolvedValue(null);

    const patched = await PATCH(
      new Request(url("/exp_other"), { method: "PATCH", body: JSON.stringify({ amount: 10 }) }),
      ctx({ expenseId: "exp_other" })
    );
    const deleted = await DELETE(
      new Request(url("/exp_other"), { method: "DELETE" }),
      ctx({ expenseId: "exp_other" })
    );

    expect(patched.status).toBe(404);
    expect(deleted.status).toBe(404);
    expect(prismaMock.expense.findFirst.mock.calls[0][0].where).toEqual({
      id: "exp_other",
      storeId: STORE,
    });
    expect(prismaMock.expense.update).not.toHaveBeenCalled();
    expect(prismaMock.expense.delete).not.toHaveBeenCalled();
  });

  it("corrects the amount and the day of the store's own expense", async () => {
    const res = await PATCH(
      new Request(url("/exp_1"), {
        method: "PATCH",
        body: JSON.stringify({ amount: 1600, date: "2026-10-02" }),
      }),
      ctx({ expenseId: "exp_1" })
    );
    expect(res.status).toBe(200);
    expect(prismaMock.expense.update.mock.calls[0][0]).toMatchObject({
      where: { id: "exp_1" },
      data: { amount: 1600, date: new Date("2026-10-02T00:00:00Z") },
    });
  });

  it("deletes the store's own expense", async () => {
    const res = await DELETE(
      new Request(url("/exp_1"), { method: "DELETE" }),
      ctx({ expenseId: "exp_1" })
    );
    expect(res.status).toBe(200);
    expect(prismaMock.expense.delete).toHaveBeenCalledWith({ where: { id: "exp_1" } });
  });
});
