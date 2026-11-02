/**
 * Check a downloaded fiscal archive or export with no access to Epidom:
 *
 *   npx tsx scripts/fiscal-verify.ts epidom-fiscal-2026-10.json
 *
 * For a signed archive: the document's sha256 must equal the header's
 * contentHash, and the header must verify against its signature. For every
 * entry and closure inside: the hash must match the payload, each record must
 * name the previous one's hash, the sequence must not skip, and every
 * signature must verify against the public key the document lists for it.
 *
 * Self-contained on purpose (node:crypto only): an auditor can read all of it.
 */
import { createHash, createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

interface SignedRecord {
  seq?: number;
  payload: string;
  hash: string;
  signature: string | null;
  keyId: string | null;
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: npx tsx scripts/fiscal-verify.ts <archive.json>");
    process.exit(2);
  }
  const { archive, document } = JSON.parse(readFileSync(file, "utf8")) as {
    archive: (SignedRecord & { contentHash: string }) | null;
    document: {
      period: string;
      keys: { keyId: string; publicKey: string }[];
      entries: SignedRecord[];
      closures: (SignedRecord & { kind: string; period: string })[];
    };
  };
  const keys = new Map(document.keys.map((k) => [k.keyId, createPublicKey(k.publicKey)]));
  const problems: string[] = [];
  const checkSignature = (label: string, record: SignedRecord) => {
    if (!record.signature || !record.keyId) return problems.push(`${label}: not signed`);
    const key = keys.get(record.keyId);
    if (!key) return problems.push(`${label}: unknown key ${record.keyId}`);
    const ok = verify(
      null,
      Buffer.from(record.payload, "utf8"),
      key,
      Buffer.from(record.signature, "base64url")
    );
    if (!ok) problems.push(`${label}: signature does not match`);
  };

  if (archive) {
    if (sha256(canonical(document as unknown as Json)) !== archive.contentHash) {
      problems.push("archive: document does not match its contentHash (altered)");
    }
    if (sha256(archive.payload) !== archive.hash) problems.push("archive: header hash mismatch");
    if (JSON.parse(archive.payload).contentHash !== archive.contentHash) {
      problems.push("archive: signed header names another document");
    }
    checkSignature("archive", archive);
  } else {
    console.log("Unsigned export (month not archived yet): checking its records only.");
  }

  let previous: { seq: number; hash: string } | null = null;
  for (const entry of document.entries) {
    const p = JSON.parse(entry.payload) as { seq: number; prev: string };
    const label = `entry ${p.seq}`;
    if (sha256(entry.payload) !== entry.hash) problems.push(`${label}: content altered`);
    if (previous && p.seq !== previous.seq + 1) problems.push(`${label}: sequence skips`);
    if (previous && p.prev !== previous.hash)
      problems.push(`${label}: not linked to entry ${previous.seq}`);
    checkSignature(label, entry);
    previous = { seq: p.seq, hash: entry.hash };
  }
  for (const closure of document.closures) {
    const label = `${closure.kind.toLowerCase()} closure ${closure.period}`;
    if (sha256(closure.payload) !== closure.hash) problems.push(`${label}: content altered`);
    checkSignature(label, closure);
  }

  console.log(
    `${document.period}: ${document.entries.length} entries, ${document.closures.length} closures checked.`
  );
  if (problems.length === 0) {
    console.log("OK: nothing altered, every record signed and linked.");
    return;
  }
  for (const problem of problems) console.log(`PROBLEM ${problem}`);
  process.exit(1);
}

main();
