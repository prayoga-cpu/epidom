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
  store: { findUnique: vi.fn() },
  customerDisplaySettings: { findUnique: vi.fn(), upsert: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const requireOwnerOnlyApi = vi.fn();
vi.mock("@/lib/auth/require-owner-only", () => ({
  requireOwnerOnlyApi: (...a: unknown[]) => requireOwnerOnlyApi(...a),
}));

const deleteBlob = vi.fn();
vi.mock("@/lib/storage", () => ({ getStorageAdapter: () => ({ delete: deleteBlob }) }));

import { GET, PUT } from "../route";
import { CUSTOMER_DISPLAY_DEFAULTS } from "@/lib/validation/customer-display.schemas";

const STORE = "store_abc12345";
// What /api/upload writes for the mocked caller (userId "u1").
const OLD_BG = "https://abc.public.blob.vercel-storage.com/users/u1/images/1-old-bg.png";
const NEW_BG = "https://abc.public.blob.vercel-storage.com/users/u1/images/2-new-bg.png";
const KEPT = "https://abc.public.blob.vercel-storage.com/users/u1/images/3-kept.png";
const GONE = "https://abc.public.blob.vercel-storage.com/users/u1/images/4-gone.png";
// Same host, another tenant's file: never ours to delete.
const FOREIGN = "https://abc.public.blob.vercel-storage.com/users/someone_else/images/5-x.png";

const ctx = () => ({ params: Promise.resolve({ id: STORE }) });
const url = `http://localhost/api/stores/${STORE}/customer-display`;
const put = (body: unknown) =>
  PUT(new Request(url, { method: "PUT", body: JSON.stringify(body) }), ctx());

const banner = (id: string, imageUrl: string) => ({
  id,
  imageUrl,
  label: "",
  active: true,
  startDate: null,
  endDate: null,
  days: [],
  startTime: null,
  endTime: null,
});

const storeRow = () => ({
  name: "Otium Cafe",
  image: null,
  storefront: {
    displayName: "OTIUM",
    logoUrl: "https://abc.public.blob.vercel-storage.com/users/u1/images/logo.png",
    themeColor: "#1F3A2A",
    fontFamily: "Inter",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=abc",
    googleReviewEnabled: true,
    instagramUrl: "@otium.cafe",
  },
  receiptSettings: { wifiName: "Otium Guest", wifiPassword: "kopi1234" },
});

beforeEach(() => {
  vi.clearAllMocks();
  requireOwnerOnlyApi.mockResolvedValue(null);
  deleteBlob.mockResolvedValue(undefined);
  prismaMock.customerDisplaySettings.upsert.mockResolvedValue({});
  prismaMock.customerDisplaySettings.findUnique.mockResolvedValue(null);
});

describe("GET /api/stores/[id]/customer-display", () => {
  it("resolves the defaults plus the storefront's branding for a store that never saved", async () => {
    prismaMock.store.findUnique.mockResolvedValue(storeRow());
    prismaMock.customerDisplaySettings.findUnique.mockResolvedValue(null);
    const res = await GET(new Request(url), ctx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.settings).toEqual(CUSTOMER_DISPLAY_DEFAULTS);
    expect(body.data.updatedAt).toBeNull();
    expect(body.data.branding).toMatchObject({
      storeName: "OTIUM",
      storefrontThemeColor: "#1F3A2A",
      storefrontFontStyle: "SANS",
      instagramUrl: "https://instagram.com/otium.cafe",
      wifiName: "Otium Guest",
      wifiPassword: "kopi1234",
    });
  });

  it("still comes up, on the defaults, when the settings can't be read", async () => {
    prismaMock.store.findUnique.mockResolvedValue(storeRow());
    prismaMock.customerDisplaySettings.findUnique.mockRejectedValue(
      new Error('relation "customer_display_settings" does not exist')
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(new Request(url), ctx());
    expect(res.status).toBe(200);
    expect((await res.json()).data.settings).toEqual(CUSTOMER_DISPLAY_DEFAULTS);
    errorSpy.mockRestore();
  });

  it("hides the review link while Google reviews are paused on the storefront", async () => {
    const row = storeRow();
    row.storefront.googleReviewEnabled = false;
    prismaMock.store.findUnique.mockResolvedValue(row);
    const body = await (await GET(new Request(url), ctx())).json();
    expect(body.data.branding.googleReviewUrl).toBeNull();
  });
});

describe("PUT /api/stores/[id]/customer-display", () => {
  it("is the real owner's alone", async () => {
    requireOwnerOnlyApi.mockResolvedValue(
      NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 })
    );
    const res = await put(CUSTOMER_DISPLAY_DEFAULTS);
    expect(res.status).toBe(403);
    expect(prismaMock.customerDisplaySettings.upsert).not.toHaveBeenCalled();
  });

  it("rejects a body that isn't a full, valid config", async () => {
    expect((await put({ backgroundStyle: "GRADIENT" })).status).toBe(400);
    expect(
      (await put({ ...CUSTOMER_DISPLAY_DEFAULTS, backgroundImageUrl: "https://evil.example/x.png" }))
        .status
    ).toBe(400);
    expect(prismaMock.customerDisplaySettings.upsert).not.toHaveBeenCalled();
  });

  it("stores empty custom text as null, so the translated default shows", async () => {
    prismaMock.customerDisplaySettings.findUnique.mockResolvedValue(null);
    prismaMock.store.findUnique.mockResolvedValue(storeRow());
    await put({ ...CUSTOMER_DISPLAY_DEFAULTS, welcomeTitle: "   ", thankYouTitle: "Terima kasih!" });

    const { create } = prismaMock.customerDisplaySettings.upsert.mock.calls[0][0];
    expect(create.welcomeTitle).toBeNull();
    expect(create.thankYouTitle).toBe("Terima kasih!");
  });

  it("deletes only the caller's own uploads that the new config dropped, after saving", async () => {
    prismaMock.customerDisplaySettings.findUnique.mockResolvedValueOnce({
      backgroundImageUrl: OLD_BG,
      logoUrl: FOREIGN,
      qrisImageUrl: null,
      banners: [banner("a", KEPT), banner("b", GONE)],
    });
    prismaMock.store.findUnique.mockResolvedValue(storeRow());

    const res = await put({
      ...CUSTOMER_DISPLAY_DEFAULTS,
      backgroundStyle: "IMAGE",
      backgroundImageUrl: NEW_BG,
      banners: [banner("a", KEPT)],
    });

    expect(res.status).toBe(200);
    expect(prismaMock.customerDisplaySettings.upsert).toHaveBeenCalledTimes(1);
    expect(deleteBlob.mock.calls.map(([u]) => u).sort()).toEqual([GONE, OLD_BG].sort());
    expect(deleteBlob).not.toHaveBeenCalledWith(FOREIGN);
    expect(deleteBlob).not.toHaveBeenCalledWith(KEPT);
  });

  it("still saves when a cleanup delete fails", async () => {
    prismaMock.customerDisplaySettings.findUnique.mockResolvedValueOnce({
      backgroundImageUrl: OLD_BG,
      logoUrl: null,
      qrisImageUrl: null,
      banners: [],
    });
    prismaMock.store.findUnique.mockResolvedValue(storeRow());
    deleteBlob.mockRejectedValue(new Error("blob down"));

    const res = await put(CUSTOMER_DISPLAY_DEFAULTS);
    expect(res.status).toBe(200);
  });
});
