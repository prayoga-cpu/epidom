/**
 * Monthly archives (archivage). Once a month is closed, its entries, its day
 * closures and the month closure are written out as one JSON document, which
 * is gzipped and stored, and whose hash is signed on the store's ARCHIVE
 * chain. The document carries the public keys, so it can be checked with no
 * access to Epidom at all (scripts/fiscal-verify.ts).
 *
 * The same document, built on the fly and unsigned, is what "export" returns
 * for a month that isn't closed yet.
 */
import { gunzipSync, gzipSync } from "zlib";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canonicalJson, type CanonicalValue } from "./canonical";
import { lockChainHead, saveChainHead, sealRecord } from "./chain";
import { sha256Hex } from "./signing";

type Tx = Prisma.TransactionClient;

export const ARCHIVE_FORMAT = "epidom-fiscal-archive";

/** Month "2026-10" → day bounds for a string range on businessDay/period. */
function monthRange(month: string) {
  return { gt: `${month}-00`, lt: `${month}-99` };
}

async function storeIdentity(db: Tx, storeId: string): Promise<CanonicalValue> {
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: {
      name: true,
      address: true,
      business: { select: { name: true, address: true, city: true, country: true } },
    },
  });
  return {
    id: storeId,
    name: store?.name ?? null,
    address: store?.address ?? null,
    business: store
      ? {
          name: store.business.name,
          address: store.business.address,
          city: store.business.city,
          country: store.business.country,
        }
      : null,
  };
}

/** The month's archive document as a canonical-JSON-ready object. */
export async function buildArchiveDocument(
  db: Tx,
  storeId: string,
  month: string,
  generatedAt: Date
): Promise<{
  document: Record<string, CanonicalValue>;
  entryCount: number;
  firstSeq: number;
  lastSeq: number;
}> {
  const [entries, closures, keys, store] = await Promise.all([
    db.fiscalEntry.findMany({
      where: { storeId, businessDay: monthRange(month) },
      orderBy: { seq: "asc" },
      select: { seq: true, payload: true, hash: true, signature: true, keyId: true },
    }),
    db.fiscalClosure.findMany({
      where: {
        storeId,
        OR: [
          { kind: "DAY", period: monthRange(month) },
          { kind: "MONTH", period: month },
        ],
      },
      orderBy: { seq: "asc" },
      select: { kind: true, period: true, payload: true, hash: true, signature: true, keyId: true },
    }),
    db.fiscalSigningKey.findMany({ select: { keyId: true, publicKey: true } }),
    storeIdentity(db, storeId),
  ]);
  const usedKeys = new Set(
    [...entries, ...closures].map((r) => r.keyId).filter((k): k is string => !!k)
  );
  return {
    document: {
      format: ARCHIVE_FORMAT,
      version: 1,
      store,
      period: month,
      generatedAt: generatedAt.toISOString(),
      keys: keys
        .filter((k) => usedKeys.has(k.keyId))
        .map((k) => ({ keyId: k.keyId, publicKey: k.publicKey })),
      entries: entries.map((e) => ({ ...e })),
      closures: closures.map((c) => ({ ...c, kind: c.kind as string })),
    },
    entryCount: entries.length,
    firstSeq: entries[0]?.seq ?? 0,
    lastSeq: entries[entries.length - 1]?.seq ?? 0,
  };
}

/** Archive every closed month that has no archive yet. */
export async function archiveClosedMonths(storeId: string): Promise<string[]> {
  const [months, archived] = await Promise.all([
    prisma.fiscalClosure.findMany({
      where: { storeId, kind: "MONTH" },
      orderBy: { period: "asc" },
      select: { period: true, hash: true },
    }),
    prisma.fiscalArchive.findMany({ where: { storeId }, select: { period: true } }),
  ]);
  const done = new Set(archived.map((a) => a.period));
  const created: string[] = [];
  for (const month of months.filter((m) => !done.has(m.period))) {
    const made = await prisma.$transaction(
      async (tx) => {
        const head = await lockChainHead(tx, storeId, "ARCHIVE");
        const exists = await tx.fiscalArchive.findUnique({
          where: { storeId_period: { storeId, period: month.period } },
          select: { id: true },
        });
        if (exists) return false;

        const generatedAt = new Date();
        const built = await buildArchiveDocument(tx, storeId, month.period, generatedAt);
        const json = canonicalJson(built.document);
        const contentHash = sha256Hex(json);
        const seq = head.lastSeq + 1;
        const sealed = await sealRecord(tx, {
          chain: "ARCHIVE",
          store: storeId,
          seq,
          period: month.period,
          createdAt: generatedAt.toISOString(),
          contentHash,
          entryCount: built.entryCount,
          firstEntrySeq: built.firstSeq,
          lastEntrySeq: built.lastSeq,
          monthClosureHash: month.hash,
          prev: head.lastHash,
        });
        await tx.fiscalArchive.create({
          data: {
            storeId,
            seq,
            period: month.period,
            firstEntrySeq: built.firstSeq,
            lastEntrySeq: built.lastSeq,
            entryCount: built.entryCount,
            content: new Uint8Array(gzipSync(Buffer.from(json, "utf8"))),
            contentHash,
            payload: sealed.payload,
            prevHash: head.lastHash,
            hash: sealed.hash,
            signature: sealed.signature,
            keyId: sealed.keyId,
          },
        });
        await saveChainHead(tx, storeId, "ARCHIVE", {
          ...head,
          lastSeq: seq,
          lastHash: sealed.hash,
        });
        return true;
      },
      { timeout: 60_000 }
    );
    if (made) created.push(month.period);
  }
  return created;
}

/** The stored document, decompressed, exactly as it was hashed. */
export function readArchiveContent(content: Uint8Array): string {
  return gunzipSync(Buffer.from(content)).toString("utf8");
}
