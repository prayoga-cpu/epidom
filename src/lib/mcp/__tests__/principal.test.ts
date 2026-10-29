import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { oauthAccessToken: { findUnique } } }));

import { hashAccessToken, readBearerToken, resolveMcpPrincipal } from "../principal";

/**
 * How @better-auth/oauth-provider stores tokens (storeTokens: "hashed"):
 * `createHash("SHA-256").digest(utf8)` from @better-auth/utils, a Web Crypto
 * SHA-256, then base64url without padding.
 */
async function pluginHash(value: string): Promise<string> {
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  );
  return Buffer.from(hash)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const HOUR = 60 * 60 * 1000;

function row(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    clientId: "client-1",
    scopes: ["epidom:read", "offline_access"],
    expiresAt: new Date(Date.now() + HOUR),
    client: { disabled: false, name: "Claude" },
    user: { deactivatedAt: null },
    ...overrides,
  };
}

describe("hashAccessToken", () => {
  it("matches how the OAuth provider stores access tokens", async () => {
    // The SHA-256 test vector for "abc", base64url without padding.
    expect(hashAccessToken("abc")).toBe("ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
    for (const token of ["TlXGRkUkIfMxPzwxVgGzKZwMvYpqeDhq", "ünïcödé"]) {
      expect(hashAccessToken(token)).toBe(await pluginHash(token));
    }
  });
});

describe("readBearerToken", () => {
  it("reads a Bearer token and nothing else", () => {
    expect(readBearerToken("Bearer abc123")).toBe("abc123");
    expect(readBearerToken("bearer abc123")).toBe("abc123");
    expect(readBearerToken("Basic abc123")).toBeNull();
    expect(readBearerToken("Bearer")).toBeNull();
    expect(readBearerToken(null)).toBeNull();
  });
});

describe("resolveMcpPrincipal", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("looks the token up by its hash and returns who it belongs to", async () => {
    findUnique.mockResolvedValue(row());
    await expect(resolveMcpPrincipal("tok")).resolves.toEqual({
      userId: "user-1",
      clientId: "client-1",
      clientName: "Claude",
      scopes: ["epidom:read", "offline_access"],
    });
    expect(findUnique.mock.calls[0][0].where).toEqual({ token: hashAccessToken("tok") });
  });

  it("refuses unknown, expired, disabled-client and deactivated-account tokens", async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(resolveMcpPrincipal("tok")).resolves.toBeNull();

    findUnique.mockResolvedValueOnce(row({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(resolveMcpPrincipal("tok")).resolves.toBeNull();

    findUnique.mockResolvedValueOnce(row({ client: { disabled: true, name: "Claude" } }));
    await expect(resolveMcpPrincipal("tok")).resolves.toBeNull();

    findUnique.mockResolvedValueOnce(row({ user: { deactivatedAt: new Date() } }));
    await expect(resolveMcpPrincipal("tok")).resolves.toBeNull();

    findUnique.mockResolvedValueOnce(row({ userId: null, user: null }));
    await expect(resolveMcpPrincipal("tok")).resolves.toBeNull();
  });

  it("doesn't touch the database without a token", async () => {
    await expect(resolveMcpPrincipal(null)).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
