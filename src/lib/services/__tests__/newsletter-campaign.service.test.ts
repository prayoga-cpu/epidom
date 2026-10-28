import { describe, it, expect, vi, beforeEach } from "vitest";

var mockPrisma: any;
vi.mock("@/lib/prisma", () => {
  mockPrisma = {
    newsletterCampaign: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn((args: unknown) => ({ op: "campaign.update", args })),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    newsletterDelivery: {
      count: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn((args: unknown) => ({ op: "delivery.createMany", args })),
      update: vi.fn((args: unknown) => ({ op: "delivery.update", args })),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
    newsletterUnsubscribe: { findMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  };
  return { prisma: mockPrisma };
});

const inngestSend = vi.fn();
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: (...a: unknown[]) => inngestSend(...a) } }));

const batchSend = vi.fn();
const emailsSend = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    batch = { send: (...a: unknown[]) => batchSend(...a) };
    emails = { send: (...a: unknown[]) => emailsSend(...a) };
  },
}));

const loadNewsletterContacts = vi.fn();
vi.mock("@/lib/services/newsletter-audience.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../newsletter-audience.service")>();
  return { ...actual, loadNewsletterContacts: (...a: unknown[]) => loadNewsletterContacts(...a) };
});

import {
  claimDueCampaigns,
  finalizeCampaign,
  prepareCampaignDeliveries,
  reclaimStalledCampaigns,
  retryCampaign,
  sendCampaignNow,
  sendNextBatch,
  updateCampaign,
} from "../newsletter-campaign.service";

const campaign = {
  subject: "October news",
  previewText: null,
  contentMode: "rich",
  contentHtml: "<p>Hello</p>",
  status: "SENDING",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "re_test";
  process.env.BETTER_AUTH_SECRET = "test-secret";
  mockPrisma.newsletterUnsubscribe.findMany.mockResolvedValue([]);
});

describe("claimDueCampaigns", () => {
  it("claims each due campaign with a conditional update and returns the ones it won", async () => {
    const now = new Date("2026-11-03T09:00:00Z");
    mockPrisma.newsletterCampaign.findMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    mockPrisma.newsletterCampaign.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 }); // edited or claimed elsewhere meanwhile

    await expect(claimDueCampaigns(now)).resolves.toEqual(["c1"]);
    expect(mockPrisma.newsletterCampaign.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", status: "SCHEDULED", scheduledAt: { lte: now } },
      data: { status: "SENDING", sendStartedAt: now, lastError: null },
    });
  });
});

describe("reclaimStalledCampaigns", () => {
  it("re-dispatches a run older than 30 minutes and re-stamps it", async () => {
    const now = new Date("2026-11-03T09:00:00Z");
    mockPrisma.newsletterCampaign.findMany.mockResolvedValue([{ id: "c9" }]);
    mockPrisma.newsletterCampaign.updateMany.mockResolvedValue({ count: 1 });

    await expect(reclaimStalledCampaigns(now)).resolves.toEqual(["c9"]);
    expect(mockPrisma.newsletterCampaign.findMany.mock.calls[0][0].where).toEqual({
      status: "SENDING",
      sendStartedAt: { lt: new Date("2026-11-03T08:30:00Z") },
    });
    expect(mockPrisma.newsletterCampaign.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["c9"] }, status: "SENDING" },
      data: { sendStartedAt: now },
    });
  });
});

describe("prepareCampaignDeliveries", () => {
  it("keeps an existing snapshot on a retry", async () => {
    mockPrisma.newsletterDelivery.count.mockResolvedValue(42);
    await expect(prepareCampaignDeliveries("c1")).resolves.toBe(42);
    expect(loadNewsletterContacts).not.toHaveBeenCalled();
  });

  it("snapshots the matching recipients in one transaction", async () => {
    mockPrisma.newsletterDelivery.count.mockResolvedValue(0);
    mockPrisma.newsletterCampaign.findUnique.mockResolvedValue({ audiences: ["PAID"], language: "fr" });
    loadNewsletterContacts.mockResolvedValue([
      { email: "a@cafe.fr", locale: "fr", groups: ["PAID"] },
      { email: "b@cafe.fr", locale: "id", groups: ["PAID"] },
      { email: "c@cafe.fr", locale: "fr", groups: ["FREE"] },
    ]);

    await expect(prepareCampaignDeliveries("c1")).resolves.toBe(1);
    const ops = mockPrisma.$transaction.mock.calls[0][0];
    expect(ops[0].args).toEqual({
      data: [{ campaignId: "c1", email: "a@cafe.fr", locale: "fr" }],
      skipDuplicates: true,
    });
    expect(ops[1].args).toEqual({ where: { id: "c1" }, data: { recipientCount: 1 } });
  });
});

describe("sendNextBatch", () => {
  beforeEach(() => {
    mockPrisma.newsletterCampaign.findUnique.mockResolvedValue(campaign);
    mockPrisma.newsletterDelivery.findMany.mockResolvedValue([
      { id: "d1", email: "a@cafe.fr", locale: "fr" },
      { id: "d2", email: "quit@cafe.fr", locale: "fr" },
      { id: "d3", email: "bad@cafe.fr", locale: "en" },
    ]);
    mockPrisma.newsletterDelivery.count.mockResolvedValue(0);
  });

  it("skips who unsubscribed since the snapshot and records Resend's per-address result", async () => {
    mockPrisma.newsletterUnsubscribe.findMany.mockResolvedValue([{ email: "quit@cafe.fr" }]);
    batchSend.mockResolvedValue({
      data: { data: [{ id: "em_1" }], errors: [{ index: 1, message: "Invalid `to` field" }] },
      error: null,
    });

    await expect(sendNextBatch("c1")).resolves.toEqual({ sent: 1, failed: 1, skipped: 1, remaining: 0 });

    expect(mockPrisma.newsletterDelivery.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["d2"] } },
      data: { status: "SKIPPED" },
    });
    const [emails, options] = batchSend.mock.calls[0];
    expect(emails.map((e: { to: string }) => e.to)).toEqual(["a@cafe.fr", "bad@cafe.fr"]);
    expect(emails[0].headers).toEqual({
      "List-Unsubscribe": expect.stringMatching(/^<http.*\/api\/public\/newsletter\/unsubscribe\?t=.+>$/),
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect(emails[0].html).toContain("Se désinscrire");
    expect(options).toEqual({ idempotencyKey: "newsletter-c1-d1", batchValidation: "permissive" });

    const updates = mockPrisma.$transaction.mock.calls[0][0].map((op: { args: unknown }) => op.args);
    expect(updates[0]).toMatchObject({ where: { id: "d1" }, data: { status: "SENT", resendId: "em_1" } });
    expect(updates[1]).toMatchObject({
      where: { id: "d3" },
      data: { status: "FAILED", error: "Invalid `to` field" },
    });
  });

  it("throws on a Resend error so the step retries, marking nobody", async () => {
    batchSend.mockResolvedValue({ data: null, error: { message: "Daily quota exceeded" } });
    await expect(sendNextBatch("c1")).rejects.toThrow("Daily quota exceeded");
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("does nothing once the campaign is no longer sending", async () => {
    mockPrisma.newsletterCampaign.findUnique.mockResolvedValue({ ...campaign, status: "FAILED" });
    await expect(sendNextBatch("c1")).resolves.toEqual({ sent: 0, failed: 0, skipped: 0, remaining: 0 });
    expect(batchSend).not.toHaveBeenCalled();
  });

  it("counts as sent without a Resend key (local dev)", async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    const { sendNextBatch: devSend } = await import("../newsletter-campaign.service");
    await expect(devSend("c1")).resolves.toMatchObject({ sent: 3, failed: 0 });
    expect(batchSend).not.toHaveBeenCalled();
  });
});

describe("finalizeCampaign", () => {
  it("marks it SENT with the counts", async () => {
    mockPrisma.newsletterDelivery.groupBy.mockResolvedValue([
      { status: "SENT", _count: { _all: 9 } },
      { status: "FAILED", _count: { _all: 1 } },
      { status: "SKIPPED", _count: { _all: 2 } },
    ]);
    await expect(finalizeCampaign("c1")).resolves.toEqual({ status: "SENT" });
    expect(mockPrisma.newsletterCampaign.updateMany.mock.calls[0][0].data).toMatchObject({
      status: "SENT",
      sentCount: 9,
      failedCount: 1,
      lastError: null,
    });
  });

  it("marks it FAILED when nobody matched", async () => {
    mockPrisma.newsletterDelivery.groupBy.mockResolvedValue([]);
    await expect(finalizeCampaign("c1")).resolves.toEqual({ status: "FAILED" });
    expect(mockPrisma.newsletterCampaign.updateMany.mock.calls[0][0].data.lastError).toMatch(/Nobody matched/);
  });
});

describe("edits and sends from the admin", () => {
  const input = {
    subject: "S",
    previewText: null,
    contentMode: "rich" as const,
    contentHtml: "<p>x</p>",
    audiences: ["PAID" as const],
    language: "all" as const,
    status: "DRAFT" as const,
    scheduledAt: null,
    timezone: "Europe/Paris",
  };

  it("refuses to change a campaign that started sending", async () => {
    mockPrisma.newsletterCampaign.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.newsletterCampaign.count.mockResolvedValue(1);
    await expect(updateCampaign("c1", input, "aaron@epidom.fr")).resolves.toEqual({
      ok: false,
      reason: "locked",
    });
    expect(mockPrisma.newsletterCampaign.updateMany.mock.calls[0][0].where).toEqual({
      id: "c1",
      status: { in: ["DRAFT", "SCHEDULED"] },
    });
  });

  it("reports a missing campaign as not found", async () => {
    mockPrisma.newsletterCampaign.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.newsletterCampaign.count.mockResolvedValue(0);
    await expect(updateCampaign("nope", input, "aaron@epidom.fr")).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("hands a send-now to Inngest", async () => {
    mockPrisma.newsletterCampaign.updateMany.mockResolvedValue({ count: 1 });
    inngestSend.mockResolvedValue(undefined);
    await expect(sendCampaignNow("c1", "aaron@epidom.fr")).resolves.toEqual({ ok: true, via: "queued" });
    expect(inngestSend).toHaveBeenCalledWith({
      name: "newsletter/campaign.send",
      data: { campaignId: "c1" },
    });
  });

  it("leaves a send-now to the dispatcher when Inngest can't take it", async () => {
    mockPrisma.newsletterCampaign.updateMany.mockResolvedValue({ count: 1 });
    inngestSend.mockRejectedValue(new Error("Inngest down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sendCampaignNow("c1", "aaron@epidom.fr")).resolves.toEqual({ ok: true, via: "dispatcher" });
    expect(mockPrisma.newsletterCampaign.updateMany).toHaveBeenLastCalledWith({
      where: { id: "c1", status: "SENDING" },
      data: expect.objectContaining({ status: "SCHEDULED", sendStartedAt: null }),
    });
  });

  it("retries only the failed recipients of a FAILED campaign", async () => {
    mockPrisma.newsletterCampaign.updateMany.mockResolvedValue({ count: 1 });
    inngestSend.mockResolvedValue(undefined);
    await retryCampaign("c1", "aaron@epidom.fr");
    expect(mockPrisma.newsletterCampaign.updateMany.mock.calls[0][0].where).toEqual({
      id: "c1",
      status: "FAILED",
    });
    expect(mockPrisma.newsletterDelivery.updateMany).toHaveBeenCalledWith({
      where: { campaignId: "c1", status: "FAILED" },
      data: { status: "PENDING", error: null },
    });
  });
});
