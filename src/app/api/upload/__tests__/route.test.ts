import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: Request) =>
      handler(req, { userId: "u1", params: {} }),
}));

const storage = vi.hoisted(() => ({ delete: vi.fn(), upload: vi.fn() }));
vi.mock("@/lib/storage", () => ({ getStorageAdapter: () => storage }));
vi.mock("@/lib/utils/server-image-compression", () => ({ compressImageServer: vi.fn() }));

import { DELETE } from "../route";

const BLOB = "https://abc123.public.blob.vercel-storage.com";

const del = (body: unknown) =>
  DELETE(
    new Request("http://localhost/api/upload", {
      method: "DELETE",
      body: JSON.stringify(body),
    }),
    {} as never
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /api/upload", () => {
  it("deletes the caller's own upload", async () => {
    const url = `${BLOB}/users/u1/images/1700000000-logo.webp`;
    const res = await del({ url });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, data: { deleted: true } });
    expect(storage.delete).toHaveBeenCalledWith(url);
  });

  it("never deletes another account's upload, and doesn't fail the caller's save either", async () => {
    const res = await del({ url: `${BLOB}/users/u2/images/1700000000-logo.webp` });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, data: { deleted: false } });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("ignores a path that only looks like the caller's (another prefix, a bare folder)", async () => {
    await del({ url: `${BLOB}/evil/users/u1/images/x.webp` });
    await del({ url: `${BLOB}/users/u1/other/x.webp` });
    await del({ url: "not a url" });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("rejects a missing URL", async () => {
    const res = await del({});
    expect(res.status).toBe(400);
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
