import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins/email-otp";
import { oauthProvider } from "@better-auth/oauth-provider";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { createHmac, timingSafeEqual } from "crypto";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/services/email.service";
import { isAdminEmail } from "@/lib/admin";
import { recordSalesPageSignup } from "@/lib/services/sales-page.service";
import { recordSignupAttribution, requestIp } from "@/lib/services/signup-attribution.service";
import {
  previewAuthCookiePrefix,
  resolveCrossSubDomainCookies,
  sessionCookieNames,
} from "@/lib/auth/cookies";
import {
  DISABLED_EMAIL_OTP_PATHS,
  EMAIL_CODE_ALLOWED_ATTEMPTS,
  EMAIL_CODE_LENGTH,
  EMAIL_VERIFICATION_EXPIRES_IN,
} from "@/lib/auth/email-verification-code";
import { configuredAppUrl, servingAppUrl } from "@/lib/app-url";
import {
  OAUTH_CONSENT_PAGE,
  OAUTH_PROVIDER_SCOPES,
  OAUTH_SIGN_IN_PAGE,
  mcpResourceUrl,
} from "@/lib/mcp/config";
import { admitLocalhostPortForClient } from "@/lib/mcp/loopback-redirect";

/**
 * In production, share auth cookies (incl. the OAuth `state` cookie) across the
 * apex + www of the real domain, so a www <-> apex hop during the Google OAuth
 * round-trip doesn't drop the state cookie (the "state_mismatch" error). A
 * preview on a sibling subdomain (dev.epidom.fr) stays host-only and uses its
 * own cookie prefix. See src/lib/auth/cookies.ts.
 */
const crossSubDomainCookies = resolveCrossSubDomainCookies(
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NODE_ENV
);
const previewCookiePrefix = previewAuthCookiePrefix(process.env.VERCEL_ENV);

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  // The host that serves without a redirect (www.epidom.fr in production, not
  // the configured apex): the OAuth provider below advertises its issuer and
  // endpoints from this, and Claude won't follow the apex → www redirect.
  baseURL: servingAppUrl(),
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
    ...(previewCookiePrefix ? { cookiePrefix: previewCookiePrefix } : {}),
    ...(crossSubDomainCookies ? { crossSubDomainCookies } : {}),
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
    // Covers the code too: entering it signs the person in, like the link.
    autoSignInAfterVerification: true,
    expiresIn: EMAIL_VERIFICATION_EXPIRES_IN,
    sendVerificationEmail: async ({ user, url }) => {
      // One email, two ways in: the link and a 6-digit code (see
      // src/lib/auth/email-verification-code.ts). Better Auth only sends this
      // for unverified accounts; the check keeps it that way should a future
      // flow (changing a verified address) reuse this hook, since the code
      // signs in whoever owns the address it was made for.
      const code = user.emailVerified ? null : await createEmailVerificationCode(user.email);
      const result = await sendVerificationEmail(user.email, user.name, url, code);
      if (!result.success) {
        throw new Error(`Failed to send verification email: ${result.error}`);
      }
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      // Pinned to the configured URL, not baseURL: this is the callback the
      // Google OAuth client has registered (the www one is not), and the
      // apex → www hop it takes is covered by the shared cookies above.
      redirectURI: `${configuredAppUrl()}/api/auth/callback/google`,
    },
  },
  // Only /email-otp/verify-email stays open from the plugin below.
  disabledPaths: DISABLED_EMAIL_OTP_PATHS,
  plugins: [
    emailOTP({
      otpLength: EMAIL_CODE_LENGTH,
      expiresIn: EMAIL_VERIFICATION_EXPIRES_IN,
      allowedAttempts: EMAIL_CODE_ALLOWED_ATTEMPTS,
      // Only a hash is kept, so a database read does not hand out codes.
      storeOTP: "hashed",
      // The code goes out inside the verification email above. Everything
      // that would call this plugin mailer is in disabledPaths, so reaching
      // it means a path was re-enabled without a decision: fail loudly
      // rather than answer "sent" for an email that never went out.
      sendVerificationOTP: async ({ type }) => {
        throw new Error(`[auth] email codes of type "${type}" are not sent on their own`);
      },
    }),
    // The Claude connector: Epidom is the OAuth 2.1 authorization server a
    // user's Claude signs in to before calling /api/mcp (docs/MCP.md).
    oauthProvider({
      loginPage: OAUTH_SIGN_IN_PAGE,
      consentPage: OAUTH_CONSENT_PAGE,
      scopes: OAUTH_PROVIDER_SCOPES,
      clientRegistrationDefaultScopes: OAUTH_PROVIDER_SCOPES,
      validAudiences: [mcpResourceUrl()],
      // Claude registers itself (RFC 7591) from Anthropic's servers, with no
      // Epidom session: it is a public client and proves itself with PKCE.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      grantTypes: ["authorization_code", "refresh_token"],
      // Opaque tokens, stored hashed: /api/mcp checks each one against the
      // database, so revoking a connection takes effect on the next call.
      disableJwtPlugin: true,
      accessTokenExpiresIn: 60 * 60,
      refreshTokenExpiresIn: 60 * 60 * 24 * 30,
      // Accounts may register clients (MCP Inspector does so with the
      // browser's cookies), never manage them through the plugin: a
      // connection is listed and revoked from Profile (/api/user/connected-apps).
      clientPrivileges: ({ action }) => action === "create",
      // /.well-known/oauth-authorization-server/api/auth is served by
      // src/app/.well-known/oauth-authorization-server.
      silenceWarnings: { oauthAuthServerConfig: true },
    }),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/oauth2/authorize") {
        await admitLocalhostPortForClient(
          ctx.query?.client_id as string | undefined,
          ctx.query?.redirect_uri as string | undefined
        );
      }
    }),
  },
  session: {
    additionalFields: {
      location: {
        type: "string",
        required: false,
        defaultValue: null,
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        async before(session, context) {
          const headers = context?.headers ?? context?.request?.headers;
          if (!headers) return { data: session };
          const rawCity = headers.get("x-vercel-ip-city");
          const rawCountry = headers.get("x-vercel-ip-country");
          if (!rawCity && !rawCountry) return { data: session };
          try {
            const city = rawCity ? decodeURIComponent(rawCity) : null;
            const country = rawCountry
              ? new Intl.DisplayNames(["en"], { type: "region" }).of(rawCountry) ?? rawCountry
              : null;
            const location = [city, country].filter(Boolean).join(", ") || null;
            return { data: { ...session, location } };
          } catch {
            return { data: session };
          }
        },
      },
    },
    user: {
      create: {
        async after(user, context) {
          if (isAdminEmail(user.email)) {
            await prisma.user
              .update({
                where: { id: user.id },
                data: { isAdmin: true },
              })
              .catch((err) => console.error("[auth] failed to set isAdmin on master email:", err));
          }
          // Credit the signup to the /sales-page-N this browser came from, if
          // any, and record where it came from (referral link, sales page, ad
          // tags). The email signup POST and Google's OAuth callback both carry
          // the cookies; a server-side create has no request, so no-op.
          const cookieHeader =
            context?.headers?.get("cookie") ?? context?.request?.headers.get("cookie");
          await recordSalesPageSignup(user.id, cookieHeader);
          const requestHeaders = context?.headers ?? context?.request?.headers;
          if (requestHeaders) {
            await recordSignupAttribution(
              { id: user.id, email: user.email },
              cookieHeader,
              requestIp(requestHeaders)
            );
          }
        },
      },
    },
  },
});

/**
 * Makes and stores the 6-digit code for the verification email. A new code
 * replaces the previous one. If it cannot be made, the email still goes out
 * with the link alone instead of blocking signup.
 *
 * The explicit return type matters: `auth` is used inside its own config
 * through this function, and an inferred type would make TypeScript chase
 * that loop.
 */
async function createEmailVerificationCode(email: string): Promise<string | null> {
  try {
    return await auth.api.createVerificationOTP({
      body: { email, type: "email-verification" },
    });
  } catch (error) {
    console.error("[auth] could not create the email verification code, sending the link only:", error);
    return null;
  }
}

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

    // Get the session token from cookie (check both standard and secure names).
    // The names come from the same module as Better Auth's cookie prefix, so a
    // preview reads its own cookie and never production's `.epidom.fr` one.
    const [plainCookieName, secureCookieName] = sessionCookieNames(process.env.VERCEL_ENV);
    const sessionTokenCookie =
      cookieStore.get(plainCookieName)?.value || cookieStore.get(secureCookieName)?.value;

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
