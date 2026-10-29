import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = vi.hoisted(() => ({
  business: { findUnique: vi.fn() },
  staffMember: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma }));
// The tool modules pull in services that need a database; only their
// definitions (name, kind, access) matter here.
vi.mock("@/lib/services/storefront.service", () => ({ storefrontService: {} }));

import { visibleTools } from "../server";
import { MCP_TOOLS } from "../tools";
import { toolResult } from "../define-tool";
import type { McpCallContext } from "../define-tool";

const call = (scopes: string[]): McpCallContext => ({
  principal: { userId: "user-1", clientId: "c1", clientName: "Claude", scopes },
  meta: {
    requestId: "r1",
    method: "POST",
    route: "/api/mcp",
    ipHash: null,
    userAgent: null,
    startedAt: 0,
  },
});

describe("MCP_TOOLS", () => {
  it("has unique names that Claude accepts", () => {
    const names = MCP_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]{2,63}$/);
  });

  it("marks reads read-only and every write as such", () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.annotations.readOnlyHint).toBe(tool.kind === "read");
    }
  });

  it("never exposes the excluded actions (money, till, attendance, staff admin, messages)", () => {
    const names = MCP_TOOLS.map((tool) => tool.name).join(" ");
    for (const banned of [
      "refund",
      "settle",
      "till",
      "clock",
      "pin",
      "invite",
      "send",
      "publish_storefront",
      "delete_store",
    ]) {
      expect(names).not.toContain(banned);
    }
  });
});

describe("visibleTools", () => {
  beforeEach(() => {
    prisma.business.findUnique.mockReset();
    prisma.staffMember.findFirst.mockReset();
  });

  it("hides write tools from a read-only connection", async () => {
    prisma.business.findUnique.mockResolvedValue({ id: "biz-1" });
    const tools = await visibleTools(call(["epidom:read"]));
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every((tool) => tool.kind === "read")).toBe(true);
    const all = await visibleTools(call(["epidom:read", "epidom:write"]));
    expect(all.length).toBe(MCP_TOOLS.length);
  });

  it("shows a staff-only account just the tools its grants allow", async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    prisma.staffMember.findFirst.mockResolvedValue({ role: "KITCHEN", allowedPages: [] });
    const names = (await visibleTools(call(["epidom:read", "epidom:write"]))).map(
      (tool) => tool.name
    );
    // KITCHEN defaults to /pos/kds and /pos/schedule.
    expect(names).toContain("list_stores");
    expect(names).toContain("get_roster");
    expect(names).not.toContain("get_sales_summary");
    expect(names).not.toContain("create_supplier_order");
    expect(names).not.toContain("get_payroll");
  });
});

describe("toolResult", () => {
  it("returns compact JSON, and a helpful refusal when the answer is too large", () => {
    expect(toolResult({ a: BigInt(1), b: "x" }).content[0]).toEqual({
      type: "text",
      text: '{"a":"1","b":"x"}',
    });
    const huge = toolResult({ rows: "x".repeat(100_000) });
    expect(huge.isError).toBe(true);
  });
});
