import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = vi.hoisted(() => ({
  mcpToolCall: { create: vi.fn(async () => ({})) },
  orderItem: { findMany: vi.fn() },
  business: { findUnique: vi.fn(async () => ({ timezone: "Asia/Makassar" })) },
}));
const authorizeMcpStore = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/services/storefront.service", () => ({ storefrontService: {} }));
vi.mock("@/lib/services/finance-settings.service", () => ({
  getFinanceSettings: async () => ({ currency: "IDR" }),
}));
vi.mock("../authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../authorize")>()),
  authorizeMcpStore,
}));
vi.mock("@/lib/middleware/rate-limit", () => ({
  checkRateLimit: async () => ({ success: true, limit: 30, remaining: 29, reset: 0 }),
}));

import { getTopOptions } from "../tools/sales";

const call = {
  principal: { userId: "u", clientId: "c", clientName: "Claude", scopes: ["epidom:read"] },
  meta: {
    requestId: "r",
    method: "POST",
    route: "/api/mcp",
    ipHash: null,
    userAgent: null,
    startedAt: 0,
  },
};

describe("get_top_options", () => {
  beforeEach(() => {
    authorizeMcpStore.mockResolvedValue({
      storeId: "s1",
      store: { id: "s1", businessId: "b1", name: "OTIUM" },
      principal: call.principal,
      role: "OWNER",
      staffMemberId: null,
      actor: { kind: "USER", refId: "u", displayName: null, email: null, adminGrantSource: null },
    });
  });

  it("ranks picks weighted by line quantity and adds up the extra revenue", async () => {
    const opt = (groupName: string, optionName: string, priceAdjustment: number) => ({
      groupName,
      optionName,
      priceAdjustment,
      materialId: "internal",
    });
    prisma.orderItem.findMany.mockResolvedValue([
      {
        quantity: 2,
        selectedOptions: [opt("Base", "Quinoa", 20000), opt("Sauce", "Pesto", 15000)],
      },
      { quantity: 1, selectedOptions: [opt("Base", "Quinoa", 20000)] },
      { quantity: 1, selectedOptions: [opt("Base", "Rice", 15000)] },
      { quantity: 1, selectedOptions: null },
    ]);
    const result = await getTopOptions.run({ storeId: "s1", period: "this_month" }, call);
    const json = JSON.parse((result.content[0] as { text: string }).text);
    expect(json.options).toEqual([
      { group: "Base", option: "Quinoa", picks: 3, extraRevenue: "60000.00" },
      { group: "Sauce", option: "Pesto", picks: 2, extraRevenue: "30000.00" },
      { group: "Base", option: "Rice", picks: 1, extraRevenue: "15000.00" },
    ]);
    expect(JSON.stringify(json)).not.toContain("internal");
  });
});
