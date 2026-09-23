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

// The real service runs against a mocked Prisma, so a passing test proves the
// whole chain — parse the paste, then persist only what it should.
const prisma = vi.hoisted(() => ({
  storefront: { findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { PATCH } from "../route";
import { storefrontService } from "@/lib/services/storefront.service";

const STORE = "store_abc12345";
const PLACE_ID = "ChIJN1t_tDeuEmsRUsoyG83frY4";
const REVIEW_URL = `https://search.google.com/local/writereview?placeid=${PLACE_ID}`;
const SELECT = { googlePlaceId: true, googleReviewUrl: true, googleReviewEnabled: true };

const call = (body: unknown) =>
  PATCH(
    new Request(`http://localhost/api/stores/${STORE}/storefront/google-review`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: STORE }) }
  );

beforeEach(() => {
  vi.clearAllMocks();
  prisma.storefront.findUnique.mockResolvedValue({ id: "sf_1" });
  prisma.storefront.update.mockResolvedValue({
    googlePlaceId: PLACE_ID,
    googleReviewUrl: REVIEW_URL,
    googleReviewEnabled: true,
  });
});

describe("PATCH /api/stores/[id]/storefront/google-review", () => {
  it("connects with a Place ID: stores the normalized review link, scoped to the store", async () => {
    const res = await call({ link: PLACE_ID });

    expect(res.status).toBe(200);
    // toHaveBeenCalledWith is an exact match — no isPublished, no
    // googleReviewEnabled, nothing but the two Google fields.
    expect(prisma.storefront.update).toHaveBeenCalledWith({
      where: { storeId: STORE },
      data: { googlePlaceId: PLACE_ID, googleReviewUrl: REVIEW_URL },
      select: SELECT,
    });
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.googleReviewUrl).toBe(REVIEW_URL);
  });

  it("connects with Business Profile's g.page link, which carries no Place ID", async () => {
    await call({ link: "https://g.page/r/CabcDEFghiJKLMn/review?utm=x" });

    expect(prisma.storefront.update).toHaveBeenCalledWith({
      where: { storeId: STORE },
      data: { googlePlaceId: null, googleReviewUrl: "https://g.page/r/CabcDEFghiJKLMn/review" },
      select: SELECT,
    });
  });

  it("normalizes a pasted writereview link instead of storing it verbatim", async () => {
    await call({ link: `${REVIEW_URL}&utm_source=qr&hl=fr` });

    expect(prisma.storefront.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { googlePlaceId: PLACE_ID, googleReviewUrl: REVIEW_URL },
      })
    );
  });

  it("rejects a Maps listing link with a machine-readable reason, and writes nothing", async () => {
    const res = await call({ link: "https://maps.app.goo.gl/AbCdEf123" });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.details).toEqual({ reason: "mapsListing" });
    expect(prisma.storefront.update).not.toHaveBeenCalled();
  });

  it("rejects anything that isn't a Google link, and writes nothing", async () => {
    for (const link of ["https://example.com/reviews", "javascript:alert(1)", "hello there"]) {
      const res = await call({ link });
      expect(res.status).toBe(400);
      expect((await res.json()).error.details).toEqual({ reason: "invalid" });
    }
    expect(prisma.storefront.update).not.toHaveBeenCalled();
  });

  it("disconnects on an empty link and re-arms the switch for the next connection", async () => {
    await call({ link: "" });

    expect(prisma.storefront.update).toHaveBeenCalledWith({
      where: { storeId: STORE },
      data: { googlePlaceId: null, googleReviewUrl: null, googleReviewEnabled: true },
      select: SELECT,
    });
  });

  it("pauses without touching the connection", async () => {
    await call({ enabled: false });

    expect(prisma.storefront.update).toHaveBeenCalledWith({
      where: { storeId: STORE },
      data: { googleReviewEnabled: false },
      select: SELECT,
    });
  });

  it("can connect and pause in a single request", async () => {
    await call({ link: PLACE_ID, enabled: false });

    expect(prisma.storefront.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          googlePlaceId: PLACE_ID,
          googleReviewUrl: REVIEW_URL,
          googleReviewEnabled: false,
        },
      })
    );
  });

  it("cannot be used to unpublish the store: stray storefront fields are dropped", async () => {
    await call({ link: PLACE_ID, isPublished: false, acceptsOrders: false });

    const { data } = prisma.storefront.update.mock.calls[0][0];
    expect(data).not.toHaveProperty("isPublished");
    expect(data).not.toHaveProperty("acceptsOrders");
  });

  it("400s on a body that changes nothing", async () => {
    const res = await call({});

    expect(res.status).toBe(400);
    expect(prisma.storefront.update).not.toHaveBeenCalled();
  });

  it("creates the draft storefront first when the store has none yet", async () => {
    prisma.storefront.findUnique.mockResolvedValueOnce(null);
    const ensure = vi
      .spyOn(storefrontService, "getStorefrontByStoreId")
      .mockResolvedValue({} as never);

    const res = await call({ link: PLACE_ID });

    expect(res.status).toBe(200);
    expect(ensure).toHaveBeenCalledWith(STORE);
    expect(prisma.storefront.update).toHaveBeenCalledTimes(1);
    ensure.mockRestore();
  });
});
