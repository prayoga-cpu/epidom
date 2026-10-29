import { prisma } from "@/lib/prisma";

/**
 * Claude registers a new OAuth client (RFC 7591, no sign-in needed) every time
 * someone starts connecting, so abandoned attempts leave client rows behind.
 * Each new registration clears out the ones that never led anywhere: created
 * by registration (no owning account), older than a week, and with no
 * consent and no token. A client someone actually connected keeps its rows
 * until they revoke it.
 *
 * Runs on registration rather than on a schedule: it needs no job runner, and
 * the table only grows when registrations happen.
 */
export const ABANDONED_CLIENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function pruneAbandonedOauthClients(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.oauthClient.deleteMany({
    where: {
      userId: null,
      createdAt: { lt: new Date(now.getTime() - ABANDONED_CLIENT_AGE_MS) },
      consents: { none: {} },
      accessTokens: { none: {} },
      refreshTokens: { none: {} },
    },
  });
  return count;
}
