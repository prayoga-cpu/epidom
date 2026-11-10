import { prisma } from "@/lib/prisma";
import { normalizeRefCode } from "@/lib/attribution/cookies";
import { getReferralBanner, resolveSignupPartner } from "@/lib/services/partner.service";

/**
 * A partner's code typed during setup (/onboarding) instead of arriving through
 * their ?ref= link. It credits the account exactly like the link would: the
 * partner's deal is copied onto the account's SignupAttribution and the same
 * one-time % off applies to the first paid invoice.
 *
 * Only an account no partner is credited with can use one, and only once: the
 * attribution is "written once, credit locked forever".
 */

export interface ReferralCodePreview {
  code: string;
  displayName: string;
  discountPercent: number;
}

/** What the wizard shows while the code is typed: null for an unknown, paused or ended code. */
export async function previewReferralCode(raw: string): Promise<ReferralCodePreview | null> {
  const code = normalizeRefCode(raw);
  if (!code) return null;
  const banner = await getReferralBanner(code).catch(() => null);
  return banner ? { code, ...banner } : null;
}

/** The partner this account is already credited to, with its discount: no code field then. */
export async function getCreditedReferral(
  userId: string
): Promise<{ code: string; displayName: string; discountPercent: number } | null> {
  const row = await prisma.signupAttribution.findUnique({
    where: { userId },
    select: {
      refCode: true,
      discountPercent: true,
      discountRedeemedAt: true,
      partner: { select: { displayName: true, status: true } },
    },
  });
  if (!row?.partner || row.partner.status === "ENDED" || row.discountRedeemedAt) return null;
  const percent = Number(row.discountPercent ?? 0);
  return percent > 0
    ? { code: row.refCode ?? "", displayName: row.partner.displayName, discountPercent: percent }
    : null;
}

/**
 * Credit the account to the code's partner. Never throws and never blocks
 * publishing: a bad code, a self-referral or an already-credited account just
 * returns false.
 */
export async function applyReferralCode(
  user: { id: string; email: string },
  raw: string
): Promise<boolean> {
  try {
    const code = normalizeRefCode(raw);
    if (!code) return false;
    const existing = await prisma.signupAttribution.findUnique({
      where: { userId: user.id },
      select: { partnerId: true },
    });
    if (existing?.partnerId) return false;

    const now = new Date();
    const credit = await resolveSignupPartner(
      { source: "REFERRAL_LINK", refCode: code, salesPage: null },
      user,
      null,
      now
    );
    if (!credit) return false;

    const fields = {
      source: "REFERRAL_CODE" as const,
      sourceAt: now,
      refCode: code,
      salesPage: null,
      salesPageLocale: null,
      partnerId: credit.partnerId,
      commissionRate: credit.commissionRate,
      commissionMonths: credit.commissionMonths,
      discountPercent: credit.discountPercent,
      selfReferralFlag: credit.selfReferralFlag,
    };
    if (existing) {
      // Conditional on still having no partner: two tabs can't both credit.
      const { count } = await prisma.signupAttribution.updateMany({
        where: { userId: user.id, partnerId: null },
        data: fields,
      });
      return count > 0;
    }
    await prisma.signupAttribution.create({ data: { userId: user.id, ...fields } });
    return true;
  } catch (err) {
    console.error("[referral-code] failed to apply the code:", err);
    return false;
  }
}

/**
 * Credits the signed-in account to a code now, ahead of publishing: a plan
 * paid for first (setup's plan screen opens Checkout before the store exists)
 * reads the credit when it prices the first invoice. Same rules as
 * applyReferralCode; false when it could not be credited.
 */
export async function claimReferralCode(userId: string, raw: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  return user ? applyReferralCode(user, raw) : false;
}
