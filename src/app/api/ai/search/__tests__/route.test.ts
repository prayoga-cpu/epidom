// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ getSession: vi.fn(), generate: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: m.getSession } } }));
vi.mock("@/lib/ai/openai-client", () => ({ generateStructuredResponse: m.generate }));

import { POST } from "../route";

const req = (body: unknown) =>
  new Request("http://x/api/ai/search", { method: "POST", body: JSON.stringify(body) }) as never;

beforeEach(() => {
  m.getSession.mockReset().mockResolvedValue({ user: { id: "u1" } });
  m.generate.mockReset();
  process.env.OPENAI_API_KEY = "test";
});

describe("POST /api/ai/search", () => {
  it("rejects signed-out callers", async () => {
    m.getSession.mockResolvedValue(null);
    expect((await POST(req({ query: "tax" }))).status).toBe(401);
  });

  it("rejects a bad query", async () => {
    expect((await POST(req({ query: "a" }))).status).toBe(400);
  });

  it("hands the model the catalog and keeps only ids that exist in it", async () => {
    m.generate.mockResolvedValue({
      data: { answer: "Open Fees & Taxes.", ids: ["settings-fees", "made-up-id"] },
    });
    const res = await POST(req({ query: "where do I change vat", locale: "en" }));
    const body = await res.json();

    expect(body.answer).toBe("Open Fees & Taxes.");
    expect(body.matches.map((x: { id: string }) => x.id)).toEqual(["settings-fees"]);
    expect(body.matches[0].href).toBe("/profile#settings-fees");
    const system = m.generate.mock.calls[0][0] as string;
    expect(system).toContain("feat-import-menu");
    expect(system).toContain("settings-fees");
  });

  it("answers 502 when the model fails", async () => {
    m.generate.mockRejectedValue(new Error("boom"));
    expect((await POST(req({ query: "anything here" }))).status).toBe(502);
  });
});
