import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * The journal end to end against a small in-memory database: what a sale,
 * refund and cancellation append, that the chain links and signs, that
 * appends are idempotent, and that the verifier catches every kind of
 * tampering (an edited record, an edited column, a removed record).
 */

interface Row {
  [key: string]: unknown;
}

// var: vi.mock factories are hoisted above declarations.
var db: ReturnType<typeof makeDb>;

function makeDb() {
  const heads = new Map<string, Row>();
  const entries: Row[] = [];
  const keys: Row[] = [];
  const orders = new Map<string, Row>();
  let missingSales = 0;

  const pick = (row: Row, select?: Record<string, unknown>) =>
    select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : row;

  // SAVEPOINT / ROLLBACK TO SAVEPOINT, as Postgres does them: a rollback undoes
  // every write since the savepoint.
  let savepoint: { entries: number; heads: [string, Row][]; keys: number } | null = null;

  const client = {
    $executeRawUnsafe: vi.fn(async (sql: string) => {
      if (sql.startsWith("SAVEPOINT")) {
        savepoint = {
          entries: entries.length,
          heads: [...heads].map(([k, v]) => [k, { ...v }]),
          keys: keys.length,
        };
      } else if (sql.startsWith("ROLLBACK TO SAVEPOINT") && savepoint) {
        entries.splice(savepoint.entries);
        keys.splice(savepoint.keys);
        heads.clear();
        for (const [k, v] of savepoint.heads) heads.set(k, v);
      }
      return 0;
    }),
    $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (strings.join("?").includes('INSERT INTO "fiscal_chain_heads"')) {
        const key = `${values[0]}:${values[1]}`;
        if (!heads.has(key)) {
          heads.set(key, {
            lastSeq: 0,
            lastHash: "",
            lastDay: "",
            totalNet: new Prisma.Decimal(0),
            totalAbsolute: new Prisma.Decimal(0),
          });
        }
      }
      return 1;
    }),
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      if (sql.includes('FROM "fiscal_chain_heads"')) {
        const head = heads.get(`${values[0]}:${values[1]}`);
        return head ? [{ ...head }] : [];
      }
      if (sql.includes("COUNT(*)") && sql.includes("refundAmount")) return [{ count: BigInt(0) }];
      if (sql.includes("COUNT(*)")) return [{ count: BigInt(missingSales) }];
      return [];
    }),
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(client)),
    store: {
      findUnique: vi.fn(async () => ({
        syncFinanceWithBusiness: false,
        financeSettings: { currency: "EUR" },
        business: { timezone: "Europe/Paris", financeSettings: null },
      })),
    },
    order: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; storeId: string } }) => {
        const order = orders.get(where.id);
        return order && order.storeId === where.storeId ? order : null;
      }),
    },
    fiscalChainHead: {
      update: vi.fn(async ({ where, data }: { where: { storeId_chain: Row }; data: Row }) => {
        const key = `${where.storeId_chain.storeId}:${where.storeId_chain.chain}`;
        heads.set(key, { ...heads.get(key), ...data });
      }),
      findUnique: vi.fn(async () => null),
    },
    fiscalEntry: {
      findUnique: vi.fn(
        async ({ where, select }: { where: { dedupeKey: string }; select?: Row }) => {
          const row = entries.find((e) => e.dedupeKey === where.dedupeKey);
          return row ? pick(row, select) : null;
        }
      ),
      create: vi.fn(async ({ data }: { data: Row }) => {
        entries.push({ ...data });
        return data;
      }),
      findMany: vi.fn(
        async ({
          where,
          take,
          select,
        }: {
          where: { storeId: string; seq?: { gt: number } };
          take?: number;
          select?: Row;
        }) =>
          entries
            .filter((e) => e.storeId === where.storeId && (e.seq as number) > (where.seq?.gt ?? 0))
            .sort((a, b) => (a.seq as number) - (b.seq as number))
            .slice(0, take ?? Infinity)
            .map((e) => pick(e, select))
      ),
    },
    fiscalSigningKey: {
      createMany: vi.fn(async ({ data }: { data: Row[] }) => {
        for (const k of data) if (!keys.some((x) => x.keyId === k.keyId)) keys.push(k);
        return { count: 1 };
      }),
      findMany: vi.fn(async () => keys),
    },
    fiscalClosure: { findMany: vi.fn(async () => []) },
    fiscalArchive: { findMany: vi.fn(async () => []) },
  };

  return {
    client,
    heads,
    entries,
    orders,
    setMissingSales: (n: number) => {
      missingSales = n;
    },
  };
}

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return db.client;
  },
}));

import { recordCancellationInTx, recordRefundInTx, recordSaleInTx } from "../journal";
import { verifyFiscalJournal } from "../verify";
import { resetFiscalSignerForTests, sha256Hex } from "../signing";

const STORE = "store-1";
const tx = () => db.client as unknown as Prisma.TransactionClient;

function addOrder(id: string, overrides: Row = {}) {
  db.orders.set(id, {
    id,
    storeId: STORE,
    orderNumber: `POS-${id}`,
    orderDate: new Date("2026-11-02T09:00:00Z"),
    createdAt: new Date("2026-11-02T09:00:00Z"),
    source: "POS",
    orderType: "DINE_IN",
    subtotal: new Prisma.Decimal("20.00"),
    discountAmount: new Prisma.Decimal(0),
    serviceCharge: new Prisma.Decimal(0),
    delivery: new Prisma.Decimal(0),
    tax: new Prisma.Decimal("1.82"),
    taxRate: new Prisma.Decimal("0.1000"),
    total: new Prisma.Decimal("20.00"),
    refundAmount: new Prisma.Decimal(0),
    paymentMethod: "CASH",
    paymentStatus: "PAID",
    status: "DELIVERED",
    customerName: "Jeanne Dupont",
    items: [
      {
        name: "Latte",
        quantity: new Prisma.Decimal(2),
        unitPrice: new Prisma.Decimal("10.00"),
        total: new Prisma.Decimal("20.00"),
        selectedOptions: [{ groupName: "Milk", optionName: "Oat", priceAdjustment: 0 }],
      },
    ],
    payments: [
      {
        method: "CASH",
        amount: new Prisma.Decimal("20.00"),
        refundedAmount: new Prisma.Decimal(0),
      },
    ],
    ...overrides,
  });
}

const payloadOf = (i: number) => JSON.parse(db.entries[i].payload as string);

beforeEach(() => {
  db = makeDb();
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-for-the-fiscal-journal");
  vi.stubEnv("FISCAL_SIGNING_KEY", "");
  resetFiscalSignerForTests();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  resetFiscalSignerForTests();
});

describe("recording", () => {
  it("chains sales: numbered, linked, signed, perpetual totals added up", async () => {
    addOrder("a");
    addOrder("b", { total: new Prisma.Decimal("5.50"), payments: [] });
    await recordSaleInTx(tx(), { storeId: STORE, orderId: "a" });
    await recordSaleInTx(tx(), { storeId: STORE, orderId: "b" });

    expect(db.entries).toHaveLength(2);
    const [first, second] = [payloadOf(0), payloadOf(1)];
    expect(first).toMatchObject({
      seq: 1,
      kind: "SALE",
      prev: "",
      amount: "20.00",
      currency: "EUR",
    });
    expect(first.totals).toEqual({ net: "20.00", absolute: "20.00" });
    expect(first.lines[0]).toEqual({
      name: "Latte",
      qty: "2.00",
      unitPrice: "10.00",
      total: "20.00",
      options: ["Milk: Oat"],
    });
    expect(second).toMatchObject({ seq: 2, prev: db.entries[0].hash, amount: "5.50" });
    // An order with no tender rows is paid by its own method.
    expect(second.tenders).toEqual([{ method: "CASH", amount: "5.50" }]);
    expect(second.totals).toEqual({ net: "25.50", absolute: "25.50" });
    expect(db.entries[0].hash).toBe(sha256Hex(db.entries[0].payload as string));
    expect(db.entries[0].signature).toBeTruthy();
    expect(db.entries[0].businessDay).toBe("2026-11-02");
  });

  it("keeps customer details out of the record", async () => {
    addOrder("a");
    await recordSaleInTx(tx(), { storeId: STORE, orderId: "a" });
    expect(db.entries[0].payload).not.toContain("Jeanne");
  });

  it("is idempotent: the same sale recorded twice is one entry", async () => {
    addOrder("a");
    await recordSaleInTx(tx(), { storeId: STORE, orderId: "a" });
    await recordSaleInTx(tx(), { storeId: STORE, orderId: "a" });
    expect(db.entries).toHaveLength(1);
  });

  it("records nothing for an unpaid order", async () => {
    addOrder("a", { paymentStatus: "PENDING" });
    await recordSaleInTx(tx(), { storeId: STORE, orderId: "a" });
    await recordCancellationInTx(tx(), { storeId: STORE, orderId: "a" });
    expect(db.entries).toHaveLength(0);
  });

  it("a refund is a negative entry pointing at its sale", async () => {
    addOrder("a");
    await recordSaleInTx(tx(), { storeId: STORE, orderId: "a" });
    db.orders.get("a")!.refundAmount = new Prisma.Decimal("5.00");
    await recordRefundInTx(tx(), {
      storeId: STORE,
      orderId: "a",
      amount: 5,
      reason: "Cold coffee",
      tenders: [{ method: "CASH", amount: 5 }],
      refundedTotal: 5,
    });
    const refund = payloadOf(1);
    expect(refund).toMatchObject({ kind: "REFUND", amount: "-5.00", reason: "Cold coffee" });
    expect(refund.ref).toEqual({ seq: 1, hash: db.entries[0].hash });
    expect(refund.tenders).toEqual([{ method: "CASH", amount: "-5.00" }]);
    expect(refund.tax).toBe("-0.46");
    expect(refund.totals).toEqual({ net: "15.00", absolute: "25.00" });
  });

  it("a cancel takes back only what the refunds left", async () => {
    addOrder("a");
    await recordSaleInTx(tx(), { storeId: STORE, orderId: "a" });
    Object.assign(db.orders.get("a")!, {
      refundAmount: new Prisma.Decimal("5.00"),
      payments: [
        {
          method: "CASH",
          amount: new Prisma.Decimal("20.00"),
          refundedAmount: new Prisma.Decimal("5.00"),
        },
      ],
      status: "CANCELLED",
    });
    await recordCancellationInTx(tx(), { storeId: STORE, orderId: "a" });
    await recordCancellationInTx(tx(), { storeId: STORE, orderId: "a" });
    expect(db.entries).toHaveLength(2);
    expect(payloadOf(1)).toMatchObject({ kind: "CANCELLATION", amount: "-15.00" });
    expect(payloadOf(1).tenders).toEqual([{ method: "CASH", amount: "-15.00" }]);
  });

  it("a refund of a sale nobody recorded records the sale first, flagged late", async () => {
    addOrder("a");
    await recordRefundInTx(tx(), {
      storeId: STORE,
      orderId: "a",
      amount: 20,
      tenders: [{ method: "CASH", amount: 20 }],
      refundedTotal: 20,
    });
    expect(db.entries.map((e) => [e.kind, e.late])).toEqual([
      ["SALE", true],
      ["REFUND", false],
    ]);
  });

  it("business days never run backwards", async () => {
    addOrder("a");
    addOrder("b");
    await recordSaleInTx(tx(), { storeId: STORE, orderId: "a" });
    db.heads.get(`${STORE}:ENTRY`)!.lastDay = "2026-11-03";
    await recordSaleInTx(tx(), { storeId: STORE, orderId: "b" });
    expect(db.entries[1].businessDay).toBe("2026-11-03");
  });

  it("a failed journal write never fails the payment, and leaves no half-written record", async () => {
    addOrder("a");
    addOrder("b");
    vi.spyOn(console, "error").mockImplementation(() => {});
    // e.g. the fiscal tables missing on a database that was not migrated
    db.client.fiscalChainHead.update.mockRejectedValueOnce(
      new Error('relation "fiscal_chain_heads" does not exist')
    );

    await expect(recordSaleInTx(tx(), { storeId: STORE, orderId: "a" })).resolves.toBeUndefined();
    expect(db.entries).toHaveLength(0);
    expect(db.client.$executeRawUnsafe).toHaveBeenCalledWith(
      "ROLLBACK TO SAVEPOINT fiscal_journal"
    );

    // The chain carries on from where it was: the next sale is seq 1, not 2.
    await recordSaleInTx(tx(), { storeId: STORE, orderId: "b" });
    expect(db.entries.map((e) => e.seq)).toEqual([1]);
  });

  it("still records, unsigned, when no secret is configured", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    resetFiscalSignerForTests();
    addOrder("a");
    await recordSaleInTx(tx(), { storeId: STORE, orderId: "a" });
    expect(db.entries[0]).toMatchObject({ signature: null, keyId: null });
    expect(db.entries[0].hash).toBe(sha256Hex(db.entries[0].payload as string));
  });
});

describe("verification", () => {
  async function threeSales() {
    for (const id of ["a", "b", "c"]) {
      addOrder(id);
      await recordSaleInTx(tx(), { storeId: STORE, orderId: id });
    }
  }

  it("passes an untouched journal", async () => {
    await threeSales();
    const result = await verifyFiscalJournal(STORE);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.entries).toEqual({ count: 3, lastSeq: 3, unsigned: 0 });
  });

  it("catches an edited record", async () => {
    await threeSales();
    db.entries[1].payload = (db.entries[1].payload as string).replace('"20.00"', '"2.00"');
    const result = await verifyFiscalJournal(STORE);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.problem)).toContain(
      "content does not match its hash (altered)"
    );
  });

  it("catches an edited record whose hash was recomputed (the signature breaks)", async () => {
    await threeSales();
    const forged = (db.entries[1].payload as string).replace('"name":"Latte"', '"name":"Water"');
    db.entries[1].payload = forged;
    db.entries[1].hash = sha256Hex(forged);
    const problems = (await verifyFiscalJournal(STORE)).issues.map((i) => i.problem);
    expect(problems).toContain("signature does not match (altered or forged)");
    expect(problems).toContain("not linked to the previous record");
  });

  it("catches an edited amount column", async () => {
    await threeSales();
    db.entries[2].amount = new Prisma.Decimal("1.00");
    const problems = (await verifyFiscalJournal(STORE)).issues.map((i) => i.problem);
    expect(problems).toContain("stored columns differ from the signed record");
  });

  it("catches a removed record", async () => {
    await threeSales();
    db.entries.splice(1, 1);
    const problems = (await verifyFiscalJournal(STORE)).issues.map((i) => i.problem);
    expect(problems).toContain("sequence jumps from 1 to 3");
  });

  it("reports paid orders that are missing from the journal", async () => {
    await threeSales();
    db.setMissingSales(2);
    const result = await verifyFiscalJournal(STORE);
    expect(result.ok).toBe(false);
    expect(result.missingSales).toBe(2);
  });

  it("counts unsigned records without failing them", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    resetFiscalSignerForTests();
    await threeSales();
    const result = await verifyFiscalJournal(STORE);
    expect(result.ok).toBe(true);
    expect(result.entries.unsigned).toBe(3);
  });
});
