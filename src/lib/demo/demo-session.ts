import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { resolveCrossSubDomainCookies, sessionCookieNames } from "@/lib/auth/cookies";
import { DEMO_TOKEN_PREFIX } from "./demo-constants";

/** A demo visit lasts this long; the session row and the cookie both expire with it. */
export const DEMO_SESSION_MS = 3 * 60 * 60 * 1000;

/**
 * Starts a session on the demo account without a password. Better Auth's own
 * cookie format is the token plus an HMAC-SHA256 signature of it, URL-encoded once;
 * the app's getSession() verifies exactly that. The token's "demo_" prefix is
 * what lets src/proxy.ts refuse every write from this session.
 */
export async function createDemoSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null }
): Promise<{ cookieName: string; value: string; options: Record<string, unknown> }> {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");

  const now = new Date();
  // Housekeeping: yesterday's demo sessions go with this one.
  await prisma.session.deleteMany({
    where: { token: { startsWith: DEMO_TOKEN_PREFIX }, expiresAt: { lt: now } },
  });

  const token = DEMO_TOKEN_PREFIX + randomBytes(24).toString("base64url");
  const expiresAt = new Date(now.getTime() + DEMO_SESSION_MS);
  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      ipAddress: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });

  const signature = createHmac("sha256", secret).update(token).digest("base64");
  const secure = process.env.NODE_ENV === "production";
  const [plain, securePrefixed] = sessionCookieNames(process.env.VERCEL_ENV);
  const crossSub = resolveCrossSubDomainCookies(
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NODE_ENV
  );
  return {
    cookieName: secure ? securePrefixed : plain,
    // Raw: Next's cookie writer URL-encodes it once, as Better Auth does.
    value: `${token}.${signature}`,
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      expires: expiresAt,
      ...(crossSub ? { domain: crossSub.domain } : {}),
    },
  };
}
