// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { trackingEvent: { create: vi.fn() } },
}));

import { POST } from "../route";
import { prisma } from "@/lib/prisma";

const create = prisma.trackingEvent.create as unknown as ReturnType<typeof vi.fn>;

const BROWSER_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

let ipCounter = 0;
function post(body: unknown, userAgent: string | null = BROWSER_UA) {
  const headers = new Headers({ "content-type": "application/json" });
  // A fresh IP per request so the in-memory rate limiter never interferes.
  headers.set("x-real-ip", `198.51.100.${++ipCounter}`);
  if (userAgent) headers.set("user-agent", userAgent);
  return POST(
    new Request("http://localhost:3000/api/public/tracking-events", {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

describe("POST /api/public/tracking-events", () => {
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({});
  });

  it("records a pixel event, with the path cleaned of its query and ids", async () => {
    const res = await post({
      kind: "PIXEL",
      name: "InitiateCheckout",
      path: "/store/clx9a8b7c6d5e4f3g2h1i0j9k8/billing?tab=plans",
      source: "site",
      locale: "id",
      content: "POS",
      value: 229000,
      currency: "idr",
    });

    expect(res.status).toBe(200);
    expect(create.mock.calls[0][0].data).toEqual({
      kind: "PIXEL",
      name: "InitiateCheckout",
      path: "/store/:id/billing",
      source: "site",
      locale: "id",
      content: "POS",
      value: 229000,
      currency: "IDR",
    });
  });

  it("records a cookie-bar answer and nothing that identifies the visitor", async () => {
    const res = await post({
      kind: "CONSENT",
      name: "REJECT_ALL",
      path: "/register",
      source: "site",
      locale: "fr",
      analytics: false,
      marketing: false,
    });

    expect(res.status).toBe(200);
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ kind: "CONSENT", name: "REJECT_ALL", marketing: false });
    expect(JSON.stringify(data)).not.toContain("198.51.100");
  });

  it("drops a language the site doesn't have instead of refusing the event", async () => {
    const res = await post({ kind: "PIXEL", name: "PageView", path: "/", source: "site", locale: "de" });
    expect(res.status).toBe(200);
    expect(create.mock.calls[0][0].data.locale).toBeUndefined();
  });

  it.each([
    ["an event name Meta isn't sent", { kind: "PIXEL", name: "Purchase", path: "/", source: "site" }],
    ["an unknown source", { kind: "PIXEL", name: "PageView", path: "/", source: "app" }],
    ["a consent answer without its choices", { kind: "CONSENT", name: "ACCEPT_ALL", path: "/", source: "site" }],
    ["a negative value", { kind: "PIXEL", name: "Subscribe", path: "/", source: "site", value: -1, currency: "EUR" }],
    ["not JSON", "nope"],
  ])("refuses %s", async (_label, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("answers a crawler without recording anything", async () => {
    const res = await post(
      { kind: "PIXEL", name: "PageView", path: "/", source: "site" },
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
    );
    expect(res.status).toBe(200);
    expect(create).not.toHaveBeenCalled();
  });
});
