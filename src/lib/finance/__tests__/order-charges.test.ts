import { describe, it, expect } from "vitest";
import { computeOrderCharges, computeRefund, type ResolvedFinanceSettings } from "../order-charges";

const disabledSettings: ResolvedFinanceSettings = {
  taxEnabled: false,
  taxRate: 0,
  taxInclusive: true,
  serviceChargeEnabled: false,
  serviceChargeRate: 0,
  processingFeeEnabled: false,
  processingFeeOverrides: null,
};

describe("computeOrderCharges", () => {
  it("everything disabled: total = itemsTotal + delivery, no fee/tax", () => {
    const result = computeOrderCharges({
      itemsTotal: 100_000,
      delivery: 5_000,
      paymentMethod: "QRIS",
      settings: disabledSettings,
    });
    expect(result).toMatchObject({
      subtotal: 100_000,
      serviceCharge: 0,
      tax: 0,
      total: 105_000,
      processingFee: 0,
    });
  });

  it("exclusive mode: tax only is added on top of itemsTotal", () => {
    const result = computeOrderCharges({
      itemsTotal: 100_000,
      paymentMethod: "CASH",
      settings: { ...disabledSettings, taxEnabled: true, taxRate: 0.11, taxInclusive: false },
    });
    expect(result.subtotal).toBe(100_000);
    expect(result.tax).toBe(11_000);
    expect(result.serviceCharge).toBe(0);
    expect(result.total).toBe(111_000);
  });

  it("exclusive mode: service charge only is added on top", () => {
    const result = computeOrderCharges({
      itemsTotal: 100_000,
      paymentMethod: "CASH",
      settings: {
        ...disabledSettings,
        serviceChargeEnabled: true,
        serviceChargeRate: 0.05,
        taxInclusive: false,
      },
    });
    expect(result.serviceCharge).toBe(5_000);
    expect(result.tax).toBe(0);
    expect(result.total).toBe(105_000);
  });

  it("exclusive mode: tax is computed on itemsTotal + serviceCharge (service charge is taxable)", () => {
    const result = computeOrderCharges({
      itemsTotal: 100_000,
      paymentMethod: "CASH",
      settings: {
        ...disabledSettings,
        taxEnabled: true,
        taxRate: 0.11,
        serviceChargeEnabled: true,
        serviceChargeRate: 0.05,
        taxInclusive: false,
      },
    });
    expect(result.serviceCharge).toBe(5_000);
    expect(result.tax).toBe(11_550); // 11% of 105,000
    expect(result.total).toBe(116_550);
  });

  it("inclusive mode: backs tax + service charge out of itemsTotal, total is unchanged", () => {
    const settings: ResolvedFinanceSettings = {
      ...disabledSettings,
      taxEnabled: true,
      taxRate: 0.11,
      serviceChargeEnabled: true,
      serviceChargeRate: 0.05,
      taxInclusive: true,
    };
    // Same gross figure as the exclusive-mode combined test above (116,550)
    const result = computeOrderCharges({ itemsTotal: 116_550, paymentMethod: "CASH", settings });
    expect(result.subtotal).toBe(100_000);
    expect(result.serviceCharge).toBe(5_000);
    expect(result.tax).toBe(11_550);
    expect(result.total).toBe(116_550); // customer pays the same price shown on the menu
    // components must sum back to itemsTotal exactly, no rounding drift
    expect(result.subtotal + result.serviceCharge + result.tax).toBe(116_550);
  });

  it("inclusive mode with delivery: delivery is not part of the backed-out gross", () => {
    const settings: ResolvedFinanceSettings = {
      ...disabledSettings,
      taxEnabled: true,
      taxRate: 0.1,
      taxInclusive: true,
    };
    const result = computeOrderCharges({
      itemsTotal: 110_000,
      delivery: 10_000,
      paymentMethod: "CASH",
      settings,
    });
    expect(result.subtotal).toBe(100_000);
    expect(result.tax).toBe(10_000);
    expect(result.total).toBe(120_000); // itemsTotal + delivery
  });

  it("rounds tax to 2 decimal places on odd amounts", () => {
    const result = computeOrderCharges({
      itemsTotal: 99_999,
      paymentMethod: "CASH",
      settings: { ...disabledSettings, taxEnabled: true, taxRate: 0.11, taxInclusive: false },
    });
    expect(result.tax).toBe(10_999.89);
    expect(result.total).toBe(110_998.89);
  });

  it("processing fee is computed on the final total using the default rate table", () => {
    const result = computeOrderCharges({
      itemsTotal: 111_000,
      paymentMethod: "QRIS",
      settings: { ...disabledSettings, processingFeeEnabled: true },
    });
    // QRIS default: 0.7%, no flat
    expect(result.processingFee).toBe(Math.round(111_000 * 0.007 * 100) / 100);
    expect(result.processingFeeRate).toBe(0.007);
  });

  it("processing fee respects flat-fee methods (bank transfer)", () => {
    const result = computeOrderCharges({
      itemsTotal: 50_000,
      paymentMethod: "BANK_TRANSFER",
      settings: { ...disabledSettings, processingFeeEnabled: true },
    });
    expect(result.processingFee).toBe(4_400);
  });

  it("processing fee respects merchant overrides over the shipped defaults", () => {
    const result = computeOrderCharges({
      itemsTotal: 100_000,
      paymentMethod: "QRIS",
      settings: {
        ...disabledSettings,
        processingFeeEnabled: true,
        processingFeeOverrides: { QRIS: { percent: 0.01, flat: 500 } },
      },
    });
    expect(result.processingFee).toBe(1_500); // 1% of 100,000 + 500
  });

  it("processing fee is 0 when disabled even if a rate table exists", () => {
    const result = computeOrderCharges({
      itemsTotal: 100_000,
      paymentMethod: "STRIPE_CARD",
      settings: { ...disabledSettings, processingFeeEnabled: false },
    });
    expect(result.processingFee).toBe(0);
    expect(result.processingFeeRate).toBe(0);
  });

  it("exclusive mode: discount reduces subtotal before tax/service charge are computed", () => {
    const result = computeOrderCharges({
      itemsTotal: 100_000,
      discountAmount: 20_000,
      paymentMethod: "CASH",
      settings: {
        ...disabledSettings,
        taxEnabled: true,
        taxRate: 0.11,
        serviceChargeEnabled: true,
        serviceChargeRate: 0.05,
        taxInclusive: false,
      },
    });
    // subtotal is discounted first (100,000 - 20,000 = 80,000), then charges
    // are computed on the discounted base — not on the full 100,000.
    expect(result.discountAmount).toBe(20_000);
    expect(result.subtotal).toBe(80_000);
    expect(result.serviceCharge).toBe(4_000); // 5% of 80,000
    expect(result.tax).toBe(9_240); // 11% of 84,000
    expect(result.total).toBe(93_240);
  });

  it("inclusive mode: discount reduces the gross before backing out tax/service charge", () => {
    const settings: ResolvedFinanceSettings = {
      ...disabledSettings,
      taxEnabled: true,
      taxRate: 0.11,
      serviceChargeEnabled: true,
      serviceChargeRate: 0.05,
      taxInclusive: true,
    };
    // Same 116,550 gross as the no-discount inclusive test, with a 16,550
    // discount bringing it down to exactly 100,000 gross.
    const result = computeOrderCharges({
      itemsTotal: 116_550,
      discountAmount: 16_550,
      paymentMethod: "CASH",
      settings,
    });
    expect(result.discountAmount).toBe(16_550);
    expect(result.total).toBe(100_000);
    // components still sum back to the discounted gross exactly
    expect(result.subtotal + result.serviceCharge + result.tax).toBe(100_000);
  });

  it("discount is clamped to itemsTotal — never produces a negative total", () => {
    const result = computeOrderCharges({
      itemsTotal: 50_000,
      discountAmount: 999_999,
      paymentMethod: "CASH",
      settings: disabledSettings,
    });
    expect(result.discountAmount).toBe(50_000);
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
  });

  it("no discountAmount passed matches legacy no-discount behavior exactly", () => {
    const result = computeOrderCharges({
      itemsTotal: 100_000,
      paymentMethod: "CASH",
      settings: disabledSettings,
    });
    expect(result.discountAmount).toBe(0);
    expect(result.total).toBe(100_000);
  });

  it("zero-settings passthrough matches legacy hardcoded-zero behavior", () => {
    const result = computeOrderCharges({
      itemsTotal: 42_500,
      paymentMethod: "CASH",
      settings: disabledSettings,
    });
    expect(result).toMatchObject({
      subtotal: 42_500,
      tax: 0,
      serviceCharge: 0,
      total: 42_500,
      processingFee: 0,
      taxRate: 0,
      serviceChargeRate: 0,
      processingFeeRate: 0,
    });
  });
});

describe("computeRefund", () => {
  it("a first full refund flips isFullyRefunded", () => {
    const result = computeRefund({ total: 100_000, alreadyRefunded: 0, amount: 100_000 });
    expect(result).toEqual({ ok: true, newRefundTotal: 100_000, isFullyRefunded: true });
  });

  it("a partial refund does not flip isFullyRefunded", () => {
    const result = computeRefund({ total: 100_000, alreadyRefunded: 0, amount: 30_000 });
    expect(result).toEqual({ ok: true, newRefundTotal: 30_000, isFullyRefunded: false });
  });

  it("a second partial refund accumulates against the first", () => {
    const result = computeRefund({ total: 100_000, alreadyRefunded: 30_000, amount: 70_000 });
    expect(result).toEqual({ ok: true, newRefundTotal: 100_000, isFullyRefunded: true });
  });

  it("rejects a refund that would exceed the remaining refundable total", () => {
    const result = computeRefund({ total: 100_000, alreadyRefunded: 30_000, amount: 80_000 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.remaining).toBe(70_000);
      expect(result.error).toContain("70000");
    }
  });

  it("rejects a zero or negative refund amount", () => {
    expect(computeRefund({ total: 100_000, alreadyRefunded: 0, amount: 0 }).ok).toBe(false);
    expect(computeRefund({ total: 100_000, alreadyRefunded: 0, amount: -5 }).ok).toBe(false);
  });

  it("rejects any further refund once already fully refunded", () => {
    const result = computeRefund({ total: 100_000, alreadyRefunded: 100_000, amount: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.remaining).toBe(0);
  });
});
