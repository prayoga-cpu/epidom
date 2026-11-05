import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = vi.hoisted(() => ({
  mcpToolCall: { create: vi.fn(async () => ({})) },
  actionLog: { findMany: vi.fn(), findFirst: vi.fn() },
}));
const planReversal = vi.hoisted(() => vi.fn());
const applyReversal = vi.hoisted(() => vi.fn());
const authorizeMcpStore = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/audit/reverse", () => ({ planReversal, applyReversal }));
vi.mock("@/lib/services/storefront.service", () => ({ storefrontService: {} }));
vi.mock("../authorize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../authorize")>()),
  authorizeMcpStore,
}));
vi.mock("@/lib/middleware/rate-limit", () => ({
  checkRateLimit: async () => ({ success: true, limit: 30, remaining: 29, reset: 0 }),
}));
vi.mock("@/lib/audit/activity", () => ({ writeActivityEvent: vi.fn(async () => undefined) }));

import { listMenuChanges, undoMenuChange } from "../tools/changes";

const call = {
  principal: {
    userId: "u",
    clientId: "c",
    clientName: "Claude",
    scopes: ["epidom:read", "epidom:write"],
  },
  meta: {
    requestId: "r",
    method: "POST",
    route: "/api/mcp",
    ipHash: null,
    userAgent: null,
    startedAt: 0,
  },
};
const run = async (
  tool: { run: (a: Record<string, unknown>, c: typeof call) => Promise<any> },
  args: Record<string, unknown>
) => {
  const result = await tool.run({ storeId: "s1", ...args }, call);
  const text = (result.content[0] as { text: string }).text;
  return { isError: Boolean(result.isError), text, json: result.isError ? null : JSON.parse(text) };
};

describe("menu change history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizeMcpStore.mockResolvedValue({
      storeId: "s1",
      store: { id: "s1", businessId: "b1", name: "OTIUM" },
      principal: call.principal,
      role: "OWNER",
      staffMemberId: null,
      actor: { kind: "USER", refId: "u", displayName: "Evan", email: null, adminGrantSource: null },
    });
  });

  it("lists the store's menu changes and marks which can still be undone", async () => {
    const recent = new Date();
    prisma.actionLog.findMany.mockResolvedValue([
      {
        id: "a1",
        occurredAt: recent,
        actionType: "menu.items.change",
        targetLabel: "Changed 21 menu items",
        state: "RECORDED",
        actorName: "Evan",
        reversesActionId: null,
      },
      {
        id: "a2",
        occurredAt: recent,
        actionType: "menu.items.change",
        targetLabel: "Changed 2 menu items",
        state: "REVERTED",
        actorName: "Evan",
        reversesActionId: null,
      },
      {
        id: "a3",
        occurredAt: new Date(Date.now() - 40 * 86400000),
        actionType: "menu.categories.change",
        targetLabel: "Removed 5 empty categories",
        state: "RECORDED",
        actorName: "Evan",
        reversesActionId: null,
      },
    ]);
    const { json } = await run(listMenuChanges, {});
    expect(prisma.actionLog.findMany.mock.calls[0][0].where).toMatchObject({
      storeId: "s1",
      actionType: { startsWith: "menu." },
    });
    expect(json.changes.map((c: { undoable: boolean }) => c.undoable)).toEqual([
      true,
      false,
      false,
    ]);
    expect(json.changes[1].state).toBe("reverted");
  });

  it("only touches menu changes of this store", async () => {
    prisma.actionLog.findFirst.mockResolvedValue(null);
    const { isError, text } = await run(undoMenuChange, { changeId: "someone-elses" });
    expect(isError).toBe(true);
    expect(text).toMatch(/No undoable menu change/);
    expect(prisma.actionLog.findFirst.mock.calls[0][0].where).toMatchObject({
      storeId: "s1",
      actionType: { startsWith: "menu." },
    });
    expect(applyReversal).not.toHaveBeenCalled();
  });

  it("previews with the engine's verdict and writes nothing", async () => {
    prisma.actionLog.findFirst.mockResolvedValue({ id: "a1" });
    planReversal.mockResolvedValue({
      ok: false,
      refusal: { code: "SUPERSEDED", message: '"Quinoa" has been changed since.' },
    });
    const refused = await run(undoMenuChange, { changeId: "a1", mode: "preview" });
    expect(refused.json).toMatchObject({
      canUndo: false,
      reason: expect.stringMatching(/changed since/),
    });

    planReversal.mockResolvedValue({
      ok: true,
      label: "Changed 21 menu items",
      effect: "Restores the previous value.",
    });
    const ok = await run(undoMenuChange, { changeId: "a1", mode: "preview" });
    expect(ok.json).toMatchObject({ canUndo: true, what: "Changed 21 menu items" });
    expect(applyReversal).not.toHaveBeenCalled();
  });

  it("undoes with the person's reason, or a default that names who asked", async () => {
    prisma.actionLog.findFirst.mockResolvedValue({ id: "a1" });
    applyReversal.mockResolvedValue({ ok: true, reversalActionId: "rev-1" });
    const { json } = await run(undoMenuChange, { changeId: "a1" });
    expect(applyReversal).toHaveBeenCalledWith("a1", "Undone from Claude at the request of Evan");
    expect(json).toMatchObject({ undone: true, undoChangeId: "rev-1" });

    await run(undoMenuChange, { changeId: "a1", reason: "Wrong prices on the bowls" });
    expect(applyReversal).toHaveBeenLastCalledWith("a1", "Wrong prices on the bowls");
  });

  it("relays the engine's refusal in plain words", async () => {
    prisma.actionLog.findFirst.mockResolvedValue({ id: "a1" });
    applyReversal.mockResolvedValue({
      ok: false,
      refusal: { code: "TOO_OLD", message: "This action is 40 days old." },
    });
    const { isError, text } = await run(undoMenuChange, { changeId: "a1" });
    expect(isError).toBe(true);
    expect(text).toMatch(/40 days old/);
  });
});
