/**
 * What the Fiscal journal page shows: the chain's state, recent closures, the
 * archives, and whether the publisher attestation applies to this store.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveStaffSession } from "@/lib/staff-session";
import { staffPersonaMayReadFinance } from "@/lib/auth/require-finance-access";
import { ApiErrorCode, createErrorResponse } from "@/types/api/responses";
import { FISCAL_MODULE, isFiscalAttestationReady } from "./attestation";
import { loadStoreFiscalContext } from "./journal";
import { getFiscalSigner } from "./signing";

/** Business.country holds the English name ("France"); older rows may hold a code. */
export function isFranceCountry(country: string | null | undefined): boolean {
  return ["france", "fr", "fra"].includes((country ?? "").trim().toLowerCase());
}

/**
 * Who may read the journal: the owner, or a persona of THIS outlet granted
 * the /fiscal page, the same persona rule as Finance. No plan gate on
 * purpose: the records must stay reachable for six years, whatever plan the
 * store is on by then.
 */
export async function requireFiscalAccessApi(storeId: string): Promise<NextResponse | null> {
  const staffSession = await getActiveStaffSession();
  if (staffPersonaMayReadFinance(staffSession, storeId, ["/fiscal"])) return null;
  return NextResponse.json(
    createErrorResponse(
      ApiErrorCode.FORBIDDEN,
      "Your staff access doesn't include the fiscal journal."
    ),
    { status: 403 }
  );
}

export interface FiscalClosureRow {
  kind: "DAY" | "MONTH" | "YEAR";
  period: string;
  entryCount: number;
  salesTotal: string;
  refundsTotal: string;
  cancellationsTotal: string;
  net: string;
  totalNet: string;
  signed: boolean;
  hash: string;
}

export interface FiscalSummary {
  currency: string;
  entries: {
    count: number;
    lastRecordedAt: string | null;
    totalNet: string;
    totalAbsolute: string;
    unsigned: number;
  };
  closures: FiscalClosureRow[];
  archives: {
    id: string;
    period: string;
    entryCount: number;
    createdAt: string;
    signed: boolean;
    hash: string;
  }[];
  signer: { configured: boolean; keyId: string | null };
  module: { name: string; version: string };
  attestation: { applicable: boolean; ready: boolean };
}

export async function getFiscalSummary(storeId: string): Promise<FiscalSummary> {
  const [ctx, head, last, unsigned, days, months, years, archives, store] = await Promise.all([
    loadStoreFiscalContext(prisma, storeId),
    prisma.fiscalChainHead.findUnique({
      where: { storeId_chain: { storeId, chain: "ENTRY" } },
      select: { lastSeq: true, totalNet: true, totalAbsolute: true },
    }),
    prisma.fiscalEntry.findFirst({
      where: { storeId },
      orderBy: { seq: "desc" },
      select: { recordedAt: true },
    }),
    prisma.fiscalEntry.count({ where: { storeId, signature: null } }),
    prisma.fiscalClosure.findMany({
      where: { storeId, kind: "DAY" },
      orderBy: { period: "desc" },
      take: 31,
    }),
    prisma.fiscalClosure.findMany({
      where: { storeId, kind: "MONTH" },
      orderBy: { period: "desc" },
      take: 24,
    }),
    prisma.fiscalClosure.findMany({
      where: { storeId, kind: "YEAR" },
      orderBy: { period: "desc" },
    }),
    prisma.fiscalArchive.findMany({
      where: { storeId },
      orderBy: { period: "desc" },
      select: {
        id: true,
        period: true,
        entryCount: true,
        createdAt: true,
        signature: true,
        hash: true,
      },
    }),
    prisma.store.findUnique({
      where: { id: storeId },
      select: { country: true, business: { select: { country: true } } },
    }),
  ]);
  const signer = getFiscalSigner();

  return {
    currency: ctx.currency,
    entries: {
      count: head?.lastSeq ?? 0,
      lastRecordedAt: last?.recordedAt.toISOString() ?? null,
      totalNet: (head?.totalNet ?? 0).toString(),
      totalAbsolute: (head?.totalAbsolute ?? 0).toString(),
      unsigned,
    },
    closures: [...days, ...months, ...years].map((c) => ({
      kind: c.kind,
      period: c.period,
      entryCount: c.entryCount,
      salesTotal: c.salesTotal.toString(),
      refundsTotal: c.refundsTotal.toString(),
      cancellationsTotal: c.cancellationsTotal.toString(),
      net: c.net.toString(),
      totalNet: c.totalNet.toString(),
      signed: c.signature !== null,
      hash: c.hash,
    })),
    archives: archives.map((a) => ({
      id: a.id,
      period: a.period,
      entryCount: a.entryCount,
      createdAt: a.createdAt.toISOString(),
      signed: a.signature !== null,
      hash: a.hash,
    })),
    signer: { configured: signer !== null, keyId: signer?.keyId ?? null },
    module: { name: FISCAL_MODULE.name, version: FISCAL_MODULE.version },
    attestation: {
      applicable: isFranceCountry(store?.country || store?.business.country),
      ready: isFiscalAttestationReady(),
    },
  };
}
