import { describe, it, expect, vi, beforeEach } from "vitest";

const deleteMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { oauthClient: { deleteMany } } }));

import { ABANDONED_CLIENT_AGE_MS, pruneAbandonedOauthClients } from "../client-cleanup";

describe("pruneAbandonedOauthClients", () => {
  beforeEach(() => {
    deleteMany.mockReset();
    deleteMany.mockResolvedValue({ count: 3 });
  });

  it("deletes only self-registered clients older than a week that never got a consent or a token", async () => {
    const now = new Date("2026-10-29T12:00:00Z");
    await expect(pruneAbandonedOauthClients(now)).resolves.toBe(3);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        userId: null,
        createdAt: { lt: new Date(now.getTime() - ABANDONED_CLIENT_AGE_MS) },
        consents: { none: {} },
        accessTokens: { none: {} },
        refreshTokens: { none: {} },
      },
    });
  });
});
