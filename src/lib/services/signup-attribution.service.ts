import { prisma } from "@/lib/prisma";
import { attributionFromCookieHeader } from "@/lib/attribution/cookies";

/**
 * Record where a just-created account came from: the last referral link or
 * sales page its browser opened, and the last ad's campaign tags, read from
 * the cookies on the sign-up request (the email sign-up POST, or Google's
 * OAuth callback). See src/lib/attribution/cookies.ts.
 *
 * Every new account gets a row, so "came in directly" is countable too. It is
 * written once and never changed. Never throws: a tracking failure must not
 * fail a sign-up.
 */
export async function recordSignupAttribution(
  userId: string,
  cookieHeader: string | null | undefined
): Promise<void> {
  try {
    await prisma.signupAttribution.create({
      data: { userId, ...attributionFromCookieHeader(cookieHeader) },
    });
  } catch (err) {
    console.error("[attribution] failed to record signup:", err);
  }
}
