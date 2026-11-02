/**
 * Integrity check of a store's journal, from the records alone: every hash
 * recomputed, every link and sequence number followed, every signature
 * checked against the key it names, the perpetual totals re-added, each
 * closure's end totals matched to the entry it ends on, and each archive's
 * content re-hashed. The heads (the one mutable table) are never trusted.
 *
 * Also counts paid orders since the journal started that have no SALE entry,
 * and refunds the journal holds less of than the order: the gaps a broken
 * record can't show by itself (a failed journal write leaves exactly these).
 */
import { prisma } from "@/lib/prisma";
import { readArchiveContent } from "./archive";
import { decimal, money } from "./entry-payload";
import { FISCAL_JOURNAL_START } from "./journal";
import { getFiscalSigner, sha256Hex, verifySignature } from "./signing";

const BATCH = 1000;
const MAX_ISSUES = 50;

export interface FiscalIssue {
  chain: "ENTRY" | "CLOSURE" | "ARCHIVE" | "ORDERS";
  seq: number | null;
  problem: string;
}

export interface ChainReport {
  count: number;
  lastSeq: number;
  unsigned: number;
}

export interface FiscalVerification {
  ok: boolean;
  checkedAt: string;
  entries: ChainReport;
  closures: ChainReport;
  archives: ChainReport;
  missingSales: number;
  missingRefunds: number;
  currentKeyId: string | null;
  unknownKeys: string[];
  issues: FiscalIssue[];
}

interface ChainRecord {
  seq: number;
  payload: string;
  prevHash: string;
  hash: string;
  signature: string | null;
  keyId: string | null;
}

/** The checks every chain shares. Returns the parsed payload, or null if unreadable. */
function checkLink(
  chain: FiscalIssue["chain"],
  storeId: string,
  record: ChainRecord,
  expected: { seq: number; prevHash: string },
  keys: Map<string, string>,
  report: ChainReport,
  issue: (i: FiscalIssue) => void,
  unknownKeys: Set<string>
): Record<string, unknown> | null {
  const at = { chain, seq: record.seq };
  if (record.seq !== expected.seq) {
    issue({ ...at, problem: `sequence jumps from ${expected.seq - 1} to ${record.seq}` });
  }
  if (sha256Hex(record.payload) !== record.hash) {
    issue({ ...at, problem: "content does not match its hash (altered)" });
  }
  if (record.prevHash !== expected.prevHash) {
    issue({ ...at, problem: "not linked to the previous record" });
  }
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(record.payload) as Record<string, unknown>;
  } catch {
    issue({ ...at, problem: "content is not readable" });
  }
  if (parsed) {
    if (parsed.prev !== record.prevHash)
      issue({ ...at, problem: "link inside the record differs" });
    if (parsed.seq !== record.seq) issue({ ...at, problem: "sequence inside the record differs" });
    if (parsed.store !== storeId) issue({ ...at, problem: "record belongs to another store" });
    if (parsed.chain !== chain) issue({ ...at, problem: "record belongs to another chain" });
  }
  if (!record.signature || !record.keyId) {
    report.unsigned += 1;
  } else {
    const publicKey = keys.get(record.keyId);
    if (!publicKey) {
      unknownKeys.add(record.keyId);
      issue({ ...at, problem: `signed with an unknown key ${record.keyId}` });
    } else if (!verifySignature(record.payload, record.signature, publicKey)) {
      issue({ ...at, problem: "signature does not match (altered or forged)" });
    }
  }
  report.count += 1;
  report.lastSeq = record.seq;
  return parsed;
}

export async function verifyFiscalJournal(storeId: string): Promise<FiscalVerification> {
  const issues: FiscalIssue[] = [];
  const issue = (i: FiscalIssue) => {
    if (issues.length < MAX_ISSUES) issues.push(i);
  };
  const unknownKeys = new Set<string>();
  const keys = new Map(
    (await prisma.fiscalSigningKey.findMany({ select: { keyId: true, publicKey: true } })).map(
      (k) => [k.keyId, k.publicKey]
    )
  );

  // Entries, in batches, keeping each one's perpetual net for the closure check.
  const entries: ChainReport = { count: 0, lastSeq: 0, unsigned: 0 };
  const netAt = new Map<number, string>();
  let prevHash = "";
  let net = decimal(0);
  let absolute = decimal(0);
  let cursor = 0;
  for (;;) {
    const batch = await prisma.fiscalEntry.findMany({
      where: { storeId, seq: { gt: cursor } },
      orderBy: { seq: "asc" },
      take: BATCH,
      select: {
        seq: true,
        kind: true,
        amount: true,
        totalNet: true,
        totalAbsolute: true,
        payload: true,
        prevHash: true,
        hash: true,
        signature: true,
        keyId: true,
      },
    });
    for (const row of batch) {
      const parsed = checkLink(
        "ENTRY",
        storeId,
        row,
        { seq: entries.lastSeq + 1, prevHash },
        keys,
        entries,
        issue,
        unknownKeys
      );
      const amount = decimal(row.amount);
      net = net.plus(amount);
      absolute = absolute.plus(amount.abs());
      const at = { chain: "ENTRY" as const, seq: row.seq };
      if (!net.equals(decimal(row.totalNet)) || !absolute.equals(decimal(row.totalAbsolute))) {
        issue({ ...at, problem: "perpetual totals do not add up" });
        net = decimal(row.totalNet);
        absolute = decimal(row.totalAbsolute);
      }
      if (parsed) {
        const totals = parsed.totals as { net?: string; absolute?: string } | undefined;
        if (parsed.kind !== row.kind || parsed.amount !== money(row.amount)) {
          issue({ ...at, problem: "stored columns differ from the signed record" });
        }
        if (totals?.net !== money(row.totalNet) || totals?.absolute !== money(row.totalAbsolute)) {
          issue({ ...at, problem: "stored totals differ from the signed record" });
        }
      }
      netAt.set(row.seq, money(row.totalNet));
      prevHash = row.hash;
    }
    if (batch.length < BATCH) break;
    cursor = batch[batch.length - 1].seq;
  }

  const closures: ChainReport = { count: 0, lastSeq: 0, unsigned: 0 };
  const closureRows = await prisma.fiscalClosure.findMany({
    where: { storeId },
    orderBy: { seq: "asc" },
    select: {
      seq: true,
      lastEntrySeq: true,
      totalNet: true,
      payload: true,
      prevHash: true,
      hash: true,
      signature: true,
      keyId: true,
    },
  });
  prevHash = "";
  for (const row of closureRows) {
    checkLink(
      "CLOSURE",
      storeId,
      row,
      { seq: closures.lastSeq + 1, prevHash },
      keys,
      closures,
      issue,
      unknownKeys
    );
    const expectedNet = netAt.get(row.lastEntrySeq);
    if (expectedNet === undefined) {
      issue({
        chain: "CLOSURE",
        seq: row.seq,
        problem: `ends on entry ${row.lastEntrySeq}, which is missing`,
      });
    } else if (expectedNet !== money(row.totalNet)) {
      issue({
        chain: "CLOSURE",
        seq: row.seq,
        problem: "totals differ from the entries it closes",
      });
    }
    prevHash = row.hash;
  }

  const archives: ChainReport = { count: 0, lastSeq: 0, unsigned: 0 };
  const archiveRows = await prisma.fiscalArchive.findMany({
    where: { storeId },
    orderBy: { seq: "asc" },
    select: {
      seq: true,
      content: true,
      contentHash: true,
      payload: true,
      prevHash: true,
      hash: true,
      signature: true,
      keyId: true,
    },
  });
  prevHash = "";
  for (const row of archiveRows) {
    const parsed = checkLink(
      "ARCHIVE",
      storeId,
      row,
      { seq: archives.lastSeq + 1, prevHash },
      keys,
      archives,
      issue,
      unknownKeys
    );
    let contentOk = false;
    try {
      contentOk = sha256Hex(readArchiveContent(row.content)) === row.contentHash;
    } catch {
      contentOk = false;
    }
    if (!contentOk || parsed?.contentHash !== row.contentHash) {
      issue({
        chain: "ARCHIVE",
        seq: row.seq,
        problem: "archive content does not match its signed hash",
      });
    }
    prevHash = row.hash;
  }

  const [{ count: missing }] = await prisma.$queryRaw<{ count: bigint | number }[]>`
    SELECT COUNT(*) AS "count" FROM "orders" o
    WHERE o."storeId" = ${storeId}
      AND o."paymentStatus"::text IN ('PAID', 'REFUNDED')
      AND o."createdAt" >= ${FISCAL_JOURNAL_START}
      AND NOT EXISTS (
        SELECT 1 FROM "fiscal_entries" f WHERE f."dedupeKey" = o."id" || ':SALE'
      )`;
  const missingSales = Number(missing);
  if (missingSales > 0) {
    issue({
      chain: "ORDERS",
      seq: null,
      problem: `${missingSales} paid order(s) not yet in the journal`,
    });
  }

  // Refunds the orders record but the journal holds less of.
  const [{ count: refundGap }] = await prisma.$queryRaw<{ count: bigint | number }[]>`
    SELECT COUNT(*) AS "count" FROM "orders" o
    WHERE o."storeId" = ${storeId}
      AND o."createdAt" >= ${FISCAL_JOURNAL_START}
      AND o."refundAmount" > COALESCE((
        SELECT -SUM(f."amount") FROM "fiscal_entries" f
        WHERE f."orderId" = o."id" AND f."kind"::text = 'REFUND'
      ), 0)`;
  const missingRefunds = Number(refundGap);
  if (missingRefunds > 0) {
    issue({
      chain: "ORDERS",
      seq: null,
      problem: `${missingRefunds} refund(s) not yet in the journal`,
    });
  }

  return {
    ok: issues.length === 0,
    checkedAt: new Date().toISOString(),
    entries,
    closures,
    archives,
    missingSales,
    missingRefunds,
    currentKeyId: getFiscalSigner()?.keyId ?? null,
    unknownKeys: [...unknownKeys],
    issues,
  };
}
