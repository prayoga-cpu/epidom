import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: Request) =>
      handler(req, { userId: "u1", params: {} }),
}));

const service = vi.hoisted(() => ({
  getGuideState: vi.fn(),
  applyGuideStatePatch: vi.fn(),
}));
vi.mock("@/lib/services/guide.service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/guide.service")>(
    "@/lib/services/guide.service"
  );
  return {
    GuideStoreAccessError: actual.GuideStoreAccessError,
    getGuideState: service.getGuideState,
    applyGuideStatePatch: service.applyGuideStatePatch,
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { GET, PATCH } from "../route";
import { GuideStoreAccessError } from "@/lib/services/guide.service";

const URL = "http://localhost/api/user/guide-state";
const STATE = { tourSeenAt: null, dismissedTips: ["stock"], dismissedChecklists: [] };

const patch = (body: unknown) =>
  PATCH(
    new Request(URL, {
      method: "PATCH",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    {} as never
  );

beforeEach(() => {
  vi.clearAllMocks();
  service.getGuideState.mockResolvedValue(STATE);
  service.applyGuideStatePatch.mockResolvedValue(STATE);
});

describe("GET /api/user/guide-state", () => {
  it("returns the caller's state, never cached", async () => {
    const res = await GET(new Request(URL), {} as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, data: STATE });
    expect(service.getGuideState).toHaveBeenCalledWith("u1");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});

describe("PATCH /api/user/guide-state", () => {
  it("applies a valid change for the caller and returns the full state", async () => {
    const res = await patch({ dismissTip: "stock" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, data: STATE });
    expect(service.applyGuideStatePatch).toHaveBeenCalledWith("u1", { dismissTip: "stock" });
  });

  it.each([
    ["an empty body", {}],
    ["an unknown tip", { dismissTip: "nope" }],
    ["tourSeen false", { tourSeen: false }],
    ["an over-long store id", { dismissChecklist: "x".repeat(65) }],
    ["not JSON", "{{{"],
    ["JSON null", "null"],
  ])("400 for %s, nothing written", async (_label, body) => {
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect(service.applyGuideStatePatch).not.toHaveBeenCalled();
  });

  it("drops keys the schema doesn't know rather than passing them on", async () => {
    await patch({ tourSeen: true, userId: "someone_else" });
    expect(service.applyGuideStatePatch).toHaveBeenCalledWith("u1", { tourSeen: true });
  });

  it("403 when hiding the checklist of a store the caller can't reach", async () => {
    service.applyGuideStatePatch.mockRejectedValue(new GuideStoreAccessError());
    const res = await patch({ dismissChecklist: "other_store" });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
  });

  it("any other failure propagates to withApiHandler's error handling", async () => {
    service.applyGuideStatePatch.mockRejectedValue(new Error("db down"));
    await expect(patch({ tourSeen: true })).rejects.toThrow("db down");
  });
});
