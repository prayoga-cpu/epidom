import { describe, it, expect, vi, beforeEach } from "vitest";

const decideOvertime = vi.hoisted(() => vi.fn());
const authorizeMcpStore = vi.hoisted(() => vi.fn());
vi.mock("@/lib/attendance/overtime-decision.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/attendance/overtime-decision.service")>()),
  decideOvertime,
}));
vi.mock("../authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../authorize")>()),
  authorizeMcpStore,
}));
vi.mock("@/lib/middleware/rate-limit", () => ({
  checkRateLimit: async () => ({ success: true, limit: 30, remaining: 29, reset: 0 }),
}));
vi.mock("@/lib/audit/activity", () => ({ writeActivityEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/prisma", () => ({ prisma: { mcpToolCall: { create: vi.fn(async () => ({})) } } }));
vi.mock("@/lib/services/storefront.service", () => ({ storefrontService: {} }));

import { decideOvertime as tool } from "../tools/staff";
import { OvertimeApprovalOffError } from "@/lib/attendance/overtime-decision.service";

const call = {
  principal: {
    userId: "owner-user",
    clientId: "c1",
    clientName: "Claude",
    scopes: ["epidom:read", "epidom:write"],
  },
  meta: {
    requestId: "r1",
    method: "POST",
    route: "/api/mcp",
    ipHash: null,
    userAgent: null,
    startedAt: 0,
  },
};

const args = {
  storeId: "store-1",
  decision: "APPROVED",
  days: [{ staffMemberId: "s1", date: "2026-10-27" }],
};

describe("decide_overtime", () => {
  beforeEach(() => {
    decideOvertime.mockReset();
    authorizeMcpStore.mockReset();
  });

  it("decides as the person behind the connection: a manager is never the owner", async () => {
    authorizeMcpStore.mockResolvedValue({
      storeId: "store-1",
      store: { id: "store-1", businessId: "b1", name: "Kopi" },
      principal: call.principal,
      role: "MANAGER",
      staffMemberId: "manager-staff",
      actor: {
        kind: "STAFF",
        refId: "manager-staff",
        displayName: "Rina",
        email: null,
        adminGrantSource: null,
      },
    });
    decideOvertime.mockImplementation(async (_store, _decision, _days, resolveDecider) => {
      expect(await resolveDecider()).toEqual({
        userId: "owner-user",
        staffMemberId: "manager-staff",
        name: "Rina",
      });
      return { requested: 2, decided: 2, minutes: 90, skipped: [] };
    });
    const result = await tool.run(args, call);
    expect(result.isError).toBeUndefined();
    expect(JSON.parse((result.content[0] as { text: string }).text)).toMatchObject({
      decidedDays: 2,
      minutes: 90,
    });
  });

  it("turns a refused single day and a store without approval into messages for the person", async () => {
    authorizeMcpStore.mockResolvedValue({
      storeId: "store-1",
      store: { id: "store-1", businessId: "b1", name: "Kopi" },
      principal: call.principal,
      role: "OWNER",
      staffMemberId: null,
      actor: {
        kind: "USER",
        refId: "owner-user",
        displayName: "Sari",
        email: null,
        adminGrantSource: null,
      },
    });
    decideOvertime.mockResolvedValueOnce({
      requested: 1,
      decided: 0,
      minutes: 0,
      skipped: [{ staffMemberId: "s1", date: "2026-10-27", reason: "self" }],
    });
    const self = await tool.run(args, call);
    expect(self.isError).toBe(true);
    expect((self.content[0] as { text: string }).text).toMatch(/own overtime/);

    decideOvertime.mockRejectedValueOnce(new OvertimeApprovalOffError());
    const off = await tool.run(args, call);
    expect(off.isError).toBe(true);
    expect((off.content[0] as { text: string }).text).toMatch(/without approval/);
  });
});
