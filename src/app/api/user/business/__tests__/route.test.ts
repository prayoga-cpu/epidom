import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: Request, ctx: Record<string, unknown>) =>
      handler(req, ctx),
}));

const getBusinessByUserId = vi.fn();
const createBusiness = vi.fn();
const upsertBusiness = vi.fn();
const activateFree = vi.fn();
vi.mock("@/lib/services", () => ({
  businessService: {
    getBusinessByUserId: (...a: unknown[]) => getBusinessByUserId(...a),
    createBusiness: (...a: unknown[]) => createBusiness(...a),
    upsertBusiness: (...a: unknown[]) => upsertBusiness(...a),
  },
  subscriptionService: { activateFree: (...a: unknown[]) => activateFree(...a) },
}));

const storeFindFirst = vi.fn();
const subscriptionFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    store: { findFirst: (...a: unknown[]) => storeFindFirst(...a), create: vi.fn() },
    user: { findUnique: vi.fn() },
    staffMember: { create: vi.fn() },
    subscription: { findUnique: (...a: unknown[]) => subscriptionFindUnique(...a) },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET, POST, PATCH } from "../route";

// bcrypt hash of a 4-digit PIN: 10,000 candidates, cracked offline in minutes.
const HASH = "$2a$10$abcdefghijklmnopqrstuuM2m4o0nN6wWm1l1y8y0Yb0Yb0Yb0Yb0";

const row = (ownerPin: string | null) => ({
  id: "biz_1",
  userId: "u1",
  name: "Kopi Kemang",
  country: "Indonesia",
  timezone: "Asia/Jakarta",
  locale: "id",
  ownerPin,
  onboardingStep: null,
});

const ctx = { userId: "u1" } as never;
const req = (method: string, body?: unknown) =>
  new Request("http://localhost/api/user/business", {
    method,
    ...(body !== undefined && {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  });

async function read(res: Response) {
  const text = await res.clone().text();
  const json = await res.json();
  return { text, data: json.data };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/api/user/business — the owner PIN hash never leaves the server", () => {
  it("GET: no ownerPin, hasOwnerPin: true, every other field kept", async () => {
    getBusinessByUserId.mockResolvedValue(row(HASH));

    const { text, data } = await read(await GET(req("GET"), ctx));

    expect(text).not.toContain(HASH);
    expect(data).not.toHaveProperty("ownerPin");
    const { ownerPin: _omit, ...rest } = row(HASH);
    expect(data).toEqual({ ...rest, hasOwnerPin: true });
  });

  it("GET: hasOwnerPin: false when no PIN is set", async () => {
    getBusinessByUserId.mockResolvedValue(row(null));

    const { data } = await read(await GET(req("GET"), ctx));

    expect(data).not.toHaveProperty("ownerPin");
    expect(data.hasOwnerPin).toBe(false);
  });

  it("GET: still 404s without a business", async () => {
    getBusinessByUserId.mockResolvedValue(null);

    const res = await GET(req("GET"), ctx);

    expect(res.status).toBe(404);
  });

  it("POST: the created row goes out without the ownerPin column", async () => {
    createBusiness.mockResolvedValue(row(null));

    const res = await POST(req("POST", { name: "Kopi Kemang" }), ctx);
    const { data } = await read(res);

    expect(res.status).toBe(201);
    expect(data).not.toHaveProperty("ownerPin");
    expect(data.hasOwnerPin).toBe(false);
    expect(data.id).toBe("biz_1");
  });

  it("PATCH: the upserted row (PIN already set) goes out without the hash, storeId kept", async () => {
    upsertBusiness.mockResolvedValue(row(HASH));
    storeFindFirst.mockResolvedValue({ id: "store_1" });
    subscriptionFindUnique.mockResolvedValue({ id: "sub_1" });

    const res = await PATCH(req("PATCH", { name: "Kopi Kemang" }), ctx);
    const { text, data } = await read(res);

    expect(res.status).toBe(200);
    expect(text).not.toContain(HASH);
    expect(data).not.toHaveProperty("ownerPin");
    expect(data).toMatchObject({
      id: "biz_1",
      name: "Kopi Kemang",
      hasOwnerPin: true,
      storeId: "store_1",
    });
    expect(activateFree).not.toHaveBeenCalled();
  });
});
