import { prisma } from "@/lib/prisma";

/**
 * Claude Code signs in through a loopback redirect on a random port that
 * changes every session (RFC 8252), e.g. http://localhost:3118/callback, while
 * it keeps the client it registered on the first sign-in. The OAuth provider
 * ignores the port only for IP literals (127.0.0.1, ::1); for `localhost` it
 * wants an exact match, so the second sign-in would fail with "invalid
 * redirect uri". This admits the new port for a client that already
 * registered the same localhost callback.
 */

function asLocalhost(uri: string): URL | null {
  try {
    const url = new URL(uri);
    return url.protocol === "http:" && url.hostname === "localhost" ? url : null;
  } catch {
    return null;
  }
}

/** Same localhost callback (scheme, path, query), on any port. */
function sameLocalhostCallback(a: URL, b: URL): boolean {
  return a.pathname === b.pathname && a.search === b.search;
}

/**
 * The redirect URIs to store when `requested` is a localhost callback the
 * client registered on another port, or null when nothing should change. The
 * old port is replaced rather than kept: it was that session's, and keeping
 * every port would grow the list with each sign-in.
 */
export function admitLocalhostPort(registered: string[], requested: string): string[] | null {
  if (registered.includes(requested)) return null;
  const wanted = asLocalhost(requested);
  if (!wanted) return null;

  const matches = (uri: string) => {
    const url = asLocalhost(uri);
    return url !== null && sameLocalhostCallback(url, wanted);
  };
  if (!registered.some(matches)) return null;
  return [...registered.filter((uri) => !matches(uri)), requested];
}

/** Runs before /oauth2/authorize: see admitLocalhostPort. */
export async function admitLocalhostPortForClient(
  clientId: string | undefined,
  requested: string | undefined
): Promise<void> {
  if (!clientId || !requested || !asLocalhost(requested)) return;
  const client = await prisma.oauthClient.findUnique({
    where: { clientId },
    select: { redirectUris: true },
  });
  if (!client) return;
  const next = admitLocalhostPort(client.redirectUris, requested);
  if (!next) return;
  await prisma.oauthClient.update({ where: { clientId }, data: { redirectUris: next } });
}
