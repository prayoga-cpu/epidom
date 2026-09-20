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
  scheduleImage: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const requireManagerOrOwnerApi = vi.fn();
vi.mock("@/lib/auth/require-manager-or-owner", () => ({
  requireManagerOrOwnerApi: (...a: unknown[]) => requireManagerOrOwnerApi(...a),
}));

const deleteBlob = vi.fn();
vi.mock("@/lib/storage", () => ({ getStorageAdapter: () => ({ delete: deleteBlob }) }));

import { GET, POST } from "../route";
import { DELETE } from "../[imageId]/route";

const STORE = "store_abc12345";
// What /api/upload writes for the mocked caller (userId "u1" in the handler mock above).
const OLD = "https://abc123.public.blob.vercel-storage.com/users/u1/images/1700000000000-old.png";
const NEW = "https://abc123.public.blob.vercel-storage.com/users/u1/images/1700000000001-new.png";
// Same Blob host, but another tenant's file.
const VICTIM = "https://abc123.public.blob.vercel-storage.com/users/victim_user/images/1-logo.png";

const ctx = (extra: Record<string, string> = {}) => ({
  params: Promise.resolve({ id: STORE, ...extra }),
});
const url = (query = "") => `http://localhost/api/stores/${STORE}/schedule-images${query}`;
const post = (body: unknown) =>
  POST(new Request(url(), { method: "POST", body: JSON.stringify(body) }), ctx());

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "climage000000000000000001",
  storeId: STORE,
  imageUrl: NEW,
  startDate: new Date("2026-09-14T00:00:00.000Z"),
  endDate: new Date("2026-09-20T00:00:00.000Z"),
  note: null,
  ...overrides,
});
const valid = { imageUrl: NEW, startDate: "2026-09-14", endDate: "2026-09-20" };

const denied = () =>
  NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });

beforeEach(() => {
  vi.clearAllMocks();
  requireManagerOrOwnerApi.mockResolvedValue(null);
  prismaMock.scheduleImage.findMany.mockResolvedValue([]);
  prismaMock.scheduleImage.findUnique.mockResolvedValue(null);
  prismaMock.scheduleImage.upsert.mockResolvedValue(row());
  prismaMock.scheduleImage.delete.mockResolvedValue(row());
  deleteBlob.mockResolvedValue(undefined);
});

describe("GET /schedule-images", () => {
  const whereOf = () => prismaMock.scheduleImage.findMany.mock.calls[0][0].where;

  it("is store-scoped and needs no manager role — staff read it on My Schedule", async () => {
    await GET(new Request(url()), ctx());
    expect(whereOf()).toEqual({ storeId: STORE });
    expect(requireManagerOrOwnerApi).not.toHaveBeenCalled();
  });

  it("from=today keeps every image whose dates haven't fully passed (overlap, not containment)", async () => {
    await GET(new Request(url("?from=2026-09-17")), ctx());
    expect(whereOf()).toEqual({
      storeId: STORE,
      endDate: { gte: new Date("2026-09-17T00:00:00.000Z") },
    });
  });

  it("from+to keeps every image overlapping the window", async () => {
    await GET(new Request(url("?from=2026-09-14&to=2026-09-20")), ctx());
    expect(whereOf()).toEqual({
      storeId: STORE,
      endDate: { gte: new Date("2026-09-14T00:00:00.000Z") },
      startDate: { lte: new Date("2026-09-20T00:00:00.000Z") },
    });
  });

  it("answers in date keys, soonest first", async () => {
    prismaMock.scheduleImage.findMany.mockResolvedValue([row({ note: "Updated Tuesday" })]);

    const res = await GET(new Request(url()), ctx());

    expect(prismaMock.scheduleImage.findMany.mock.calls[0][0].orderBy).toEqual([
      { startDate: "asc" },
    ]);
    expect((await res.json()).data.images).toEqual([
      {
        id: "climage000000000000000001",
        imageUrl: NEW,
        startDate: "2026-09-14",
        endDate: "2026-09-20",
        note: "Updated Tuesday",
      },
    ]);
  });

  it("refuses a from/to that only LOOKS like a date (31 February) — it would silently roll over", async () => {
    const res = await GET(new Request(url("?from=2026-02-31")), ctx());
    expect(res.status).toBe(400);
    expect(prismaMock.scheduleImage.findMany).not.toHaveBeenCalled();
  });

  it("refuses a datetime for from/to rather than silently misreading it", async () => {
    const res = await GET(new Request(url("?from=2026-09-14T00:00:00Z")), ctx());
    expect(res.status).toBe(400);
    expect(prismaMock.scheduleImage.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /schedule-images", () => {
  it("is manager/owner only, and writes nothing for anyone else", async () => {
    requireManagerOrOwnerApi.mockResolvedValue(denied());

    const res = await post(valid);

    expect(res.status).toBe(403);
    expect(prismaMock.scheduleImage.upsert).not.toHaveBeenCalled();
  });

  it("refuses an image that didn't come from our upload endpoint", async () => {
    const res = await post({ ...valid, imageUrl: "javascript:alert(1)" });
    expect(res.status).toBe(400);
    expect(prismaMock.scheduleImage.upsert).not.toHaveBeenCalled();
  });

  // The regression the static review proved: the schema only checks the HOST, which
  // every tenant's uploads share, so an owner could store someone else's file here and
  // then delete it (with the app-wide Blob token) by replacing or removing the image.
  it("refuses ANOTHER tenant's file on the same Blob host — it isn't this account's upload", async () => {
    const res = await post({ ...valid, imageUrl: VICTIM });

    expect(res.status).toBe(400);
    expect(prismaMock.scheduleImage.upsert).not.toHaveBeenCalled();
  });

  it("publishes a new range: 201, scoped to this store", async () => {
    const res = await post({ ...valid, note: "Week 38" });

    expect(res.status).toBe(201);
    const call = prismaMock.scheduleImage.upsert.mock.calls[0][0];
    expect(call.create).toMatchObject({ storeId: STORE, imageUrl: NEW, note: "Week 38" });
    expect(call.where.storeId_startDate_endDate.storeId).toBe(STORE);
    expect(deleteBlob).not.toHaveBeenCalled();
  });

  it("the same dates again REPLACE the image (200) and free the old file", async () => {
    prismaMock.scheduleImage.findUnique.mockResolvedValue(row({ imageUrl: OLD }));

    const res = await post(valid);

    expect(res.status).toBe(200);
    expect(deleteBlob).toHaveBeenCalledWith(OLD);
  });

  it("replacing a row whose stored file isn't this account's never deletes that file", async () => {
    // Can't be created through POST any more, but nothing may rely on that: the delete
    // uses the app-wide token, so it is guarded at the point of deletion too.
    prismaMock.scheduleImage.findUnique.mockResolvedValue(row({ imageUrl: VICTIM }));

    const res = await post(valid);

    expect(res.status).toBe(200);
    expect(deleteBlob).not.toHaveBeenCalled();
  });

  it("saving only a new note keeps the same file — nothing is deleted", async () => {
    prismaMock.scheduleImage.findUnique.mockResolvedValue(row({ imageUrl: NEW }));

    await post({ ...valid, note: "Swapped" });

    expect(deleteBlob).not.toHaveBeenCalled();
  });

  it("a blob that won't delete does not undo the manager's upload", async () => {
    prismaMock.scheduleImage.findUnique.mockResolvedValue(row({ imageUrl: OLD }));
    deleteBlob.mockRejectedValue(new Error("blob unavailable"));

    const res = await post(valid);

    expect(res.status).toBe(200);
  });
});

describe("DELETE /schedule-images/[imageId]", () => {
  const del = (id = "climage000000000000000001") =>
    DELETE(new Request(url(`/${id}`), { method: "DELETE" }), ctx({ imageId: id }));

  it("is manager/owner only", async () => {
    requireManagerOrOwnerApi.mockResolvedValue(denied());
    const res = await del();
    expect(res.status).toBe(403);
    expect(prismaMock.scheduleImage.delete).not.toHaveBeenCalled();
  });

  it("another store's image is a 404 — its existence isn't confirmable from here", async () => {
    prismaMock.scheduleImage.findUnique.mockResolvedValue(row({ storeId: "some_other_store" }));

    const res = await del();

    expect(res.status).toBe(404);
    expect(prismaMock.scheduleImage.delete).not.toHaveBeenCalled();
    expect(deleteBlob).not.toHaveBeenCalled();
  });

  it("removes the row but never deletes a file that isn't this account's", async () => {
    prismaMock.scheduleImage.findUnique.mockResolvedValue(row({ imageUrl: VICTIM }));

    const res = await del();

    expect(res.status).toBe(200);
    expect(prismaMock.scheduleImage.delete).toHaveBeenCalled();
    expect(deleteBlob).not.toHaveBeenCalled();
  });

  it("removes the row and then its file", async () => {
    prismaMock.scheduleImage.findUnique.mockResolvedValue(row());

    const res = await del();

    expect(res.status).toBe(200);
    expect(prismaMock.scheduleImage.delete).toHaveBeenCalledWith({
      where: { id: "climage000000000000000001" },
    });
    expect(deleteBlob).toHaveBeenCalledWith(NEW);
  });
});
