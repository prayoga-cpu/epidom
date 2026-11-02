# Fiscal journal (NF525 / French anti-fraud VAT law)

Design record for `src/lib/fiscal/`, shipped in 3.39.0. It is also the
technical file an accountant or a tax inspector can be given: section 3 says
how each legal condition is met, section 5 says what is not covered.

## 1. The law

French businesses subject to VAT that record customer payments in software
must use a system that meets four conditions (CGI art. 286, I, 3° bis):
**inaltérabilité, sécurisation, conservation, archivage**. The fine is
€7,500 per non-compliant system (CGI art. 1770 duodecies), charged to the
business.

Proof is one of two documents:

- a **certificate** from an accredited body (NF525 by InfoCert, or LNE), after an
  audit; or
- the publisher's **individual attestation** (attestation individuelle de
  l'éditeur) on the administration's model BOI-LETTRE-000242. The 2025 finance
  law abolished it; the **2026 finance law (loi n° 2026-103 du 19 février 2026,
  art. 125) restored it from 21 February 2026**. Many articles from 2025 still
  say certification becomes mandatory in 2026: that is out of date.

Epidom takes the attestation route. It is **not NF525-certified** and must never
show the NF525 mark or say "certifié NF525" (the mark belongs to AFNOR/InfoCert).
A false attestation is a criminal offence (Code pénal art. 441-1: 3 years, €45,000)
for whoever signs it, so the attestation must describe the system as it is.

## 2. Design

One append-only journal per store, separate from `Order` (which stays the
operational record and keeps changing status). Four tables, none with a
foreign key, so deleting an order, a store or an account cascades into nothing:

| Table | What |
| --- | --- |
| `fiscal_entries` | One record per SALE, REFUND, CANCELLATION of a paid order |
| `fiscal_closures` | DAY, MONTH, YEAR closures |
| `fiscal_archives` | Signed monthly archive (gzipped JSON) |
| `fiscal_signing_keys` | Every public key that ever signed |
| `fiscal_chain_heads` | Moving end of each chain (the one mutable table, a cache) |

**Record format.** `payload` is canonical JSON (sorted keys, money as
2-decimal strings, `canonical.ts`), stored exactly as hashed. `hash` =
sha256(payload). The payload contains `prev` (the previous record's hash),
`seq`, the store, the business day, the amounts, the tenders, the lines (for a
sale), the reference to the sale (for a refund or cancel) and the perpetual
totals after it. `signature` = Ed25519 over the payload.

**Signing key.** `FISCAL_SIGNING_KEY` (32 bytes, base64) if set, otherwise
derived by HKDF from `BETTER_AUTH_SECRET` (same pattern as
`crypto/field-encryption.ts`), so it works with no new env var. Each record
names its `keyId`; the public key is stored on first use, so a rotation never
breaks old records. With no secret at all, records are still hashed and
chained, never refused; verification counts them as unsigned.

**Where entries are written** (inside the transaction that moves the money,
so the record commits with the payment):

| Path | Code |
| --- | --- |
| Till checkout, offline replay, finalize a held bill | `applySettlementBookkeeping` |
| Mark as Paid | `settlePendingOrderInTx` |
| Cancel a paid order | `cancelOrderInTx` |
| Refund | `applyOrderRefund` |
| Storefront payment (Xendit webhook) | `webhooks/xendit/route.ts` |
| Delivery-platform e-mail import | `parse-aggregator-email.ts` |

A test (`closures-and-format.test.ts`, last block) fails if a server file
writes `paymentStatus: "PAID"` without calling the journal. Anything still
missed is appended by the catch-up sweep, flagged `late: true`, and counted by
verification.

**A failed journal write never stops a sale.** Each write runs in a savepoint
(`guarded` in `journal.ts`). If it fails (the fiscal tables missing on a
database that wasn't migrated, a bug), only the journal write is rolled back:
the payment commits, the error is logged, and the catch-up appends the sale,
refund or cancel later, flagged `late`. Verification counts paid orders with no
SALE entry and refunds the journal holds less of, so a gap can't go unseen.
Checked against a real Postgres with the chain-head table renamed away
mid-payment. The journal starts on 2026-11-02 (`FISCAL_JOURNAL_START`); sales
before it are not backfilled.

**Ordering.** Every append locks the store's chain head (`SELECT … FOR UPDATE`),
so concurrent tills are numbered one after another. Checked against a real
Postgres with 8 concurrent sales.

**Idempotency.** `dedupeKey` (unique): `<orderId>:SALE`,
`<orderId>:CANCELLATION`, `<orderId>:REFUND:<cumulative refunded total>`.

## 3. How each condition is met

**Inaltérabilité.** A recorded sale is never edited or deleted. Corrections are
new entries (REFUND, CANCELLATION) that reference the sale. Postgres triggers
refuse UPDATE, DELETE and TRUNCATE on every fiscal table (migration
`20261030090000_fiscal_journal`). Anyone who gets around the triggers (a
superuser) still can't hide it: a changed record no longer matches its hash, a
recomputed hash no longer matches its signature or the next record's `prev`,
a removed record leaves a gap in `seq`. The order route also refuses to change
a paid order's payment note, and the schema only accepts a payment method with
Mark as Paid.

**Sécurisation.** Ed25519 signature and hash chain on every entry, closure and
archive. Perpetual totals on every entry: `totals.net` (signed sum) and
`totals.absolute` (sum of absolute values, the "grand total perpétuel"). DAY,
MONTH and YEAR closures freeze the period's totals (sales, refunds,
cancellations, net, tax by rate, tenders) and the perpetual totals at its end.
Months close from their day closures, years from their month closures.
Closures run when a sale opens a new business day (after the response), when the
owner opens the Fiscal journal page, and hourly (Inngest `fiscal-maintenance`).

**Conservation.** No foreign keys, so the journal outlives orders, stores and
accounts, including the 365-day account purge. It holds no customer contact
details. Terms (section 11) and the Privacy Policy say it is kept six years.
No purge exists yet: the first records reach six years in 2032. A retention job
then must replace the trigger function in its own migration.

**Archivage.** When a month closes, its entries, day closures and month closure
are written to one JSON document, gzipped and stored, and its sha256 is signed on
the store's ARCHIVE chain. The owner downloads it from the Fiscal journal page
(`/api/stores/[id]/fiscal/archives/[archiveId]`); the current month exports
unsigned-envelope (`/fiscal/export?month=`). The document carries the public
keys, and `npx tsx scripts/fiscal-verify.ts <file>` checks it with nothing but
`node:crypto`.

**Verification.** "Check the journal" (`POST /fiscal/verify`, `verify.ts`)
recomputes everything from the records: hashes, links, `seq`, signatures,
perpetual totals, each closure's end totals against its last entry, each
archive's content hash; plus paid orders with no SALE entry.

## 4. Attestation

`src/lib/fiscal/attestation.ts` holds the fiscal module version (`1-000`,
major root `1`, placed on the market 2026-11-02), the covered and excluded
functions, and `FISCAL_PUBLISHER`: Prionation's legal details, **empty until the
operator fills them in**. `isFiscalAttestationReady()` is false while any field
is empty, and it gates everything that claims compliance:

- the attestation page (`/store/[id]/fiscal/attestation`, printable, part 1
  pre-signed from `signatureImage`, part 2 for the business to sign);
- `NF525_SETTLED` (home page compliance section and hero fact on the French
  site, FAQ q6 on fr/en, and the French "switch fully" path).

**Versions.** A change to how sales are recorded, secured, kept or archived is a
MAJOR version (BOI-TVA-DECLA-30-10-30 § 340): bump `FISCAL_MODULE.major`, and
the attestation must be re-issued. Other releases are minor (`1-001`, …).

## 5. Limits (keep the attestation's "non couvertes" list in step)

- **Offline sales** sit on the device until they sync, and only then are
  journaled and signed (with the device's sale time in `order.orderedAt`,
  `offline: true`). Between the two they are not secured. Listed as not covered.
  The alternative is to switch offline selling off for French businesses.
- **Held bills** are not payments and are not journaled until they are paid.
- The **publisher holds the signing key**. The chain proves nothing was changed
  after the fact by anyone without the key; the merchant's downloaded archives
  are their independent copy.
- No **technical event log** (JET) or **duplicate-receipt counter**: the NF525
  standard asks for them, the law's four conditions don't. Worth adding before
  any certification audit.
- Receipts don't print the fiscal sequence number or signature.

## 6. Operator checklist

See STATUS.md, "NF525". In short: fill `FISCAL_PUBLISHER` and add the signature
image; have an accountant read sections 3 and 5; run the migration on dev; sync
Inngest in prod (the hourly job); optionally set `FISCAL_SIGNING_KEY`.
