import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
      const params = await ctx.params;
      return handler(req, { params, storeId: params.id, userId: "u1" });
    },
}));

const queryRaw = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));

import { GET } from "../route";

const call = () =>
  GET(new Request("http://localhost/api/stores/s1/recipes/demand"), {
    params: Promise.resolve({ id: "s1" }),
  } as never);

beforeEach(() => {
  vi.clearAllMocks();
  queryRaw.mockResolvedValue([]);
});

describe("GET /api/stores/[id]/recipes/demand", () => {
  // Tables are snake_case (@@map) but columns keep Prisma's camelCase names.
  // The query was written with snake_case columns and failed in production
  // with `column rp.product_id does not exist` on every load.
  it("joins on the real, quoted column names", async () => {
    await call();

    const sql = (queryRaw.mock.calls[0][0] as TemplateStringsArray).join("?");
    for (const column of [
      'rp."recipeId"',
      'rp."productId"',
      'p."storeId"',
      'mi."productId"',
      'oi."menuItemId"',
      'oi."orderId"',
      'o."storeId"',
      'o."createdAt"',
    ]) {
      expect(sql).toContain(column);
    }
    // Aliases may be snake_case; a column reference (alias.column) may not.
    expect(sql).not.toMatch(/\b(rp|p|mi|oi|o)\.[a-z]+_[a-z_]+\b/);
  });

  it("scopes both the products and the orders to the store", async () => {
    await call();

    const [, ...values] = queryRaw.mock.calls[0];
    expect(values.filter((v) => v === "s1")).toHaveLength(2);
    expect(values.some((v) => v instanceof Date)).toBe(true);
  });

  it("answers the order count per recipe as a number", async () => {
    queryRaw.mockResolvedValue([{ recipe_id: "r1", order_count: BigInt(12) }]);

    const body = await (await call()).json();

    expect(body.data).toEqual([{ recipeId: "r1", orderCount30d: 12 }]);
  });
});
