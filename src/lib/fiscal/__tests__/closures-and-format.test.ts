import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { canonicalJson } from "../canonical";
import { summariseClosures, summariseEntries } from "../closures";
import { isFiscalAttestationReady, type FiscalPublisher } from "../attestation";
import { signerFromSeed, verifySignature } from "../signing";

const entry = (
  seq: number,
  kind: string,
  amount: string,
  extra: object,
  totals: [string, string]
) => ({
  seq,
  kind,
  amount,
  currency: "EUR",
  hash: `h${seq}`,
  totalNet: totals[0],
  totalAbsolute: totals[1],
  payload: JSON.stringify({ kind, amount, ...extra }),
});

describe("canonical JSON", () => {
  it("sorts keys at every depth and treats a missing field as null", () => {
    expect(canonicalJson({ b: 1, a: { d: "x", c: undefined } })).toBe(
      '{"a":{"c":null,"d":"x"},"b":1}'
    );
  });

  it("is stable through a parse round trip (what an archive download relies on)", () => {
    const text = canonicalJson({ z: [{ y: "1.00", x: null }], a: true });
    expect(canonicalJson(JSON.parse(text))).toBe(text);
  });

  it("refuses a fractional number: money travels as strings", () => {
    expect(() => canonicalJson({ amount: 1.5 })).toThrow();
  });
});

describe("signing", () => {
  it("signs with a stable key id and rejects a changed payload", () => {
    const signer = signerFromSeed(Buffer.alloc(32, 7));
    expect(signerFromSeed(Buffer.alloc(32, 7)).keyId).toBe(signer.keyId);
    const signature = signer.sign('{"a":1}');
    expect(verifySignature('{"a":1}', signature, signer.publicKeyPem)).toBe(true);
    expect(verifySignature('{"a":2}', signature, signer.publicKeyPem)).toBe(false);
  });
});

describe("closures", () => {
  const day = summariseEntries([
    entry(
      4,
      "SALE",
      "20.00",
      { tax: "1.82", taxRate: "0.1000", tenders: [{ method: "CASH", amount: "20.00" }] },
      ["120.00", "130.00"]
    ),
    entry(
      5,
      "SALE",
      "10.00",
      { tax: "0.91", taxRate: "0.1000", tenders: [{ method: "STRIPE_CARD", amount: "10.00" }] },
      ["130.00", "140.00"]
    ),
    entry(
      6,
      "REFUND",
      "-5.00",
      { tax: "-0.46", taxRate: "0.1000", tenders: [{ method: "CASH", amount: "-5.00" }] },
      ["125.00", "145.00"]
    ),
  ]);

  it("a day adds up its entries and ends on the last one's perpetual totals", () => {
    expect(day).toMatchObject({
      firstEntrySeq: 4,
      lastEntrySeq: 6,
      entryCount: 3,
      lastEntryHash: "h6",
    });
    expect(day.counts).toEqual({ SALE: 2, REFUND: 1, CANCELLATION: 0 });
    expect(day.salesTotal.toFixed(2)).toBe("30.00");
    expect(day.refundsTotal.toFixed(2)).toBe("-5.00");
    expect(day.net.toFixed(2)).toBe("25.00");
    expect(day.taxByRate["0.1000"].toFixed(2)).toBe("2.27");
    expect(day.tenders.CASH.toFixed(2)).toBe("15.00");
    expect(day.totalNet.toFixed(2)).toBe("125.00");
    expect(day.totalAbsolute.toFixed(2)).toBe("145.00");
  });

  it("a month adds up its days", () => {
    const asPayload = (s: typeof day, net: string) =>
      JSON.stringify({
        firstEntrySeq: s.firstEntrySeq,
        lastEntrySeq: s.lastEntrySeq,
        entryCount: s.entryCount,
        currency: "EUR",
        mixedCurrencies: false,
        counts: s.counts,
        salesTotal: s.salesTotal.toFixed(2),
        refundsTotal: s.refundsTotal.toFixed(2),
        cancellationsTotal: s.cancellationsTotal.toFixed(2),
        net: s.net.toFixed(2),
        taxByRate: { "0.1000": "2.27" },
        tenders: { CASH: "15.00" },
        totals: { net, absolute: "999.00" },
        lastEntryHash: `last-${net}`,
      });
    const month = summariseClosures([
      { payload: asPayload(day, "125.00"), hash: "d1" },
      { payload: asPayload(day, "150.00"), hash: "d2" },
    ]);
    expect(month.entryCount).toBe(6);
    expect(month.net.toFixed(2)).toBe("50.00");
    expect(month.tenders.CASH.toFixed(2)).toBe("30.00");
    expect(month.totalNet.toFixed(2)).toBe("150.00");
    expect(month.parts).toEqual([{ hash: "d1" }, { hash: "d2" }]);
  });
});

describe("attestation readiness", () => {
  const complete: FiscalPublisher = {
    legalName: "Prionation",
    registration: "123",
    address: "Somewhere",
    representative: "NOM Prénom",
    representativeTitle: "Director",
    city: "Paris",
    signatureImage: "/legal/signature.png",
  };

  it("needs every publisher field, signature included", () => {
    expect(isFiscalAttestationReady(complete)).toBe(true);
    expect(isFiscalAttestationReady({ ...complete, signatureImage: "" })).toBe(false);
    expect(isFiscalAttestationReady({ ...complete, representative: "  " })).toBe(false);
  });
});

/**
 * A payment path that marks an order PAID without writing its fiscal SALE
 * entry is the one gap the journal can't show by itself (the catch-up sweep
 * only adds it later, flagged late). Every server file that writes PAID must
 * also call the journal, or be listed here with why it doesn't.
 */
describe("every server path that marks an order paid records it", () => {
  const SRC = join(process.cwd(), "src");
  const PAID_WRITE =
    /paymentStatus:\s*(?:"PAID"|PaymentStatus\.PAID)|paymentStatus:\s*isPayLater\s*\?\s*"PENDING"\s*:\s*"PAID"/;
  // Files that only build the data: their callers record the sale.
  const BUILDS_ONLY: Record<string, string> = {
    "lib/services/pos-order-settlement.ts":
      "buildSettlementOrderData; applySettlementBookkeeping and settlePendingOrderInTx record it",
  };

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return name === "__tests__" ? [] : walk(full);
      return /\.tsx?$/.test(name) ? [full] : [];
    });
  }

  const serverFiles = [...walk(join(SRC, "app", "api")), ...walk(join(SRC, "lib"))];
  // A write, not a `where` filter or a comment.
  const writesPaid = (text: string) =>
    text.split("\n").some((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || /\bwhere\b/.test(line))
        return false;
      return PAID_WRITE.test(line);
    });

  it.each(
    serverFiles
      .filter((file) => writesPaid(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file))
  )("%s", (file) => {
    const text = readFileSync(join(SRC, file), "utf8");
    const records = /record(Sale|Cancellation|Refund)InTx\(/.test(text);
    expect(
      records || file in BUILDS_ONLY,
      `${file} marks orders PAID without the fiscal journal`
    ).toBe(true);
  });
});
