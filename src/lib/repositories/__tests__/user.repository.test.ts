import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";

// The repository is built on an injected fake client; keep the real one (and
// its database connection) out of the test.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { UserRepository } from "../user.repository";

// bcrypt hash of a 4-digit PIN: 10,000 candidates, cracked offline in minutes.
const HASH = "$2a$10$abcdefghijklmnopqrstuuM2m4o0nN6wWm1l1y8y0Yb0Yb0Yb0Yb0";

const findUnique = vi.fn();
let repo: UserRepository;

beforeEach(() => {
  findUnique.mockReset();
  repo = new UserRepository({ user: { findUnique } } as unknown as PrismaClient);
});

describe("UserRepository.getProfile — the owner PIN hash stays on the server", () => {
  it("drops business.ownerPin and reports hasOwnerPin, keeping the rest of the row", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      email: "owner@example.com",
      business: {
        id: "biz_1",
        name: "Kopi",
        ownerPin: HASH,
        onboardingStep: 2,
        stores: [{ id: "s1" }],
      },
      subscription: { plan: "POS" },
    });

    const profile = await repo.getProfile("u1");

    expect(JSON.stringify(profile)).not.toContain(HASH);
    expect(profile?.business).not.toHaveProperty("ownerPin");
    expect(profile).toEqual({
      id: "u1",
      email: "owner@example.com",
      business: {
        id: "biz_1",
        name: "Kopi",
        hasOwnerPin: true,
        onboardingStep: 2,
        stores: [{ id: "s1" }],
      },
      subscription: { plan: "POS" },
    });
  });

  it("hasOwnerPin: false when no PIN is set", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      business: { id: "biz_1", ownerPin: null, stores: [] },
      subscription: null,
    });

    const profile = await repo.getProfile("u1");

    expect(profile?.business).not.toHaveProperty("ownerPin");
    expect((profile?.business as unknown as { hasOwnerPin: boolean }).hasOwnerPin).toBe(false);
  });

  it("no business stays null; no user stays null", async () => {
    findUnique.mockResolvedValueOnce({ id: "u2", business: null, subscription: null });
    expect((await repo.getProfile("u2"))?.business).toBeNull();

    findUnique.mockResolvedValueOnce(null);
    expect(await repo.getProfile("nobody")).toBeNull();
  });

  it("still loads the stores and subscription with the business", async () => {
    findUnique.mockResolvedValue(null);

    await repo.getProfile("u1");

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      include: { business: { include: { stores: true } }, subscription: true },
    });
  });
});
