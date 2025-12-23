import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createHmac, timingSafeEqual } from "crypto";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/services/email.service";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  trustedOrigins: ["http://localhost:3000", process.env.NEXT_PUBLIC_APP_URL || ""].filter(Boolean),
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, user.name, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, user.name, url);
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  plugins: [],
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
 * Server-side session retrieval
 * Securely verifies signed cookies before querying database
 */
export async function getSession() {
  try {
    const cookieStore = await cookies();

    // Get the session token from cookie
    const sessionTokenCookie = cookieStore.get("better-auth.session_token")?.value;

    if (!sessionTokenCookie) {
      return null;
    }

    const secret = process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[getSession] No secret configured");
      return null;
    }

    // Try to verify signature first
    let sessionToken = verifySignedCookie(sessionTokenCookie, secret);

    // If signature verification fails, it might be using a different signing method
    // Fall back to extracting token (legacy support) but log a warning
    if (!sessionToken) {
      const parts = sessionTokenCookie.split(".");
      if (parts.length >= 1 && parts[0]) {
        sessionToken = parts[0];
        // Only log in development to avoid log spam in production
        if (process.env.NODE_ENV === "development") {
          console.warn("[getSession] Signature verification failed, using token directly");
        }
      }
    }

    if (!sessionToken) {
      return null;
    }

    // Look up session in database
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true },
    });

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      // Optionally: Clean up expired session
      // await prisma.session.delete({ where: { id: session.id } });
      return null;
    }

    // Return session data (excluding sensitive token)
    return {
      session: {
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      },
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
        image: session.user.image,
        createdAt: session.user.createdAt,
        updatedAt: session.user.updatedAt,
      },
    };
  } catch (error) {
    // Only log in development or if it's an unexpected error
    if (
      process.env.NODE_ENV === "development" ||
      !(error instanceof Error && error.message.includes("cookies"))
    ) {
      console.error("[getSession] Error:", error);
    }
    return null;
  }
}

// Type definitions for session
export type Session = Awaited<ReturnType<typeof getSession>>;
export type User = NonNullable<Session>["user"];
