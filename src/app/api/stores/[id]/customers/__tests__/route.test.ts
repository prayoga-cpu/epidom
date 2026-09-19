import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// Pass-through withApiHandler that still maps thrown errors the way the real one
// does (handleApiError), so a ZodError / FieldError is asserted as the HTTP
// response the client would actually see.
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

const requireManagerOrOwnerApi = vi.fn();
vi.mock("@/lib/auth/require-manager-or-owner", () => ({
  requireManagerOrOwnerApi: (...a: unknown[]) => requireManagerOrOwnerApi(...a),
}));

const svc = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  getDetail: vi.fn(),
  update: vi.fn(),
  adjustPoints: vi.fn(),
  exportCsv: vi.fn(),
}));
vi.mock("@/lib/services/customer.service", () => ({ customerService: svc }));

import { GET, POST } from "../route";
import { GET as GET_ONE, PATCH } from "../[customerId]/route";
import { POST as POST_POINTS } from "../[customerId]/points/route";
import { GET as GET_EXPORT } from "../export/route";
import { FieldConflictError } from "@/lib/errors/field-error";

const STORE = "store_abc12345";
const ctx = (extra: Record<string, string> = {}) => ({
  params: Promise.resolve({ id: STORE, ...extra }),
});
const url = (path = "") => `http://localhost/api/stores/${STORE}/customers${path}`;
const json = (method: string, body: unknown, path = "") =>
  new Request(url(path), { method, body: typeof body === "string" ? body : JSON.stringify(body) });

const denied = () =>
  NextResponse.json(
    {
      success: false,
      error: { code: "FORBIDDEN", message: "Only an owner or manager can do this" },
    },
    { status: 403 }
  );

beforeEach(() => {
  vi.clearAllMocks();
  requireManagerOrOwnerApi.mockResolvedValue(null);
});

describe("GET /customers", () => {
  it("parses the query string and scopes the service call to the store", async () => {
    svc.list.mockResolvedValue({ customers: [], nextCursor: null, totalCount: 0 });

    const res = await GET(
      new Request(url("?q=ana&limit=8&sort=points&includeSummary=1&cursor=c9")),
      ctx()
    );

    expect(res.status).toBe(200);
    expect(svc.list).toHaveBeenCalledWith(STORE, {
      q: "ana",
      limit: 8,
      sort: "points",
      includeSummary: true,
      cursor: "c9",
    });
    expect((await res.json()).data).toEqual({ customers: [], nextCursor: null, totalCount: 0 });
  });

  it("applies defaults and is open to any store-authed caller (POS-tier: no manager check)", async () => {
    svc.list.mockResolvedValue({ customers: [], nextCursor: null, totalCount: 0 });
    await GET(new Request(url()), ctx());

    expect(svc.list).toHaveBeenCalledWith(STORE, {
      limit: 25,
      sort: "name",
      includeSummary: false,
    });
    expect(requireManagerOrOwnerApi).not.toHaveBeenCalled();
  });

  it("rejects a page size over 100 with a 400", async () => {
    const res = await GET(new Request(url("?limit=500")), ctx());
    expect(res.status).toBe(400);
    expect(svc.list).not.toHaveBeenCalled();
  });
});

describe("POST /customers", () => {
  it("creates and answers 201 with the row", async () => {
    svc.create.mockResolvedValue({ id: "c1", name: "Ana" });

    const res = await POST(json("POST", { name: "Ana", phone: "+33612345678" }), ctx());

    expect(res.status).toBe(201);
    expect(svc.create).toHaveBeenCalledWith(STORE, { name: "Ana", phone: "+33612345678" });
    expect((await res.json()).data).toEqual({ id: "c1", name: "Ana" });
  });

  it("a duplicate phone is a 409 CONFLICT pinned to the phone field", async () => {
    svc.create.mockRejectedValue(
      new FieldConflictError("phone", "A customer with this phone number already exists")
    );

    const res = await POST(json("POST", { name: "Ana", phone: "+33612345678" }), ctx());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("CONFLICT");
    expect(body.error.details).toEqual([
      { field: "phone", message: "A customer with this phone number already exists" },
    ]);
  });

  it("validates the body (400 with field details) and a malformed body is a 400, not a 500", async () => {
    const bad = await POST(json("POST", { name: "" }), ctx());
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.details[0].field).toBe("name");

    const garbage = await POST(json("POST", "{not json"), ctx());
    expect(garbage.status).toBe(400);
    expect(svc.create).not.toHaveBeenCalled();
  });
});

describe("GET /customers/[customerId]", () => {
  it("returns the detail for the id in the path, scoped to the store", async () => {
    svc.getDetail.mockResolvedValue({ id: "c1" });
    const res = await GET_ONE(new Request(url("/c1")), ctx({ customerId: "c1" }));
    expect(res.status).toBe(200);
    expect(svc.getDetail).toHaveBeenCalledWith(STORE, "c1");
  });
});

describe("PATCH /customers/[customerId] — manager or owner", () => {
  it("is refused (and never reaches the service) for a non-manager persona", async () => {
    requireManagerOrOwnerApi.mockResolvedValue(denied());

    const res = await PATCH(json("PATCH", { name: "New" }, "/c1"), ctx({ customerId: "c1" }));

    expect(res.status).toBe(403);
    expect(svc.update).not.toHaveBeenCalled();
    expect(requireManagerOrOwnerApi).toHaveBeenCalledWith(STORE);
  });

  it("updates for a manager, passing null through to clear a field", async () => {
    svc.update.mockResolvedValue({ id: "c1" });

    const res = await PATCH(json("PATCH", { phone: null }, "/c1"), ctx({ customerId: "c1" }));

    expect(res.status).toBe(200);
    expect(svc.update).toHaveBeenCalledWith(STORE, "c1", { phone: null });
  });

  it("refuses an empty patch", async () => {
    const res = await PATCH(json("PATCH", {}, "/c1"), ctx({ customerId: "c1" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /customers/[customerId]/points — manager or owner", () => {
  it("is refused for a cashier persona, before anything is parsed or written", async () => {
    requireManagerOrOwnerApi.mockResolvedValue(denied());

    const res = await POST_POINTS(
      json("POST", { points: 10, note: "x" }, "/c1/points"),
      ctx({ customerId: "c1" })
    );

    expect(res.status).toBe(403);
    expect(svc.adjustPoints).not.toHaveBeenCalled();
  });

  it("passes a signed adjustment and its reason to the service", async () => {
    svc.adjustPoints.mockResolvedValue({ id: "c1", points: 40 });

    const res = await POST_POINTS(
      json("POST", { points: -10, note: "correction" }, "/c1/points"),
      ctx({ customerId: "c1" })
    );

    expect(res.status).toBe(200);
    expect(svc.adjustPoints).toHaveBeenCalledWith(STORE, "c1", { points: -10, note: "correction" });
  });

  it("rejects zero and a missing reason with a 400", async () => {
    const zero = await POST_POINTS(
      json("POST", { points: 0, note: "x" }, "/c1/points"),
      ctx({ customerId: "c1" })
    );
    const noNote = await POST_POINTS(
      json("POST", { points: 5 }, "/c1/points"),
      ctx({ customerId: "c1" })
    );
    expect(zero.status).toBe(400);
    expect(noNote.status).toBe(400);
    expect(svc.adjustPoints).not.toHaveBeenCalled();
  });
});

describe("GET /customers/export — manager or owner", () => {
  it("is refused for a non-manager persona", async () => {
    requireManagerOrOwnerApi.mockResolvedValue(denied());
    const res = await GET_EXPORT(new Request(url("/export")), ctx());
    expect(res.status).toBe(403);
    expect(svc.exportCsv).not.toHaveBeenCalled();
  });

  it("streams a CSV attachment, honouring the search term", async () => {
    svc.exportCsv.mockResolvedValue("Name,Phone\nAna,+33612345678");

    const res = await GET_EXPORT(new Request(url("/export?q=ana")), ctx());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="customers-\d{4}-\d{2}-\d{2}\.csv"$/
    );
    expect(await res.text()).toBe("Name,Phone\nAna,+33612345678");
    expect(svc.exportCsv).toHaveBeenCalledWith(STORE, "ana");
  });
});
