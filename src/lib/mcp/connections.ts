import { prisma } from "@/lib/prisma";
import { MCP_SCOPE_WRITE } from "./config";

/** One Claude (or other MCP client) connection an account has allowed. */
export interface ConnectedApp {
  clientId: string;
  name: string | null;
  canWrite: boolean;
  connectedAt: string | null;
  lastUsedAt: string | null;
}

/**
 * The connections `userId` has consented to, newest first, with when each
 * last called a tool. One row per OAuth client: Claude registers a new client
 * for each connection it makes.
 */
export async function listConnectedApps(userId: string): Promise<ConnectedApp[]> {
  const consents = await prisma.oauthConsent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      clientId: true,
      scopes: true,
      createdAt: true,
      client: { select: { name: true } },
    },
  });
  if (consents.length === 0) return [];

  const lastUse = await prisma.mcpToolCall.groupBy({
    by: ["clientId"],
    where: { userId, clientId: { in: consents.map((c) => c.clientId) } },
    _max: { createdAt: true },
  });
  const lastUsed = new Map(lastUse.map((row) => [row.clientId, row._max.createdAt]));

  return consents.map((consent) => ({
    clientId: consent.clientId,
    name: consent.client.name ?? null,
    canWrite: consent.scopes.includes(MCP_SCOPE_WRITE),
    connectedAt: consent.createdAt?.toISOString() ?? null,
    lastUsedAt: lastUsed.get(consent.clientId)?.toISOString() ?? null,
  }));
}

/**
 * End a connection: its tokens stop working on the next call (/api/mcp
 * checks every token against the database) and its refresh token can't
 * mint new ones. The consent goes too, so reconnecting asks again.
 *
 * @returns whether there was anything of this account's to revoke.
 */
export async function revokeConnectedApp(userId: string, clientId: string): Promise<boolean> {
  const [access, refresh, consent] = await prisma.$transaction([
    prisma.oauthAccessToken.deleteMany({ where: { userId, clientId } }),
    prisma.oauthRefreshToken.deleteMany({ where: { userId, clientId } }),
    prisma.oauthConsent.deleteMany({ where: { userId, clientId } }),
  ]);
  return access.count + refresh.count + consent.count > 0;
}
