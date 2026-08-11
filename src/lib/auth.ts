import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { createHmac, timingSafeEqual } from "crypto";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/services/email.service";
import { isAdminEmail } from "@/lib/admin";

/**
 * In production, share auth cookies (incl. the OAuth `state` cookie) across the
 * apex + www of the real domain, so a www <-> apex hop during the Google OAuth
 * round-trip doesn't drop the state cookie (the "state_mismatch" error).
 * Skipped for localhost and *.vercel.app (where a custom cookie domain would
 * break cookies entirely).
 */
function getCrossSubDomainCookies(): { enabled: boolean; domain: string } | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;
  try {
    const host = new URL(process.env.NEXT_PUBLIC_APP_URL || "").hostname;
    if (!host || host === "localhost" || host.endsWith(".vercel.app")) return undefined;
    const parts = host.split(".");
    const root = parts.length >= 2 ? parts.slice(-2).join(".") : host;
    return { enabled: true, domain: `.${root}` };
  } catch {
    return undefined;
  }
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  trustedOrigins: [
    "http://localhost:3000",
    "https://epidom.fr",
    "https://www.epidom.fr",
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
  ].filter((v): v is string => Boolean(v)),
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    ...(getCrossSubDomainCookies() ? { crossSubDomainCookies: getCrossSubDomainCookies() } : {}),
  },
  onAPIError: {
    // Redirect OAuth errors to the login page instead of Better Auth's raw HTML error page
    errorURL: "/login",
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const result = await sendPasswordResetEmail(user.email, user.name, url);
      if (!result.success) {
        throw new Error(`Failed to send password reset email: ${result.error}`);
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const result = await sendVerificationEmail(user.email, user.name, url);
      if (!result.success) {
        throw new Error(`Failed to send verification email: ${result.error}`);
      }
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  plugins: [],
  databaseHooks: {
    user: {
      create: {
        async after(user) {
          if (isAdminEmail(user.email)) {
            await prisma.user
              .update({
                where: { id: user.id },
                data: { isAdmin: true },
              })
              .catch((err) => console.error("[auth] failed to set isAdmin on master email:", err));
          }
        },
      },
    },
  },
});

/**
 * Verify signed cookie signature
 * Better-auth uses HMAC-SHA256 for cookie signing
 */
function verifySignedCookie(signedValue: string, secret: string): string | null {
  const parts = signedValue.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [token, signature] = parts;

  // Recreate the signature
  const expectedSignature = createHmac("sha256", secret).update(token).digest("base64url");

  // Use timing-safe comparison to prevent timing attacks
  try {
    const sigBuffer = Buffer.from(signature, "base64url");
    const expectedBuffer = Buffer.from(expectedSignature, "base64url");

    if (sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer)) {
      return token;
    }
  } catch {
    // Invalid base64 or comparison failed
  }

  return null;
}

/**
 * Postgres/Prisma failures that mean "the database was momentarily out of
 * reach", not "this query has no answer". Serverless Postgres (Neon) drops
 * idle pooled connections and cold-starts compute, so a `pg` pool that has
 * been sitting idle between two POS actions can hand back a dead client on
 * the first query and a perfectly good one on the retry.
 */
const TRANSIENT_DB_ERROR_CODES = new Set([
  // Prisma: unreachable / timed out / server closed the connection / pool timeout
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
  // Node socket errors surfaced straight through by the pg driver
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  // Postgres class 08 (connection exception) + admin-initiated disconnects
  "08000",
  "08001",
  "08003",
  "08006",
  "57P01",
  "57P03",
]);

const TRANSIENT_DB_MESSAGES = [
  "connection terminated",
  "connection closed",
  "not queryable",
  "socket hang up",
  "timed out fetching a new connection",
  "can't reach database server",
  "server has closed the connection",
  "connection reset by peer",
];

function isTransientDbError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && TRANSIENT_DB_ERROR_CODES.has(code)) return true;

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return TRANSIENT_DB_MESSAGES.some((fragment) => message.includes(fragment));
}

const SESSION_LOOKUP_ATTEMPTS = 3;
/** One entry per retry, so the last attempt falls through instead of sleeping. */
const SESSION_LOOKUP_BACKOFF_MS = [60, 180];

/**
 * Resolve a session token against the database, retrying the transient
 * connection failures above. Anything else (and a still-failing transient
 * error) propagates — the caller turns that into "session state unknown",
 * which is emphatically not the same thing as "not signed in".
 */
async function lookupSessionByToken(sessionToken: string) {
  for (let attempt = 0; attempt < SESSION_LOOKUP_ATTEMPTS; attempt++) {
    try {
      return await prisma.session.findUnique({
        where: { token: sessionToken },
        include: { user: true },
      });
    } catch (error) {
      if (!isTransientDbError(error)) throw error;

      const backoff = SESSION_LOOKUP_BACKOFF_MS[attempt];
      if (backoff === undefined) throw error;
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  // Unreachable — the loop either returns or throws on its last iteration.
  return null;
}

export interface SessionResult {
  session: Session;
  /**
   * The request carried a session cookie but we couldn't resolve it because
   * the database was unreachable. Callers must NOT read this as "signed
   * out": answering 401 here logs a working cashier out mid-checkout over a
   * transient blip. Answer 503 and let them retry instead.
   */
  unavailable: boolean;
}

/**
 * Server-side session retrieval
 * Securely verifies signed cookies before querying database
 *
 * Splits the two failure modes that used to collapse into a bare `null`:
 * a missing/invalid/expired cookie (genuinely signed out) versus a failed
 * database lookup (unknown). Conflating them is what turned a momentary Neon
 * hiccup into a mid-checkout "Unauthorized" on the POS.
 */
export const getSessionResult = cache(async function getSessionResult(): Promise<SessionResult> {
  let sessionToken: string | null = null;

  try {
    const cookieStore = await cookies();

    // Get the session token from cookie (check both standard and secure names)
    const sessionTokenCookie =
      cookieStore.get("better-auth.session_token")?.value ||
      cookieStore.get("__Secure-better-auth.session_token")?.value;

    if (!sessionTokenCookie) {
      return { session: null, unavailable: false };
    }

    const secret = process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[getSession] No secret configured");
      return { session: null, unavailable: false };
    }

    // Try to verify signature first
    let token = verifySignedCookie(sessionTokenCookie, secret);

    // If signature verification fails, it might be using a different signing method
    // Fall back to extracting token (legacy support) but log a warning
    if (!token) {
      const parts = sessionTokenCookie.split(".");
      if (parts.length >= 1 && parts[0]) {
        token = parts[0];
        // Only log in development to avoid log spam in production
        if (process.env.NODE_ENV === "development") {
          console.warn("[getSession] Signature verification failed, using token directly");
        }
      }
    }

    sessionToken = token;
  } catch (error) {
    // Reading/parsing the cookie failed — most often `cookies()` called
    // outside a request scope. Nothing here says anything about the database,
    // so this stays a plain "no session".
    if (
      process.env.NODE_ENV === "development" ||
      !(error instanceof Error && error.message.includes("cookies"))
    ) {
      console.error("[getSession] Error:", error);
    }
    return { session: null, unavailable: false };
  }

  if (!sessionToken) {
    return { session: null, unavailable: false };
  }

  let row: Awaited<ReturnType<typeof lookupSessionByToken>>;
  try {
    row = await lookupSessionByToken(sessionToken);
  } catch (error) {
    // We had a token and couldn't check it. Reporting "signed out" here is a
    // lie that costs a cashier their in-progress checkout, so say so plainly
    // and let the caller answer 503.
    console.error("[getSession] Session lookup failed:", error);
    return { session: null, unavailable: true };
  }

  if (!row) {
    return { session: null, unavailable: false };
  }

  // Check if session is expired
  if (new Date() > row.expiresAt) {
    // Optionally: Clean up expired session
    // await prisma.session.delete({ where: { id: session.id } });
    return { session: null, unavailable: false };
  }

  return { session: toSessionPayload(row), unavailable: false };
});

/** Session data as callers see it — deliberately excludes the session token. */
function toSessionPayload(row: NonNullable<Awaited<ReturnType<typeof lookupSessionByToken>>>) {
  return {
    session: {
      id: row.id,
      userId: row.userId,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
    },
    user: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      emailVerified: row.user.emailVerified,
      image: row.user.image,
      createdAt: row.user.createdAt,
      updatedAt: row.user.updatedAt,
      deactivatedAt: row.user.deactivatedAt,
    },
  };
}

/**
 * The session, or null when there isn't one. Unchanged contract — it still
 * collapses "signed out" and "couldn't reach the database" into null, which
 * is the right trade for the ~70 read-only call sites (a server component
 * rendering a signed-out shell during a blip is survivable). Mutating API
 * routes should prefer `requireSessionApi`, which keeps the two apart.
 */
export const getSession = cache(async function getSession() {
  return (await getSessionResult()).session;
});

// Type definitions for session
// Derived from toSessionPayload rather than from getSession's return type:
// SessionResult already names Session, so keying it off getSession (which is
// now defined in terms of SessionResult) would be circular. Same resolved
// shape either way, so every existing consumer is unaffected.
export type Session = ReturnType<typeof toSessionPayload> | null;
export type User = NonNullable<Session>["user"];
