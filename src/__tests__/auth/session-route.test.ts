import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));

import { getSession } from "@/lib/auth";
import { GET } from "@/app/api/session/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_SESSION = {
  session: {
    id: "sess-1",
    userId: "user-1",
    expiresAt: new Date("2099-01-01"),
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ipAddress: null,
    userAgent: null,
  },
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
    image: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  },
};

beforeEach(() => {
  vi.resetAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/session", () => {
  it("returns success:true with session data when authenticated", async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_SESSION);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.user.id).toBe("user-1");
    expect(body.data.session.userId).toBe("user-1");
  });

  it("returns success:true with null data when not authenticated", async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
  });

  it("sets no-store Cache-Control to prevent stale session caching", async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_SESSION);

    const res = await GET();
    const cc = res.headers.get("Cache-Control") ?? "";

    expect(cc).toMatch(/no-store/);
  });

  it("gracefully returns null data when getSession throws", async () => {
    (getSession as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db error"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
  });
});
