import { describe, it, expect, vi, beforeEach } from "vitest";

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

const productService = vi.hoisted(() => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  getProducts: vi.fn(),
  getProductById: vi.fn(),
}));
vi.mock("@/lib/services/product.service", () => ({ productService }));
vi.mock("@/lib/services", () => ({
  subscriptionService: {
    canCreateProduct: vi.fn().mockResolvedValue({ allowed: true, limit: 500, current: 1 }),
  },
}));
vi.mock("@/lib/server/serialize", () => ({
  serializeProduct: (p: unknown) => p,
  serializeProducts: (p: unknown) => p,
}));

import { POST } from "../route";
import { PATCH } from "../[productId]/route";
import { FieldConflictError } from "@/lib/errors/field-error";

const STORE = "clz1234567890abcdefghijkl";
const ctx = (extra: Record<string, string> = {}) => ({
  params: Promise.resolve({ id: STORE, ...extra }),
});
const send = (method: string, body: unknown, path = "") =>
  new Request(`http://localhost/api/stores/${STORE}/products${path}`, {
    method,
    body: JSON.stringify(body),
  });

const base = { sku: "PROD-1", name: "Cake", costPrice: 10, sellingPrice: 25 };

beforeEach(() => {
  vi.clearAllMocks();
  productService.createProduct.mockResolvedValue({ id: "p1", name: "Cake" });
  productService.updateProduct.mockResolvedValue({ id: "p1", name: "Cake" });
});

// The routes map every field explicitly: anything left out of that object is
// silently dropped no matter what the client sent. These pin that barcode is in it.
describe("POST /products — barcode", () => {
  it("passes a trimmed barcode through to the service", async () => {
    await POST(send("POST", { ...base, barcode: "  8991234567890 " }), ctx());
    expect(productService.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ barcode: "8991234567890" })
    );
  });

  it("an empty barcode arrives as null (no barcode), an absent one as undefined", async () => {
    await POST(send("POST", { ...base, barcode: "" }), ctx());
    expect(productService.createProduct.mock.calls[0][0].barcode).toBeNull();

    await POST(send("POST", base), ctx());
    expect(productService.createProduct.mock.calls[1][0].barcode).toBeUndefined();
  });

  it("rejects a barcode with a space (400 on the barcode field)", async () => {
    const res = await POST(send("POST", { ...base, barcode: "12 34" }), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).error.details[0].field).toBe("barcode");
    expect(productService.createProduct).not.toHaveBeenCalled();
  });

  it("reports a taken barcode as a 409 pinned to the barcode field", async () => {
    productService.createProduct.mockRejectedValue(
      new FieldConflictError(
        "barcode",
        'Barcode "123" is already used by another product in this store'
      )
    );

    const res = await POST(send("POST", { ...base, barcode: "123" }), ctx());

    expect(res.status).toBe(409);
    expect((await res.json()).error.details).toEqual([
      {
        field: "barcode",
        message: 'Barcode "123" is already used by another product in this store',
      },
    ]);
  });
});

describe("PATCH /products/[productId] — barcode", () => {
  const patch = (body: unknown) => PATCH(send("PATCH", body, "/p1"), ctx({ productId: "p1" }));

  it("sets, clears (null) or leaves alone (undefined) — three different instructions", async () => {
    await patch({ barcode: "ABC-1" });
    expect(productService.updateProduct.mock.calls[0][2].barcode).toBe("ABC-1");

    await patch({ barcode: null });
    expect(productService.updateProduct.mock.calls[1][2].barcode).toBeNull();

    await patch({ barcode: "" });
    expect(productService.updateProduct.mock.calls[2][2].barcode).toBeNull();

    await patch({ name: "Only the name" });
    expect(productService.updateProduct.mock.calls[3][2].barcode).toBeUndefined();
  });

  it("scopes the update to the path's store and product", async () => {
    await patch({ barcode: "X1" });
    expect(productService.updateProduct).toHaveBeenCalledWith("p1", STORE, expect.any(Object));
  });

  it("a taken barcode is a 409 on the barcode field", async () => {
    productService.updateProduct.mockRejectedValue(new FieldConflictError("barcode", "taken"));
    const res = await patch({ barcode: "X1" });
    expect(res.status).toBe(409);
    expect((await res.json()).error.details[0].field).toBe("barcode");
  });
});
