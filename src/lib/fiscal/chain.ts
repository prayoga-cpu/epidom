import { Prisma } from "@prisma/client";
import { canonicalJson, type CanonicalValue } from "./canonical";
import { getFiscalSigner, sha256Hex } from "./signing";

type Tx = Prisma.TransactionClient;

/** The three chains a store keeps, one head row each. */
export type FiscalChain = "ENTRY" | "CLOSURE" | "ARCHIVE";

export const FISCAL_PAYLOAD_VERSION = 1;

export interface ChainHead {
  lastSeq: number;
  lastHash: string;
  lastDay: string;
  totalNet: Prisma.Decimal;
  totalAbsolute: Prisma.Decimal;
}

/**
 * Take the store's chain head, creating it on first use, and hold its row lock
 * until the caller's transaction ends. Every append goes through here, so two
 * tills paying at the same moment are numbered one after the other, never both
 * as seq N.
 *
 * Call it as late as possible in the paying transaction: anything after it is
 * time every other till in the store waits.
 */
export async function lockChainHead(
  tx: Tx,
  storeId: string,
  chain: FiscalChain
): Promise<ChainHead> {
  await tx.$executeRaw`
    INSERT INTO "fiscal_chain_heads" ("storeId", "chain", "updatedAt")
    VALUES (${storeId}, ${chain}, now())
    ON CONFLICT DO NOTHING`;
  const rows = await tx.$queryRaw<
    {
      lastSeq: number;
      lastHash: string;
      lastDay: string;
      totalNet: Prisma.Decimal | string;
      totalAbsolute: Prisma.Decimal | string;
    }[]
  >`
    SELECT "lastSeq", "lastHash", "lastDay", "totalNet", "totalAbsolute"
    FROM "fiscal_chain_heads"
    WHERE "storeId" = ${storeId} AND "chain" = ${chain}
    FOR UPDATE`;
  const row = rows[0];
  if (!row) throw new Error(`Fiscal chain head ${chain} for ${storeId} could not be locked`);
  return {
    lastSeq: Number(row.lastSeq),
    lastHash: row.lastHash,
    lastDay: row.lastDay,
    totalNet: new Prisma.Decimal(row.totalNet),
    totalAbsolute: new Prisma.Decimal(row.totalAbsolute),
  };
}

export async function saveChainHead(
  tx: Tx,
  storeId: string,
  chain: FiscalChain,
  head: ChainHead
): Promise<void> {
  await tx.fiscalChainHead.update({
    where: { storeId_chain: { storeId, chain } },
    data: {
      lastSeq: head.lastSeq,
      lastHash: head.lastHash,
      lastDay: head.lastDay,
      totalNet: head.totalNet,
      totalAbsolute: head.totalAbsolute,
    },
  });
}

export interface SealedRecord {
  payload: string;
  hash: string;
  signature: string | null;
  keyId: string | null;
}

/**
 * Serialise, hash and sign one record. The previous record's hash is inside
 * the payload (`prev`), which is what chains them: changing any record changes
 * its hash, which no longer matches the `prev` of the one after it.
 *
 * The public key is recorded the first time it signs (ON CONFLICT DO NOTHING:
 * a no-op every later time, and never an UPDATE, which the append-only trigger
 * would refuse).
 */
export async function sealRecord(
  tx: Tx,
  fields: Record<string, CanonicalValue>
): Promise<SealedRecord> {
  const payload = canonicalJson({ v: FISCAL_PAYLOAD_VERSION, ...fields });
  const hash = sha256Hex(payload);

  // Pure JS only inside the try: a failed SQL statement can't be caught here,
  // it has already aborted the transaction.
  let signer: ReturnType<typeof getFiscalSigner> = null;
  let signature: string | null = null;
  try {
    signer = getFiscalSigner();
    signature = signer ? signer.sign(payload) : null;
  } catch (err) {
    // A bad FISCAL_SIGNING_KEY must not stop the till. The record is still
    // hashed and chained, and verification reports it as unsigned.
    console.error("[FISCAL] signing failed, record kept unsigned:", err);
    signer = null;
    signature = null;
  }

  if (signer && signature) {
    await tx.fiscalSigningKey.createMany({
      data: [{ keyId: signer.keyId, publicKey: signer.publicKeyPem }],
      skipDuplicates: true,
    });
  }

  return { payload, hash, signature, keyId: signature ? (signer?.keyId ?? null) : null };
}
