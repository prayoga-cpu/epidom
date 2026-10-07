// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { salesPageEvent: { create: vi.fn() } },
}));

import { POST } from "../route";
import { prisma } from "@/lib/prisma";

const create = prisma.salesPageEvent.create as unknown as ReturnType<typeof vi.fn>;

const BROWSER_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

let ipCounter = 0;
function post(body: unknown, userAgent: string | null = BROWSER_UA) {
  const headers = new Headers({ "content-type": "application/json" });
  // A fresh IP per request so the in-memory rate limiter never interferes.
  headers.set("x-real-ip", `203.0.113.${++ipCounter}`);
  if (userAgent) headers.set("user-agent", userAgent);
  return POST(
    new Request("http://localhost:3000/api/public/sales-pages/events", {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

describe("POST /api/public/sales-pages/events", () => {
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({});
  });

  it("records a view with an anonymous visitor hash, never the IP", async () => {
    const res = await post({
      page: "sales-page-2",
      type: "VIEW",
      referrer: "l.instagram.com",
      utmSource: "instagram",
      utmCampaign: "launch",
    });

    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      page: "sales-page-2",
      type: "VIEW",
      referrer: "l.instagram.com",
      utmSource: "instagram",
      utmCampaign: "launch",
    });
    expect(data.visitorHash).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(data)).not.toContain("203.0.113.");
  });

  it("keeps the button name on a click", async () => {
    await post({ page: "sales-page-3", type: "CTA_CLICK", cta: "calculator" });

    expect(create.mock.calls[0][0].data).toMatchObject({
      page: "sales-page-3",
      type: "CTA_CLICK",
      cta: "calculator",
    });
  });

  it.each([
    ["an unknown page", { page: "sales-page-9", type: "VIEW" }],
    ["a SIGNUP, which only the auth hook may record", { page: "sales-page-1", type: "SIGNUP" }],
    ["an unknown event", { page: "sales-page-1", type: "PURCHASE" }],
    ["a button name that is not a slug", { page: "sales-page-1", type: "CTA_CLICK", cta: "<b>" }],
    ["a body that is not JSON", "not json"],
  ])("rejects %s", async (_label, body) => {
    const res = await post(body);

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ["a crawler", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
    ["a link preview", "facebookexternalhit/1.1"],
    ["a request with no user agent", null],
  ])("answers %s without recording anything", async (_label, ua) => {
    const res = await post({ page: "sales-page-1", type: "VIEW" }, ua);

    expect(res.status).toBe(200);
    expect(create).not.toHaveBeenCalled();
  });
});
