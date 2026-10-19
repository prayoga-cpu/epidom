import { prisma } from "@/lib/prisma";
import { attributionFromCookieHeader } from "@/lib/attribution/cookies";
import { resolveSignupPartner } from "@/lib/services/partner.service";

/** The visitor's IP from the platform's headers (Vercel sets x-real-ip / x-forwarded-for). */
export function requestIp(headers: Headers | null | undefined): string | null {
  if (!headers) return null;
  return (
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

/**
 * Record where a just-created account came from: the last referral link or
 * sales page its browser opened, and the last ad's campaign tags, read from
 * the cookies on the sign-up request (the email sign-up POST, or Google's
 * OAuth callback). See src/lib/attribution/cookies.ts.
 *
 * When that link or page belongs to an active partner, the account is
 * credited to them with their deal as it is now (src/lib/services/partner.service.ts).
 *
 * Every new account gets a row, so "came in directly" is countable too. It is
 * written once and never changed. Never throws: a tracking failure must not
 * fail a sign-up.
 */
export async function recordSignupAttribution(
  user: { id: string; email: string },
  cookieHeader: string | null | undefined,
  ip: string | null = null
): Promise<void> {
  try {
    const data = attributionFromCookieHeader(cookieHeader);
    const credit = await resolveSignupPartner(data, user, ip).catch((err) => {
      console.error("[attribution] failed to resolve the partner:", err);
      return null;
    });
    await prisma.signupAttribution.create({
      data: {
        userId: user.id,
        ...data,
        ...(credit
          ? {
              partnerId: credit.partnerId,
              commissionRate: credit.commissionRate,
              commissionMonths: credit.commissionMonths,
              discountPercent: credit.discountPercent,
              selfReferralFlag: credit.selfReferralFlag,
            }
          : {}),
      },
    });
  } catch (err) {
    console.error("[attribution] failed to record signup:", err);
  }
}
