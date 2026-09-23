import { describe, it, expect } from "vitest";
import {
  allocateRefund,
  computeTendersProcessingFee,
  legacyToTenders,
  MAX_TENDERS,
  normalizeTenders,
  resolveOrderPaymentMethod,
  type TenderInput,
  type TenderMethod,
} from "../order-payments";
import { computeOrderCharges, type ResolvedFinanceSettings } from "../order-charges";

describe("normalizeTenders", () => {
  it("accepts one cash tender and derives the change", () => {
    const out = normalizeTenders(36_000, [
      { method: "CASH", amount: 36_000, amountTendered: 50_000 },
    ]);
    expect(out).toEqual({
      ok: true,
      tenders: [
        { method: "CASH", amount: 36_000, amountTendered: 50_000, change: 14_000, note: null },
      ],
    });
  });

  it("accepts a three-way split across different methods", () => {
    const out = normalizeTenders(36_000, [
      { method: "CASH", amount: 12_000, amountTendered: 20_000 },
      { method: "STRIPE_CARD", amount: 12_000 },
      { method: "QRIS", amount: 12_000 },
    ]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.tenders.map((t) => t.change)).toEqual([8_000, null, null]);
  });

  it("tolerates float noise in the sum", () => {
    const out = normalizeTenders(100, [
      { method: "CASH", amount: 33.33 },
      { method: "QRIS", amount: 33.33 },
      { method: "STRIPE_CARD", amount: 33.34 },
    ]);
    expect(out.ok).toBe(true);
  });

  it("requires the tenders to cover the total exactly", () => {
    const short = normalizeTenders(36_000, [
      { method: "CASH", amount: 20_000 },
      { method: "QRIS", amount: 10_000 },
    ]);
    expect(short).toMatchObject({ ok: false, error: { code: "SUM_MISMATCH" } });
    const over = normalizeTenders(36_000, [{ method: "QRIS", amount: 40_000 }]);
    expect(over).toMatchObject({ ok: false, error: { code: "SUM_MISMATCH" } });
  });

  it("rejects an empty list and too many tenders", () => {
    expect(normalizeTenders(100, [])).toMatchObject({ ok: false, error: { code: "EMPTY" } });
    const many: TenderInput[] = Array.from({ length: MAX_TENDERS + 1 }, () => ({
      method: "CASH",
      amount: 1,
    }));
    expect(normalizeTenders(MAX_TENDERS + 1, many)).toMatchObject({
      ok: false,
      error: { code: "TOO_MANY" },
    });
  });

  it("rejects a zero or negative tender and points at the row", () => {
    expect(
      normalizeTenders(100, [
        { method: "CASH", amount: 100 },
        { method: "QRIS", amount: 0 },
      ])
    ).toMatchObject({ ok: false, error: { code: "NON_POSITIVE", index: 1 } });
  });

  it("rejects cash handed over below the amount due", () => {
    expect(
      normalizeTenders(100, [{ method: "CASH", amount: 100, amountTendered: 90 }])
    ).toMatchObject({ ok: false, error: { code: "CASH_UNDERPAID", index: 0 } });
  });

  it("requires a label for OTHER and trims it", () => {
    expect(normalizeTenders(100, [{ method: "OTHER", amount: 100, note: "  " }])).toMatchObject({
      ok: false,
      error: { code: "NOTE_REQUIRED" },
    });
    const out = normalizeTenders(100, [{ method: "OTHER", amount: 100, note: " Crypto " }]);
    expect(out.ok && out.tenders[0].note).toBe("Crypto");
  });

  it("refuses PAY_LATER and SPLIT as a tender even if a client sends them", () => {
    for (const method of ["PAY_LATER", "SPLIT"]) {
      expect(
        normalizeTenders(100, [{ method: method as TenderMethod, amount: 100 }])
      ).toMatchObject({ ok: false, error: { code: "INVALID_METHOD" } });
    }
  });

  it("ignores amountTendered on non-cash methods", () => {
    const out = normalizeTenders(100, [{ method: "QRIS", amount: 100, amountTendered: 500 }]);
    expect(out.ok && out.tenders[0]).toMatchObject({ amountTendered: null, change: null });
  });

  it("leaves tendered/change null for cash when none was entered", () => {
    const out = normalizeTenders(100, [{ method: "CASH", amount: 100 }]);
    expect(out.ok && out.tenders[0]).toMatchObject({ amountTendered: null, change: null });
  });
});

describe("resolveOrderPaymentMethod", () => {
  it("is the method itself for one tender", () => {
    expect(resolveOrderPaymentMethod([{ method: "QRIS" }])).toBe("QRIS");
  });

  it("is SPLIT for two or more, even of the same method", () => {
    expect(resolveOrderPaymentMethod([{ method: "CASH" }, { method: "CASH" }])).toBe("SPLIT");
    expect(resolveOrderPaymentMethod([{ method: "CASH" }, { method: "QRIS" }])).toBe("SPLIT");
  });
});

describe("legacyToTenders", () => {
  it("maps the old single-method payload to one tender for the whole total", () => {
    expect(legacyToTenders({ paymentMethod: "CASH", amountTendered: 50_000 }, 36_000)).toEqual([
      { method: "CASH", amount: 36_000, amountTendered: 50_000, note: null },
    ]);
  });

  it("drops a stray amountTendered on a non-cash method", () => {
    expect(
      legacyToTenders({ paymentMethod: "QRIS", amountTendered: 5 }, 10)[0].amountTendered
    ).toBeNull();
  });

  it("carries the paymentNote only for OTHER", () => {
    expect(legacyToTenders({ paymentMethod: "OTHER", paymentNote: "Crypto" }, 10)[0].note).toBe(
      "Crypto"
    );
    expect(legacyToTenders({ paymentMethod: "QRIS", paymentNote: "x" }, 10)[0].note).toBeNull();
  });

  it("round-trips through normalizeTenders", () => {
    const out = normalizeTenders(
      36_000,
      legacyToTenders({ paymentMethod: "CASH", amountTendered: 50_000 }, 36_000)
    );
    expect(out.ok && out.tenders[0].change).toBe(14_000);
  });
});

describe("computeTendersProcessingFee", () => {
  const feeOn: ResolvedFinanceSettings = {
    taxEnabled: false,
    taxRate: 0,
    taxInclusive: true,
    serviceChargeEnabled: false,
    serviceChargeRate: 0,
    processingFeeEnabled: true,
    processingFeeOverrides: null,
  };

  it("is zero when processing fees are off", () => {
    expect(
      computeTendersProcessingFee({
        tenders: [{ method: "QRIS", amount: 100_000 }],
        enabled: false,
      })
    ).toEqual({ fee: 0, rate: 0 });
  });

  it("for ONE tender is identical to computeOrderCharges, fee and persisted rate", () => {
    for (const method of ["CASH", "QRIS", "STRIPE_CARD", "BANK_TRANSFER"] as const) {
      const charges = computeOrderCharges({
        itemsTotal: 100_000,
        paymentMethod: method,
        settings: feeOn,
      });
      const out = computeTendersProcessingFee({
        tenders: [{ method, amount: charges.total }],
        enabled: true,
      });
      expect(out.fee).toBe(charges.processingFee);
      expect(out.rate).toBe(charges.processingFeeRate);
    }
  });

  it("sums each tender at its own method's rate and reports the blended rate", () => {
    const out = computeTendersProcessingFee({
      tenders: [
        { method: "CASH", amount: 50_000 },
        { method: "QRIS", amount: 50_000 },
      ],
      enabled: true,
    });
    expect(out.fee).toBe(350);
    expect(out.rate).toBe(0.0035);
  });

  it("honours per-method overrides", () => {
    const out = computeTendersProcessingFee({
      tenders: [
        { method: "QRIS", amount: 50_000 },
        { method: "GOPAY", amount: 50_000 },
      ],
      enabled: true,
      overrides: { QRIS: { percent: 0.01, flat: 0 } },
    });
    // 500 (QRIS override) + 1000 (GOPAY default 2%)
    expect(out.fee).toBe(1_500);
  });
});

describe("allocateRefund", () => {
  const split = [
    { id: "cash", method: "CASH" as const, amount: 20_000, refundedAmount: 0 },
    { id: "card", method: "STRIPE_CARD" as const, amount: 16_000, refundedAmount: 0 },
  ];

  it("gives a single-tender order no choice to make", () => {
    expect(
      allocateRefund([{ id: "a", method: "CASH", amount: 100, refundedAmount: 0 }], 40)
    ).toEqual({ ok: true, allocations: [{ paymentId: "a", amount: 40 }] });
  });

  it("accepts the single tender's own id, but rejects an id from somewhere else", () => {
    const only = [{ id: "a", method: "CASH" as const, amount: 100, refundedAmount: 0 }];
    expect(allocateRefund(only, 40, "a")).toEqual({
      ok: true,
      allocations: [{ paymentId: "a", amount: 40 }],
    });
    expect(allocateRefund(only, 40, "someone-elses")).toMatchObject({
      ok: false,
      code: "TENDER_NOT_FOUND",
    });
  });

  it("caps a single tender at what is left on it", () => {
    expect(
      allocateRefund([{ id: "a", method: "CASH", amount: 100, refundedAmount: 70 }], 40)
    ).toMatchObject({ ok: false, code: "TENDER_EXCEEDED" });
  });

  it("attributes a split-order refund to the named tender", () => {
    expect(allocateRefund(split, 5_000, "card")).toEqual({
      ok: true,
      allocations: [{ paymentId: "card", amount: 5_000 }],
    });
  });

  it("rejects an unknown tender or one that can't cover it", () => {
    expect(allocateRefund(split, 100, "nope")).toMatchObject({
      ok: false,
      code: "TENDER_NOT_FOUND",
    });
    expect(allocateRefund(split, 17_000, "card")).toMatchObject({
      ok: false,
      code: "TENDER_EXCEEDED",
    });
  });

  it("takes prior refunds on that tender into account", () => {
    const partly = [
      { id: "cash", method: "CASH" as const, amount: 20_000, refundedAmount: 15_000 },
      { id: "card", method: "STRIPE_CARD" as const, amount: 16_000, refundedAmount: 0 },
    ];
    expect(allocateRefund(partly, 6_000, "cash")).toMatchObject({
      ok: false,
      code: "TENDER_EXCEEDED",
    });
    expect(allocateRefund(partly, 5_000, "cash")).toMatchObject({ ok: true });
  });

  it("refuses a partial refund on a split order with no tender named", () => {
    expect(allocateRefund(split, 5_000)).toMatchObject({ ok: false, code: "TENDER_REQUIRED" });
  });

  it("refunds every tender in full when the amount is exactly what's outstanding", () => {
    expect(allocateRefund(split, 36_000)).toEqual({
      ok: true,
      allocations: [
        { paymentId: "cash", amount: 20_000 },
        { paymentId: "card", amount: 16_000 },
      ],
    });
  });

  it("skips tenders already fully refunded when refunding the rest", () => {
    const partly = [
      { id: "cash", method: "CASH" as const, amount: 20_000, refundedAmount: 20_000 },
      { id: "card", method: "STRIPE_CARD" as const, amount: 16_000, refundedAmount: 0 },
    ];
    expect(allocateRefund(partly, 16_000)).toEqual({
      ok: true,
      allocations: [{ paymentId: "card", amount: 16_000 }],
    });
  });
});
