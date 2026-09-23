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

const requireManagerOrOwnerApi = vi.fn();
vi.mock("@/lib/auth/require-manager-or-owner", () => ({
  requireManagerOrOwnerApi: (...a: unknown[]) => requireManagerOrOwnerApi(...a),
}));

const fetchUnifiedLog = vi.fn();
vi.mock("@/lib/attendance/unified-log", () => ({
  fetchUnifiedLog: (...a: unknown[]) => fetchUnifiedLog(...a),
}));

import { GET } from "../route";

const STORE = "store_abc12345";
const get = (query = "") =>
  GET(new Request(`http://localhost/api/stores/${STORE}/schedule/log${query}`), {
    params: Promise.resolve({ id: STORE }),
  });
const typesPassed = () => fetchUnifiedLog.mock.calls[0][0].types;

beforeEach(() => {
  vi.clearAllMocks();
  requireManagerOrOwnerApi.mockResolvedValue(null);
  fetchUnifiedLog.mockResolvedValue([]);
});

describe("GET /schedule/log — the `type` filter", () => {
  it("takes a comma-separated list, so the attendance page can ask for exactly its three kinds", async () => {
    await get("?type=CLOCK_IN,CLOCK_OUT,ABSENCE");
    expect(typesPassed()).toEqual(["CLOCK_IN", "CLOCK_OUT", "ABSENCE"]);
  });

  it("and the shifts page for exactly the two cash kinds — never attendance", async () => {
    await get("?type=CASH_IN,CASH_OUT");
    expect(typesPassed()).toEqual(["CASH_IN", "CASH_OUT"]);
  });

  it("still takes a single type", async () => {
    await get("?type=ABSENCE");
    expect(typesPassed()).toEqual(["ABSENCE"]);
  });

  it("drops unknown entries and keeps the valid ones", async () => {
    await get("?type=CASH_IN,DROP_TABLE,%20CLOCK_IN%20");
    expect(typesPassed()).toEqual(["CASH_IN", "CLOCK_IN"]);
  });

  it("nothing usable means no filter (every kind), not 'match nothing'", async () => {
    await get("?type=bogus");
    expect(typesPassed()).toBeUndefined();
    await get();
    expect(fetchUnifiedLog.mock.calls[1][0].types).toBeUndefined();
  });
});

describe("GET /schedule/log — access", () => {
  it("is manager/owner only, and does not read anything for anyone else", async () => {
    requireManagerOrOwnerApi.mockResolvedValue(
      NextResponse.json({ success: false }, { status: 403 })
    );

    const res = await get("?type=CASH_IN");

    expect(res.status).toBe(403);
    expect(fetchUnifiedLog).not.toHaveBeenCalled();
  });

  it("scopes the read to the store", async () => {
    await get("?type=CLOCK_IN");
    expect(fetchUnifiedLog.mock.calls[0][0].storeId).toBe(STORE);
  });
});
