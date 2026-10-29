import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Who is calling /api/mcp: the account a Claude connection signed in as.
 *
 * The cookie-based guards (getSession, getStoreViewer, the staff PIN persona)
 * can't see a Claude call: it carries a bearer token and no cookies. This is
 * the connector's own identity, resolved from the OAuth access token.
 */
export interface McpPrincipal {
  userId: string;
  /** The OAuth client (one per Claude connection, registered by Claude). */
  clientId: string;
  /** What the client called itself at registration, e.g. "Claude". */
  clientName: string | null;
  scopes: string[];
}

/**
 * How @better-auth/oauth-provider stores tokens with `storeTokens: "hashed"`
 * (its default): SHA-256, base64url without padding. Kept in step with the
 * plugin by src/lib/mcp/__tests__/principal.test.ts.
 */
export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

/** "Bearer <token>" → token, or null. */
export function readBearerToken(authorization: string | null | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
  return match?.[1] ?? null;
}

/**
 * The principal for an access token, or null when the token is unknown,
 * expired, belongs to a disabled client, or to an account that has been
 * deactivated. The same rules as the plugin's own introspection, read straight
 * from the database: no network hop, and a revoked connection (its rows
 * deleted) stops working on its next call.
 */
export async function resolveMcpPrincipal(token: string | null): Promise<McpPrincipal | null> {
  if (!token) return null;

  const row = await prisma.oauthAccessToken.findUnique({
    where: { token: hashAccessToken(token) },
    select: {
      userId: true,
      clientId: true,
      scopes: true,
      expiresAt: true,
      client: { select: { disabled: true, name: true } },
      user: { select: { deactivatedAt: true } },
    },
  });

  if (!row?.userId || !row.user) return null;
  if (!row.expiresAt || row.expiresAt.getTime() <= Date.now()) return null;
  if (row.client.disabled) return null;
  if (row.user.deactivatedAt) return null;

  return {
    userId: row.userId,
    clientId: row.clientId,
    clientName: row.client.name ?? null,
    scopes: row.scopes,
  };
}
