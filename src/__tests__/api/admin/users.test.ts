import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSession = { user: { id: "admin-id", email: "prayogadevelopment@gmail.com" } };

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/admin", () => ({
  isAdminUser: vi.fn((email: string) => email === "prayogadevelopment@gmail.com"),
}));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("hashed-pw") } }));

// var avoids TDZ — vi.mock factory is hoisted above const/let declarations.
var mockPrisma: any;
vi.mock("@/lib/prisma", () => {
  mockPrisma = {
    user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
    account: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    subscription: { upsert: vi.fn() },
  };
  return { prisma: mockPrisma };
});

import { getSession } from "@/lib/auth";
import { PATCH } from "@/app/api/admin/users/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/admin/users", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PATCH /api/admin/users", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(mockSession as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "admin-id",
      email: "prayogadevelopment@gmail.com",
      isAdmin: false,
    });
  });

  describe("auth guards", () => {
    it("returns 403 when unauthenticated", async () => {
      vi.mocked(getSession).mockResolvedValue(null);
      const res = await PATCH(makeReq({ action: "set-admin", userId: "u1", isAdmin: true }));
      expect(res.status).toBe(403);
    });

    it("returns 403 for non-admin user", async () => {
      vi.mocked(getSession).mockResolvedValue({ user: { id: "u1", email: "random@user.com" } } as any);
      mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", email: "random@user.com", isAdmin: false });
      const res = await PATCH(makeReq({ action: "set-admin", userId: "u2", isAdmin: true }));
      expect(res.status).toBe(403);
    });
  });

  describe("input validation", () => {
    it("returns 400 for invalid JSON body", async () => {
      const req = new NextRequest("http://localhost/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 for unknown action", async () => {
      const res = await PATCH(makeReq({ action: "unknown-action", userId: "u1" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Validation failed");
    });

    it("returns 400 for set-plan with invalid plan value", async () => {
      const res = await PATCH(makeReq({ action: "set-plan", userId: "u1", plan: "INVALID", status: "ACTIVE" }));
      expect(res.status).toBe(400);
    });
  });

  describe("set-plan", () => {
    it("upserts subscription with correct plan", async () => {
      mockPrisma.subscription.upsert.mockResolvedValue({ plan: "POS", status: "ACTIVE" });
      const res = await PATCH(makeReq({ action: "set-plan", userId: "u1", plan: "POS", status: "ACTIVE" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "u1" },
          update: expect.objectContaining({ plan: "POS", status: "ACTIVE" }),
        })
      );
    });
  });

  describe("set-period", () => {
    it("sets period end ~N months out", async () => {
      mockPrisma.subscription.upsert.mockResolvedValue({ status: "ACTIVE" });
      const res = await PATCH(makeReq({ action: "set-period", userId: "u1", months: 3 }));
      expect(res.status).toBe(200);
      const call = mockPrisma.subscription.upsert.mock.calls[0][0];
      const end: Date = call.update.currentPeriodEnd;
      const diffDays = (end.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(85);
      expect(diffDays).toBeLessThan(95);
    });

    it("sets lifetime period (~200 years) when lifetime:true", async () => {
      mockPrisma.subscription.upsert.mockResolvedValue({ status: "ACTIVE" });
      const res = await PATCH(makeReq({ action: "set-period", userId: "u1", lifetime: true }));
      expect(res.status).toBe(200);
      const call = mockPrisma.subscription.upsert.mock.calls[0][0];
      const end: Date = call.update.currentPeriodEnd;
      const diffYears = (end.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365);
      expect(diffYears).toBeGreaterThan(190);
    });
  });

  describe("set-admin", () => {
    it("updates isAdmin flag", async () => {
      mockPrisma.user.update.mockResolvedValue({ id: "u1", email: "other@x.com", isAdmin: true });
      const res = await PATCH(makeReq({ action: "set-admin", userId: "u1", isAdmin: true }));
      expect(res.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "u1" }, data: { isAdmin: true } })
      );
    });

    it("blocks self-modification", async () => {
      const res = await PATCH(makeReq({ action: "set-admin", userId: "admin-id", isAdmin: false }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/own account/i);
    });
  });

  describe("reset-password", () => {
    it("creates credential account if missing and sets emailVerified", async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);
      mockPrisma.account.create.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      const res = await PATCH(makeReq({ action: "reset-password", userId: "u1", newPassword: "NewPass123!" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ providerId: "credential", userId: "u1" }) })
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { emailVerified: true } })
      );
    });

    it("updates existing credential account password", async () => {
      mockPrisma.account.findFirst.mockResolvedValue({ id: "acc-1" });
      mockPrisma.account.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      const res = await PATCH(makeReq({ action: "reset-password", userId: "u1", newPassword: "NewPass123!" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.account.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "acc-1" }, data: { password: "hashed-pw" } })
      );
    });

    it("returns 400 when password is shorter than 8 chars", async () => {
      const res = await PATCH(makeReq({ action: "reset-password", userId: "u1", newPassword: "short" }));
      expect(res.status).toBe(400);
    });
  });

  describe("temp-password", () => {
    it("returns a 12-char plaintext temp password", async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);
      mockPrisma.account.create.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      const res = await PATCH(makeReq({ action: "temp-password", userId: "u1" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tempPassword).toHaveLength(12);
    });

    it("sets emailVerified: true on the user", async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);
      mockPrisma.account.create.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      await PATCH(makeReq({ action: "temp-password", userId: "u1" }));
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "u1" }, data: { emailVerified: true } })
      );
    });
  });

  describe("delete-user", () => {
    it("deletes target user", async () => {
      mockPrisma.user.delete.mockResolvedValue({});
      const res = await PATCH(makeReq({ action: "delete-user", userId: "u1" }));
      expect(res.status).toBe(200);
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
    });

    it("blocks self-deletion", async () => {
      const res = await PATCH(makeReq({ action: "delete-user", userId: "admin-id" }));
      expect(res.status).toBe(400);
    });
  });
});
