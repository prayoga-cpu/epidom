// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { newsletterUnsubscribe: { upsert: vi.fn() } },
}));

import { POST } from "../route";
import { prisma } from "@/lib/prisma";
import { createUnsubscribeToken } from "@/lib/newsletter/unsubscribe-token";

const upsert = prisma.newsletterUnsubscribe.upsert as unknown as ReturnType<typeof vi.fn>;

let ipCounter = 0;
function post(url: string, init: { body?: string; contentType?: string }) {
  const headers = new Headers({ "x-real-ip": `198.51.100.${++ipCounter}` });
  if (init.contentType) headers.set("content-type", init.contentType);
  return POST(new Request(url, { method: "POST", headers, body: init.body }));
}

describe("POST /api/public/newsletter/unsubscribe", () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = "test-secret";
    upsert.mockReset();
    upsert.mockResolvedValue({});
  });

  it("unsubscribes from the page's button (JSON token)", async () => {
    const res = await post("http://localhost:3000/api/public/newsletter/unsubscribe", {
      contentType: "application/json",
      body: JSON.stringify({ token: createUnsubscribeToken("Jane@Bakery.com") }),
    });

    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith({
      where: { email: "jane@bakery.com" },
      update: {},
      create: { email: "jane@bakery.com", source: "link" },
    });
  });

  it("unsubscribes from a mail app's one-click button (RFC 8058)", async () => {
    const token = createUnsubscribeToken("jane@bakery.com");
    const res = await post(`http://localhost:3000/api/public/newsletter/unsubscribe?t=${token}`, {
      contentType: "application/x-www-form-urlencoded",
      body: "List-Unsubscribe=One-Click",
    });

    expect(res.status).toBe(200);
    expect(upsert.mock.calls[0][0].create).toEqual({ email: "jane@bakery.com", source: "one_click" });
  });

  it("refuses a forged token", async () => {
    const [, signature] = createUnsubscribeToken("jane@bakery.com").split(".");
    const forged = `${Buffer.from("boss@bakery.com").toString("base64url")}.${signature}`;
    const res = await post("http://localhost:3000/api/public/newsletter/unsubscribe", {
      contentType: "application/json",
      body: JSON.stringify({ token: forged }),
    });

    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });
});
