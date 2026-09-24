import { describe, it, expect, vi, beforeEach } from "vitest";

// Pass-through withApiHandler that still maps thrown errors the way the real one
// does, so a ZodError is asserted as the 400 the client would see.
vi.mock("@/lib/api-handler", async () => {
  const { handleApiError } = await import("@/lib/utils/api-error-handler");
  return {
    withApiHandler:
      (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
      async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
        const params = await ctx.params;
        try {
          return await handler(req, { params, storeId: params.id, userId: "u1" });
        } catch (error) {
          return handleApiError(error, { endpoint: "test" });
        }
      },
  };
});
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const db = vi.hoisted(() => ({
  materialFindFirst: vi.fn(),
  productFindFirst: vi.fn(),
  movementFindMany: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    material: { findFirst: db.materialFindFirst },
    product: { findFirst: db.productFindFirst },
    stockMovement: { findMany: db.movementFindMany },
  },
}));

import { GET } from "../route";

const STORE = "cstore0000000000000000001";
const MATERIAL = "cmat00000000000000000001a";
const PRODUCT = "cprod0000000000000000001a";
const STORE_SCOPE = { OR: [{ material: { storeId: STORE } }, { product: { storeId: STORE } }] };

const get = (query = "") =>
  GET(new Request(`http://localhost/api/stores/${STORE}/stock-movements${query}`), {
    params: Promise.resolve({ id: STORE }),
  } as never);

/** The `where` of the one findMany call. */
const whereOf = () => db.movementFindMany.mock.calls[0][0].where;

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `cmove00000000000000000${String(i).padStart(3, "0")}`,
  }));

beforeEach(() => {
  vi.clearAllMocks();
  db.movementFindMany.mockResolvedValue([]);
  db.materialFindFirst.mockResolvedValue({ id: MATERIAL });
  db.productFindFirst.mockResolvedValue({ id: PRODUCT });
});

describe("GET /stock-movements — every query stays inside the store", () => {
  it("scopes the store-wide Log to the store", async () => {
    const res = await get();

    expect(res.status).toBe(200);
    expect(whereOf()).toEqual({ AND: [STORE_SCOPE] });
  });

  it("keeps the store scope when an item id comes without its itemType", async () => {
    await get(`?materialId=${MATERIAL}`);

    expect(db.materialFindFirst).toHaveBeenCalledWith({
      where: { id: MATERIAL, storeId: STORE },
      select: { id: true },
    });
    expect(whereOf()).toEqual({ AND: [STORE_SCOPE, { materialId: MATERIAL }] });
  });

  it("answers 404 for another store's product, and reads nothing", async () => {
    db.productFindFirst.mockResolvedValue(null);

    const res = await get(`?productId=${PRODUCT}&itemType=material`);

    expect(res.status).toBe(404);
    expect(db.movementFindMany).not.toHaveBeenCalled();
  });

  it("rejects an unknown movement type with a 400", async () => {
    const res = await get("?type=NOT_A_TYPE");

    expect(res.status).toBe(400);
    expect(db.movementFindMany).not.toHaveBeenCalled();
  });
});

describe("GET /stock-movements — paging, search and order", () => {
  it("returns a cursor when there is another page", async () => {
    db.movementFindMany.mockResolvedValue(rows(3));

    const res = await get("?take=2");
    const body = await res.json();

    expect(db.movementFindMany.mock.calls[0][0].take).toBe(3);
    expect(body.data.movements).toHaveLength(2);
    expect(body.data.nextCursor).toBe(rows(3)[1].id);
  });

  it("returns no cursor on the last page", async () => {
    db.movementFindMany.mockResolvedValue(rows(2));

    const body = await (await get("?take=2")).json();

    expect(body.data.movements).toHaveLength(2);
    expect(body.data.nextCursor).toBeNull();
  });

  it("continues after the cursor, in the order asked for", async () => {
    const cursor = rows(1)[0].id;

    await get(`?cursor=${cursor}&order=asc`);

    const args = db.movementFindMany.mock.calls[0][0];
    expect(args.cursor).toEqual({ id: cursor });
    expect(args.skip).toBe(1);
    expect(args.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
  });

  it("searches item names on the server, inside the store", async () => {
    await get("?q=farine");

    expect(whereOf()).toEqual({
      AND: [
        STORE_SCOPE,
        {
          OR: [
            { material: { name: { contains: "farine", mode: "insensitive" } } },
            { product: { name: { contains: "farine", mode: "insensitive" } } },
          ],
        },
      ],
    });
  });
});
