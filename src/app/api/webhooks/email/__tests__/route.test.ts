import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the route
vi.mock("@/lib/prisma", () => ({
  prisma: {
    storefront: { findUnique: vi.fn() },
    aggregatorEmail: { create: vi.fn() },
  },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}));

import { POST } from "../route";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";

const mockStorefront = { storeId: "store-abc" };

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/webhooks/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const basePayload = {
  from: "noreply@gofood.co.id",
  to: "orders@epidom.fr",
  subject: "[@warung-sari] GoFood — Pesanan Baru #12345",
  text: "Pelanggan: Maya\nTotal: Rp 56.000",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.storefront.findUnique).mockResolvedValue(mockStorefront as never);
  vi.mocked(prisma.aggregatorEmail.create).mockResolvedValue({ id: "email-1" } as never);
});

describe("POST /api/webhooks/email", () => {
  describe("slug extraction", () => {
    it("extracts slug and routes to correct store", async () => {
      const res = await POST(makeRequest(basePayload));
      expect(res.status).toBe(200);
      expect(prisma.storefront.findUnique).toHaveBeenCalledWith({
        where: { slug: "warung-sari" },
        select: { storeId: true },
      });
    });

    it("returns 422 when subject has no [@slug] prefix", async () => {
      const res = await POST(
        makeRequest({ ...basePayload, subject: "GoFood — Pesanan Baru #12345" })
      );
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toMatch(/slug/i);
    });

    it("lowercases the slug", async () => {
      const res = await POST(
        makeRequest({ ...basePayload, subject: "[@Warung-SARI] GoFood order" })
      );
      expect(res.status).toBe(200);
      expect(prisma.storefront.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: "warung-sari" } })
      );
    });

    it("returns 404 when storefront does not exist", async () => {
      vi.mocked(prisma.storefront.findUnique).mockResolvedValue(null);
      const res = await POST(makeRequest(basePayload));
      expect(res.status).toBe(404);
    });
  });

  describe("platform detection", () => {
    it.each([
      ["gofood@no-reply.gofood.co.id", "GoFood order", "GOFOOD"],
      ["noreply@grab.com", "GrabFood new order", "GRABFOOD"],
      ["order@shopee.co.id", "ShopeeFood pesanan", "SHOPEEFOOD"],
      ["noreply@tokopedia.com", "Tokopedia order", "TOKOPEDIA"],
      ["unknown@mail.com", "Random subject", null],
    ])("detects %s → %s", async (from, subjectSuffix, expectedPlatform) => {
      const res = await POST(
        makeRequest({
          ...basePayload,
          from,
          subject: `[@warung-sari] ${subjectSuffix}`,
        })
      );
      expect(res.status).toBe(200);
      const createCall = vi.mocked(prisma.aggregatorEmail.create).mock.calls[0][0];
      expect(createCall.data.platform).toBe(expectedPlatform ?? undefined);
    });
  });

  describe("webhook secret validation", () => {
    it("returns 401 when secret configured but header missing", async () => {
      process.env.EMAIL_WEBHOOK_SECRET = "supersecret";
      const res = await POST(makeRequest(basePayload));
      expect(res.status).toBe(401);
      delete process.env.EMAIL_WEBHOOK_SECRET;
    });

    it("returns 401 when secret does not match", async () => {
      process.env.EMAIL_WEBHOOK_SECRET = "supersecret";
      const res = await POST(makeRequest(basePayload, { "x-webhook-secret": "wrong" }));
      expect(res.status).toBe(401);
      delete process.env.EMAIL_WEBHOOK_SECRET;
    });

    it("allows request when secret matches", async () => {
      process.env.EMAIL_WEBHOOK_SECRET = "supersecret";
      const res = await POST(makeRequest(basePayload, { "x-webhook-secret": "supersecret" }));
      expect(res.status).toBe(200);
      delete process.env.EMAIL_WEBHOOK_SECRET;
    });
  });

  describe("inngest integration", () => {
    it("fires aggregator/email.received event with correct data", async () => {
      vi.mocked(prisma.aggregatorEmail.create).mockResolvedValue({ id: "email-xyz" } as never);
      await POST(makeRequest(basePayload));
      expect(inngest.send).toHaveBeenCalledWith({
        name: "aggregator/email.received",
        data: { aggregatorEmailId: "email-xyz", storeId: "store-abc" },
      });
    });

    it("succeeds even if Inngest throws (email stored for manual review)", async () => {
      vi.mocked(inngest.send).mockRejectedValue(new Error("Inngest unavailable"));
      const res = await POST(makeRequest(basePayload));
      // Should still return 200 — catch swallows the Inngest error
      expect(res.status).toBe(200);
    });
  });

  describe("input validation", () => {
    it("returns 400 for invalid JSON", async () => {
      const req = new Request("http://localhost/api/webhooks/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json {{",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when required fields are missing", async () => {
      const res = await POST(makeRequest({ subject: "[@warung-sari] test" }));
      expect(res.status).toBe(400);
    });
  });
});
