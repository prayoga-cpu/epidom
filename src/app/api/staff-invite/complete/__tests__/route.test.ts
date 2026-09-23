import { describe, it, expect, vi, beforeEach } from "vitest";

// Run the audit write inline so it can be asserted on.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => fn(),
}));

const rateLimitMiddleware = vi.fn();
vi.mock("@/lib/middleware/rate-limit", () => ({
  rateLimitMiddleware: (...a: unknown[]) => rateLimitMiddleware(...a),
}));

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: (...a: unknown[]) => getSession(...a) }));

const claimWithNewAccount = vi.fn();
const claimWithSession = vi.fn();
vi.mock("@/lib/services/staff-invite.service", () => ({
  claimStaffInviteWithNewAccount: (...a: unknown[]) => claimWithNewAccount(...a),
  claimStaffInviteWithSession: (...a: unknown[]) => claimWithSession(...a),
}));

const writeActivityEvent = vi.fn();
vi.mock("@/lib/audit/activity", () => ({
  writeActivityEvent: (...a: unknown[]) => writeActivityEvent(...a),
}));

import { POST } from "../route";

const TOKEN = "t".repeat(43);
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/staff-invite/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

const okNew = {
  ok: true,
  email: "jane.doe@example.com",
  userId: "user_new",
  staffMemberId: "staff_1",
  storeId: "store_1",
};

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMiddleware.mockResolvedValue(null);
  getSession.mockResolvedValue(null);
});

describe("POST /api/staff-invite/complete — input and limits", () => {
  it("is rate limited per IP under its own key, before any claim logic runs", async () => {
    rateLimitMiddleware.mockResolvedValue({ limit: 10, remaining: 0, reset: 30 });

    const res = await post({ token: TOKEN, password: "correct-horse" });

    expect(rateLimitMiddleware).toHaveBeenCalledWith(expect.any(Request), "/api/staff-invite/complete");
    expect(res.status).toBe(429);
    expect(claimWithNewAccount).not.toHaveBeenCalled();
  });

  it("gives a too-short password its own 400 message", async () => {
    const res = await post({ token: TOKEN, password: "short" });

    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/at least 8/i);
    expect(claimWithNewAccount).not.toHaveBeenCalled();
  });

  it("answers a payload with no usable token as an invalid link", async () => {
    const res = await post({ password: "correct-horse" });
    expect(res.status).toBe(404);
    expect(claimWithNewAccount).not.toHaveBeenCalled();
  });
});

describe("POST /api/staff-invite/complete — a brand-new account (password present)", () => {
  it("creates the account and returns the email so the client can sign in — and never the token or userId", async () => {
    claimWithNewAccount.mockResolvedValue(okNew);

    const res = await post({ token: TOKEN, password: "correct-horse", name: "Jane" });
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(claimWithNewAccount).toHaveBeenCalledWith({ token: TOKEN, password: "correct-horse", name: "Jane" });
    expect(JSON.parse(text).data).toEqual({ linked: true, email: "jane.doe@example.com" });
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("user_new");
  });

  it("does not consult the caller's session at all on this path", async () => {
    claimWithNewAccount.mockResolvedValue(okNew);
    await post({ token: TOKEN, password: "correct-horse" });
    expect(getSession).not.toHaveBeenCalled();
    expect(claimWithSession).not.toHaveBeenCalled();
  });

  it("maps an account that appeared meanwhile to 409 with a machine-readable reason", async () => {
    claimWithNewAccount.mockResolvedValue({ ok: false, reason: "account_exists", maskedEmail: "j***@example.com" });

    const res = await post({ token: TOKEN, password: "correct-horse" });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.details).toEqual({ reason: "account_exists", maskedEmail: "j***@example.com" });
  });

  it.each([
    ["expired", 410],
    ["consumed", 410],
    ["unavailable", 410],
    ["invalid", 404],
  ])("maps %s to HTTP %i", async (reason, code) => {
    claimWithNewAccount.mockResolvedValue({ ok: false, reason });
    expect((await post({ token: TOKEN, password: "correct-horse" })).status).toBe(code);
  });
});

describe("POST /api/staff-invite/complete — linking an existing account (no password)", () => {
  const session = (over: Record<string, unknown> = {}) => ({
    user: { id: "user_1", email: "jane.doe@example.com", name: "Jane", emailVerified: true, ...over },
  });

  it("needs a session: 401 sign_in_required when there isn't one, and never claims anything", async () => {
    const res = await post({ token: TOKEN });

    expect(res.status).toBe(401);
    expect((await res.json()).error.details.reason).toBe("sign_in_required");
    expect(claimWithSession).not.toHaveBeenCalled();
  });

  it("links the SESSION's account, passing its id, email and verification flag — nothing the client supplied", async () => {
    getSession.mockResolvedValue(session());
    claimWithSession.mockResolvedValue({ ...okNew, userId: "user_1" });

    const res = await post({ token: TOKEN, userId: "someone_else", email: "victim@example.com" });

    expect(res.status).toBe(200);
    expect(claimWithSession).toHaveBeenCalledWith({
      token: TOKEN,
      user: { id: "user_1", email: "jane.doe@example.com", emailVerified: true },
    });
    // No email echoed here: the caller already signed in as that account.
    expect((await res.json()).data).toEqual({ linked: true });
  });

  it("a DIFFERENT account than the invite's: 403, the masked address (never the real one), and a CRITICAL DENIED audit event", async () => {
    getSession.mockResolvedValue(session({ id: "user_attacker", email: "attacker@evil.com" }));
    claimWithSession.mockResolvedValue({ ok: false, reason: "email_mismatch", maskedEmail: "j***@example.com" });

    const res = await post({ token: TOKEN });
    const text = await res.text();

    expect(res.status).toBe(403);
    expect(JSON.parse(text).error.details).toEqual({ reason: "email_mismatch", maskedEmail: "j***@example.com" });
    expect(text).not.toContain("jane.doe@example.com");

    expect(writeActivityEvent).toHaveBeenCalledTimes(1);
    expect(writeActivityEvent.mock.calls[0][0]).toMatchObject({
      actionCode: "staff.invite.claim",
      severity: "CRITICAL",
      outcome: "DENIED",
      statusCode: 403,
      actor: { kind: "USER", refId: "user_attacker", email: "attacker@evil.com" },
    });
  });
});

describe("POST /api/staff-invite/complete — audit trail", () => {
  it("records a successful claim as CRITICAL/SUCCESS against the staff member and store, without the token", async () => {
    claimWithNewAccount.mockResolvedValue(okNew);

    await post({ token: TOKEN, password: "correct-horse" });

    const event = writeActivityEvent.mock.calls[0][0];
    expect(event).toMatchObject({
      actionCode: "staff.invite.claim",
      severity: "CRITICAL",
      outcome: "SUCCESS",
      statusCode: 200,
      storeId: "store_1",
      targetType: "StaffMember",
      targetId: "staff_1",
      actor: { kind: "USER", refId: "user_new" },
    });
    expect(JSON.stringify(event)).not.toContain(TOKEN);
    expect(JSON.stringify(event)).not.toContain("correct-horse");
  });

  it("records a merely dead link as a low-severity FAILED event with no target", async () => {
    claimWithNewAccount.mockResolvedValue({ ok: false, reason: "expired" });

    await post({ token: TOKEN, password: "correct-horse" });

    expect(writeActivityEvent.mock.calls[0][0]).toMatchObject({
      severity: "NOTICE",
      outcome: "FAILED",
      statusCode: 410,
      storeId: null,
      targetId: null,
      actor: { kind: "PUBLIC" },
    });
  });
});
