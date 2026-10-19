import { Prisma, type PartnerStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api/responses";
import { logger } from "@/lib/logger";
import { SALES_PAGES } from "@/lib/sales-pages";
import type { SignupAttributionData } from "@/lib/attribution/cookies";
import {
  getSalesPageReport,
  signupPlanStatus,
  type SignupPlanStatus,
} from "@/lib/services/sales-page.service";
import type { SalesPageReportRange } from "@/lib/validation/sales-page.schemas";
import { backfillCustomerCommissions } from "@/lib/services/partner-commission.service";
import {
  decimalStringToStripeAmount,
  stripeAmountToDecimalString,
} from "@/lib/money/stripe-amount";
import type {
  CreatePartnerInput,
  RecordPayoutInput,
  SetPartnerSalesPagesInput,
  UpdatePartnerInput,
} from "@/lib/validation/partner.schemas";

/**
 * Partner deals (docs/BILLING.md → Partners & commissions).
 *
 * A partner is an Epidom account paid a share of what the customers they
 * bring pay: through their referral link (`?ref=CODE` on /register or the
 * home page) or by owning sales pages. Which one brought a customer is
 * decided once, at sign-up (src/lib/attribution/cookies.ts), and so is the
 * deal: later edits apply to new sign-ups only.
 */

// ------------------------------------------------------------------ helpers

/** Same mailbox: lower case, no "+tag", and no dots for Gmail. */
export function normalizeEmail(email: string): string {
  const [rawLocal = "", rawDomain = ""] = email.trim().toLowerCase().split("@");
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;
  let local = rawLocal.split("+")[0];
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

const cents = (value: Prisma.Decimal | string | number) =>
  decimalStringToStripeAmount(value.toString(), "eur");
const fromCents = (value: number) => stripeAmountToDecimalString(value, "eur");

export interface CurrencyTotals {
  currency: string;
  /** Waiting for the 30-day hold. */
  onHold: string;
  /** Hold over, not paid out yet (adjustments included). */
  ready: string;
  paid: string;
}

/** Pure: ledger rows summed per currency, never across currencies. */
export function totalsByCurrency(
  rows: { currency: string; amount: Prisma.Decimal | string; status: string; payableAt: Date }[],
  now: Date = new Date()
): CurrencyTotals[] {
  const by = new Map<string, { onHold: number; ready: number; paid: number }>();
  for (const r of rows) {
    if (r.status === "VOID") continue;
    const t = by.get(r.currency) ?? { onHold: 0, ready: 0, paid: 0 };
    const amount = cents(r.amount);
    if (r.status === "PAID") t.paid += amount;
    else if (r.payableAt <= now) t.ready += amount;
    else t.onHold += amount;
    by.set(r.currency, t);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, t]) => ({
      currency,
      onHold: fromCents(t.onHold),
      ready: fromCents(t.ready),
      paid: fromCents(t.paid),
    }));
}

function notFound(): never {
  throw new AppError("Partner not found", ApiErrorCode.NOT_FOUND, 404);
}

function refuseOwnDeal(partnerUserId: string | null, actorId: string): void {
  if (partnerUserId && partnerUserId === actorId) {
    throw new AppError("You can't change your own partner deal", ApiErrorCode.FORBIDDEN, 403);
  }
}

async function assertCodeFree(code: string | null | undefined, exceptPartnerId?: string) {
  if (!code) return;
  const taken = await prisma.partner.findUnique({
    where: { referralCode: code },
    select: { id: true },
  });
  if (taken && taken.id !== exceptPartnerId) {
    throw new AppError(
      `The code ${code} is already used by another partner`,
      ApiErrorCode.CONFLICT,
      409
    );
  }
}

// --------------------------------------------------------- at sign-up time

export interface SignupPartnerCredit {
  partnerId: string;
  commissionRate: Prisma.Decimal;
  commissionMonths: number;
  discountPercent: Prisma.Decimal | null;
  selfReferralFlag: boolean;
}

/**
 * The partner a new account is credited to, from where it signed up: an
 * ACTIVE partner's referral code, or the ACTIVE owner of the sales page (from
 * the page's "credit from" date). Never the partner's own mailbox; a sign-up
 * from an IP the partner has signed in from is credited but flagged.
 */
export async function resolveSignupPartner(
  data: Pick<SignupAttributionData, "source" | "refCode" | "salesPage">,
  user: { id: string; email: string },
  ip: string | null,
  now: Date = new Date()
): Promise<SignupPartnerCredit | null> {
  let partner: {
    id: string;
    userId: string | null;
    commissionRate: Prisma.Decimal;
    commissionMonths: number;
    customerDiscountPercent: Prisma.Decimal;
    user: { email: string } | null;
  } | null = null;
  let viaLink = false;

  const select = {
    id: true,
    userId: true,
    status: true,
    commissionRate: true,
    commissionMonths: true,
    customerDiscountPercent: true,
    user: { select: { email: true } },
  } as const;

  if (data.source === "REFERRAL_LINK" && data.refCode) {
    const found = await prisma.partner.findUnique({
      where: { referralCode: data.refCode },
      select,
    });
    if (found?.status === "ACTIVE") {
      partner = found;
      viaLink = true;
    }
  } else if (data.source === "SALES_PAGE" && data.salesPage) {
    const owned = await prisma.partnerSalesPage.findUnique({
      where: { page: data.salesPage },
      select: { creditFrom: true, partner: { select } },
    });
    if (owned && owned.partner.status === "ACTIVE" && owned.creditFrom <= now)
      partner = owned.partner;
  }
  if (!partner) return null;

  if (partner.user?.email && normalizeEmail(partner.user.email) === normalizeEmail(user.email)) {
    return null;
  }
  if (partner.userId === user.id) return null;

  let selfReferralFlag = false;
  if (ip && partner.userId) {
    const sameIp = await prisma.session.findFirst({
      where: { userId: partner.userId, ipAddress: ip },
      select: { id: true },
    });
    selfReferralFlag = Boolean(sameIp);
  }

  return {
    partnerId: partner.id,
    commissionRate: partner.commissionRate,
    commissionMonths: partner.commissionMonths,
    // The discount is a referral-link offer only: sales pages show their own prices.
    discountPercent:
      viaLink && Number(partner.customerDiscountPercent) > 0
        ? partner.customerDiscountPercent
        : null,
    selfReferralFlag,
  };
}

// ------------------------------------------------------------------- admin

export interface PartnerListRow {
  id: string;
  displayName: string;
  status: PartnerStatus;
  referralCode: string | null;
  referralLanding: "REGISTER" | "HOME";
  commissionRate: string;
  commissionMonths: number;
  customerDiscountPercent: string;
  user: { id: string; email: string; name: string } | null;
  salesPages: { page: string; creditFrom: string }[];
  signups: number;
  payingCustomers: number;
  totals: CurrencyTotals[];
  createdAt: string;
}

export async function listPartners(now: Date = new Date()): Promise<PartnerListRow[]> {
  const partners = await prisma.partner.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, email: true, name: true } },
      salesPages: { orderBy: { page: "asc" } },
      _count: { select: { attributions: true } },
    },
  });
  if (partners.length === 0) return [];
  const ids = partners.map((p) => p.id);
  const [paying, ledger] = await Promise.all([
    prisma.signupAttribution.groupBy({
      by: ["partnerId"],
      where: { partnerId: { in: ids }, firstPaidAt: { not: null } },
      _count: { _all: true },
    }),
    prisma.partnerCommission.findMany({
      where: { partnerId: { in: ids }, status: { not: "VOID" } },
      select: { partnerId: true, currency: true, amount: true, status: true, payableAt: true },
    }),
  ]);

  return partners.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    status: p.status,
    referralCode: p.referralCode,
    referralLanding: p.referralLanding,
    commissionRate: p.commissionRate.toString(),
    commissionMonths: p.commissionMonths,
    customerDiscountPercent: p.customerDiscountPercent.toString(),
    user: p.user,
    salesPages: p.salesPages.map((s) => ({ page: s.page, creditFrom: s.creditFrom.toISOString() })),
    signups: p._count.attributions,
    payingCustomers: paying.find((g) => g.partnerId === p.id)?._count._all ?? 0,
    totals: totalsByCurrency(
      ledger.filter((r) => r.partnerId === p.id),
      now
    ),
    createdAt: p.createdAt.toISOString(),
  }));
}

/** Credit sign-ups that already used this code before the partner existed (they typed it). */
async function creditEarlierCodeSignups(partner: {
  id: string;
  userId: string | null;
  referralCode: string | null;
  commissionRate: Prisma.Decimal;
  commissionMonths: number;
  customerDiscountPercent: Prisma.Decimal;
}): Promise<string[]> {
  if (!partner.referralCode) return [];
  const rows = await prisma.signupAttribution.findMany({
    where: {
      source: "REFERRAL_LINK",
      refCode: partner.referralCode,
      partnerId: null,
      ...(partner.userId ? { userId: { not: partner.userId } } : {}),
    },
    select: { id: true, userId: true },
  });
  if (rows.length === 0) return [];
  await prisma.signupAttribution.updateMany({
    where: { id: { in: rows.map((r) => r.id) }, partnerId: null },
    data: {
      partnerId: partner.id,
      commissionRate: partner.commissionRate,
      commissionMonths: partner.commissionMonths,
      discountPercent:
        Number(partner.customerDiscountPercent) > 0 ? partner.customerDiscountPercent : null,
    },
  });
  return rows.map((r) => r.userId);
}

/** Pull already-paid invoices of newly credited customers into the ledger (best effort). */
async function backfill(userIds: string[]): Promise<void> {
  for (const userId of userIds.slice(0, 200)) {
    try {
      await backfillCustomerCommissions(userId);
    } catch (err) {
      logger.error("Partner commission backfill failed", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export async function createPartner(input: CreatePartnerInput, actorId: string) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, partner: { select: { id: true } } },
  });
  if (!user) {
    throw new AppError(
      "No Epidom account uses that email. Ask them to sign up first.",
      ApiErrorCode.USER_NOT_FOUND,
      404
    );
  }
  if (user.partner) {
    throw new AppError("That account is already a partner", ApiErrorCode.CONFLICT, 409);
  }
  if (user.id === actorId) {
    throw new AppError("You can't make yourself a partner", ApiErrorCode.FORBIDDEN, 403);
  }
  await assertCodeFree(input.referralCode);

  const partner = await prisma.partner.create({
    data: {
      userId: user.id,
      displayName: input.displayName,
      referralCode: input.referralCode,
      referralLanding: input.referralLanding,
      commissionRate: input.commissionRate,
      commissionMonths: input.commissionMonths,
      customerDiscountPercent: input.customerDiscountPercent,
      notes: input.notes ?? null,
      createdById: actorId,
    },
  });
  await backfill(await creditEarlierCodeSignups(partner));
  return partner;
}

export async function updatePartner(id: string, input: UpdatePartnerInput, actorId: string) {
  const existing = await prisma.partner.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!existing) notFound();
  refuseOwnDeal(existing.userId, actorId);
  if (input.referralCode !== undefined) await assertCodeFree(input.referralCode, id);

  const partner = await prisma.partner.update({
    where: { id },
    data: {
      displayName: input.displayName,
      referralCode: input.referralCode,
      referralLanding: input.referralLanding,
      commissionRate: input.commissionRate,
      commissionMonths: input.commissionMonths,
      customerDiscountPercent: input.customerDiscountPercent,
      notes: input.notes,
      status: input.status,
    },
  });
  if (input.referralCode) await backfill(await creditEarlierCodeSignups(partner));
  return partner;
}

/**
 * Set the sales pages a partner owns (replacing the list). Sign-ups credited
 * to a page since its "credit from" date and not yet credited to anyone are
 * credited to the partner, with the partner's current deal and no customer
 * discount, and their already-paid invoices are pulled into the ledger.
 */
export async function setPartnerSalesPages(
  id: string,
  input: SetPartnerSalesPagesInput,
  actorId: string
) {
  const partner = await prisma.partner.findUnique({ where: { id } });
  if (!partner) notFound();
  refuseOwnDeal(partner.userId, actorId);

  const pages = input.pages.filter((p) => (SALES_PAGES as readonly string[]).includes(p.page));
  const owned = await prisma.partnerSalesPage.findMany({
    where: { page: { in: pages.map((p) => p.page) }, partnerId: { not: id } },
    select: { page: true, partner: { select: { displayName: true } } },
  });
  if (owned.length > 0) {
    throw new AppError(
      owned.map((o) => `${o.page} already belongs to ${o.partner.displayName}`).join("; "),
      ApiErrorCode.CONFLICT,
      409
    );
  }

  await prisma.$transaction([
    prisma.partnerSalesPage.deleteMany({
      where: { partnerId: id, page: { notIn: pages.map((p) => p.page) } },
    }),
    ...pages.map((p) =>
      prisma.partnerSalesPage.upsert({
        where: { page: p.page },
        create: { page: p.page, partnerId: id, creditFrom: p.creditFrom },
        update: { creditFrom: p.creditFrom },
      })
    ),
  ]);

  const credited: string[] = [];
  for (const p of pages) {
    const rows = await prisma.signupAttribution.findMany({
      where: {
        source: "SALES_PAGE",
        salesPage: p.page,
        partnerId: null,
        createdAt: { gte: p.creditFrom },
        ...(partner.userId ? { userId: { not: partner.userId } } : {}),
      },
      select: { id: true, userId: true },
    });
    if (rows.length === 0) continue;
    await prisma.signupAttribution.updateMany({
      where: { id: { in: rows.map((r) => r.id) }, partnerId: null },
      data: {
        partnerId: id,
        commissionRate: partner.commissionRate,
        commissionMonths: partner.commissionMonths,
        discountPercent: null,
      },
    });
    credited.push(...rows.map((r) => r.userId));
  }
  await backfill(credited);
  return { credited: credited.length };
}

export interface PartnerCustomerRow {
  userId: string;
  /** Admin view only. */
  email?: string;
  /** The customer's business name; null until they set one up. */
  label: string | null;
  signedUpAt: string;
  source: "REFERRAL_LINK" | "SALES_PAGE" | null;
  salesPage: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  adClick: string | null;
  plan: string;
  status: SignupPlanStatus;
  firstPaidAt: string | null;
  windowEnd: string | null;
  discountPercent: string | null;
  discountRedeemed: boolean;
  selfReferralFlag: boolean;
  /** Commission this customer earned, per currency (non-void rows). */
  earned: { currency: string; amount: string }[];
}

export interface LedgerRow {
  id: string;
  kind: string;
  status: string;
  currency: string;
  invoiceAmount: string;
  commissionableAmount: string;
  rate: string;
  amount: string;
  plan: string | null;
  billingInterval: string | null;
  earnedAt: string;
  payableAt: string;
  ready: boolean;
  /** The customer's business name; null until set up, or when the account was deleted. */
  customerLabel: string | null;
  customerDeleted: boolean;
  note: string | null;
  payoutId: string | null;
}

export interface PayoutRow {
  id: string;
  currency: string;
  amount: string;
  reference: string | null;
  paidAt: string;
  note: string | null;
}

async function customersOf(
  partnerId: string,
  { withEmail }: { withEmail: boolean },
  now: Date
): Promise<PartnerCustomerRow[]> {
  const rows = await prisma.signupAttribution.findMany({
    where: { partnerId },
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: {
      user: {
        select: {
          email: true,
          business: { select: { name: true } },
          subscription: {
            select: { plan: true, status: true, trialEndsAt: true, stripeSubscriptionId: true },
          },
        },
      },
      commissions: { where: { status: { not: "VOID" } }, select: { currency: true, amount: true } },
    },
  });
  return rows.map((a) => {
    const earned = new Map<string, number>();
    for (const c of a.commissions)
      earned.set(c.currency, (earned.get(c.currency) ?? 0) + cents(c.amount));
    return {
      userId: a.userId,
      ...(withEmail ? { email: a.user.email } : {}),
      label: a.user.business?.name || null,
      signedUpAt: a.createdAt.toISOString(),
      source: a.source,
      salesPage: a.salesPage,
      utmSource: a.utmSource,
      utmCampaign: a.utmCampaign,
      adClick: a.adClick,
      plan: a.user.subscription?.plan ?? "FREE",
      status: signupPlanStatus(a.user.subscription, now),
      firstPaidAt: a.firstPaidAt?.toISOString() ?? null,
      windowEnd: a.commissionWindowEnd?.toISOString() ?? null,
      discountPercent: a.discountPercent?.toString() ?? null,
      discountRedeemed: Boolean(a.discountRedeemedAt),
      selfReferralFlag: withEmail ? a.selfReferralFlag : false,
      earned: [...earned.entries()].map(([currency, amount]) => ({
        currency,
        amount: fromCents(amount),
      })),
    };
  });
}

async function ledgerOf(partnerId: string, now: Date) {
  const rows = await prisma.partnerCommission.findMany({
    where: { partnerId },
    orderBy: { earnedAt: "desc" },
    take: 1000,
    include: { customer: { select: { business: { select: { name: true } } } } },
  });
  const ledger: LedgerRow[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    currency: r.currency,
    invoiceAmount: r.invoiceAmount.toString(),
    commissionableAmount: r.commissionableAmount.toString(),
    rate: r.rate.toString(),
    amount: r.amount.toString(),
    plan: r.plan,
    billingInterval: r.billingInterval,
    earnedAt: r.earnedAt.toISOString(),
    payableAt: r.payableAt.toISOString(),
    ready: r.status === "PENDING" && r.payableAt <= now,
    customerLabel: r.customer?.business?.name || null,
    customerDeleted: !r.customerUserId,
    note: r.note,
    payoutId: r.payoutId,
  }));
  return { ledger, totals: totalsByCurrency(rows, now) };
}

async function payoutsOf(partnerId: string): Promise<PayoutRow[]> {
  const rows = await prisma.partnerPayout.findMany({
    where: { partnerId },
    orderBy: { paidAt: "desc" },
  });
  return rows.map((p) => ({
    id: p.id,
    currency: p.currency,
    amount: p.amount.toString(),
    reference: p.reference,
    paidAt: p.paidAt.toISOString(),
    note: p.note,
  }));
}

export async function getPartnerDetail(id: string, now: Date = new Date()) {
  const partner = await prisma.partner.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      salesPages: { orderBy: { page: "asc" } },
      viewers: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  });
  if (!partner) notFound();
  const [customers, { ledger, totals }, payouts] = await Promise.all([
    customersOf(id, { withEmail: true }, now),
    ledgerOf(id, now),
    payoutsOf(id),
  ]);
  return {
    partner: {
      id: partner.id,
      displayName: partner.displayName,
      status: partner.status,
      referralCode: partner.referralCode,
      referralLanding: partner.referralLanding,
      commissionRate: partner.commissionRate.toString(),
      commissionMonths: partner.commissionMonths,
      customerDiscountPercent: partner.customerDiscountPercent.toString(),
      notes: partner.notes,
      user: partner.user,
      salesPages: partner.salesPages.map((s) => ({
        page: s.page,
        creditFrom: s.creditFrom.toISOString(),
        assignedAt: s.assignedAt.toISOString(),
      })),
      viewers: partner.viewers.map((v) => ({
        userId: v.user.id,
        email: v.user.email,
        name: v.user.name,
        addedAt: v.createdAt.toISOString(),
      })),
      createdAt: partner.createdAt.toISOString(),
    },
    customers,
    ledger,
    totals,
    payouts,
  };
}

/**
 * Record a bank transfer to a partner: every commission ready to pay in that
 * currency (refund adjustments included) is marked paid with it. The amount
 * is what the server sums, never a number typed in.
 */
export async function recordPayout(partnerId: string, input: RecordPayoutInput, actorId: string) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { userId: true },
  });
  if (!partner) notFound();
  refuseOwnDeal(partner.userId, actorId);

  const now = new Date();
  const ready = await prisma.partnerCommission.findMany({
    where: { partnerId, currency: input.currency, status: "PENDING", payableAt: { lte: now } },
    select: { id: true, amount: true },
  });
  const total = ready.reduce((sum, r) => sum + cents(r.amount), 0);
  if (ready.length === 0 || total <= 0) {
    throw new AppError(
      `Nothing is ready to pay in ${input.currency.toUpperCase()}`,
      ApiErrorCode.VALIDATION_ERROR,
      400
    );
  }

  return prisma.$transaction(async (tx) => {
    const payout = await tx.partnerPayout.create({
      data: {
        partnerId,
        currency: input.currency,
        amount: fromCents(total),
        reference: input.reference ?? null,
        paidAt: input.paidAt,
        note: input.note ?? null,
        createdById: actorId,
      },
    });
    const marked = await tx.partnerCommission.updateMany({
      where: { id: { in: ready.map((r) => r.id) }, status: "PENDING" },
      data: { status: "PAID", payoutId: payout.id },
    });
    if (marked.count !== ready.length) {
      // Another payout took some of these rows meanwhile: undo, try again.
      throw new AppError(
        "The ledger changed while recording; try again",
        ApiErrorCode.CONFLICT,
        409
      );
    }
    return payout;
  });
}

export async function voidCommission(commissionId: string, reason: string, actorId: string) {
  const row = await prisma.partnerCommission.findUnique({
    where: { id: commissionId },
    select: { status: true, partner: { select: { userId: true } } },
  });
  if (!row) throw new AppError("Commission not found", ApiErrorCode.NOT_FOUND, 404);
  refuseOwnDeal(row.partner.userId, actorId);
  if (row.status !== "PENDING") {
    throw new AppError(
      "Only a commission not yet paid out can be voided",
      ApiErrorCode.CONFLICT,
      409
    );
  }
  return prisma.partnerCommission.update({
    where: { id: commissionId },
    data: { status: "VOID", note: reason },
  });
}

/**
 * Let an account see this partner's page read-only (someone working with the
 * partner). It sees what the partner sees and earns nothing.
 */
export async function addPartnerViewer(partnerId: string, email: string, actorId: string) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { userId: true },
  });
  if (!partner) notFound();
  refuseOwnDeal(partner.userId, actorId);
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  });
  if (!user) {
    throw new AppError(
      "No Epidom account uses that email. Ask them to sign up first.",
      ApiErrorCode.USER_NOT_FOUND,
      404
    );
  }
  if (user.id === partner.userId) {
    throw new AppError(
      "That's the partner's own account: they already see this page",
      ApiErrorCode.CONFLICT,
      409
    );
  }
  return prisma.partnerViewer.upsert({
    where: { partnerId_userId: { partnerId, userId: user.id } },
    create: { partnerId, userId: user.id, createdById: actorId },
    update: {},
  });
}

export async function removePartnerViewer(partnerId: string, userId: string, actorId: string) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    select: { userId: true },
  });
  if (!partner) notFound();
  refuseOwnDeal(partner.userId, actorId);
  await prisma.partnerViewer.deleteMany({ where: { partnerId, userId } });
}

/** Display names of the partner pages an account may open, for the page switcher. */
export async function partnerPageChoices(
  ids: string[]
): Promise<{ id: string; displayName: string }[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.partner.findMany({
    where: { id: { in: ids } },
    select: { id: true, displayName: true },
  });
  return ids.flatMap((id) => rows.filter((r) => r.id === id));
}

// ----------------------------------------------------------- partner page

/**
 * A partner's own page: their deal, link, customers (no emails), ledger and
 * payouts, and for a sales-page owner the sales-page report of their pages
 * only (the same figures as /admin/sales-pages) over `range`.
 */
export async function getMyPartnerDashboard(
  partnerId: string,
  range: SalesPageReportRange = "all",
  now: Date = new Date()
) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: { salesPages: { orderBy: { page: "asc" } } },
  });
  if (!partner) notFound();
  const pages = partner.salesPages.map((s) => s.page);
  const [customers, { ledger, totals }, payouts, report] = await Promise.all([
    customersOf(partnerId, { withEmail: false }, now),
    ledgerOf(partnerId, now),
    payoutsOf(partnerId),
    pages.length ? getSalesPageReport(range, "all", now, pages) : Promise.resolve(null),
  ]);
  return {
    partner: {
      displayName: partner.displayName,
      status: partner.status,
      referralCode: partner.referralCode,
      referralLanding: partner.referralLanding,
      commissionRate: partner.commissionRate.toString(),
      commissionMonths: partner.commissionMonths,
      customerDiscountPercent: partner.customerDiscountPercent.toString(),
    },
    range,
    salesPages: partner.salesPages.map((s) => ({
      page: s.page,
      creditFrom: s.creditFrom.toISOString(),
      /** Credited to this partner (from the credit-from date), all time. */
      creditedSignups: customers.filter((c) => c.source === "SALES_PAGE" && c.salesPage === s.page)
        .length,
      /** The page's figures over the range, as in the admin report. */
      report: report?.pages.find((r) => r.page === s.page) ?? null,
    })),
    customers,
    // No customer names on the partner's own ledger beyond the business name.
    ledger,
    totals,
    payouts,
  };
}

export async function setMyReferralLanding(partnerId: string, landing: "REGISTER" | "HOME") {
  return prisma.partner.update({ where: { id: partnerId }, data: { referralLanding: landing } });
}

/** What the referral banner shows for a code: only an ACTIVE partner's. */
export async function getReferralBanner(
  rawCode: string
): Promise<{ displayName: string; discountPercent: number } | null> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return null;
  const partner = await prisma.partner.findUnique({
    where: { referralCode: code },
    select: { displayName: true, customerDiscountPercent: true, status: true },
  });
  if (!partner || partner.status !== "ACTIVE") return null;
  return {
    displayName: partner.displayName,
    discountPercent: Number(partner.customerDiscountPercent),
  };
}
