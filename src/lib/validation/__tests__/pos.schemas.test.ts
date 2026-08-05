/**
 * POS Validation Schemas Tests
 *
 * Tests for updateOrderStatusSchema, in particular the "mark as paid" fields
 * (paymentMethod/paymentNote) added alongside the settle-payment dialog.
 */

import { describe, it, expect } from "vitest";
import { updateOrderStatusSchema, settlePaymentMethodEnum } from "../pos.schemas";

describe("updateOrderStatusSchema", () => {
  it("accepts a plain status update", () => {
    const result = updateOrderStatusSchema.safeParse({ status: "CONFIRMED" });
    expect(result.success).toBe(true);
  });

  it("accepts marking paid with a settle payment method and note", () => {
    const result = updateOrderStatusSchema.safeParse({
      paymentStatus: "PAID",
      paymentMethod: "QRIS",
      paymentNote: "Client paid directly to the owner",
    });
    expect(result.success).toBe(true);
  });

  it("accepts marking paid with no payment method/note (both optional)", () => {
    const result = updateOrderStatusSchema.safeParse({ paymentStatus: "PAID" });
    expect(result.success).toBe(true);
  });

  it("rejects when neither status nor paymentStatus is provided", () => {
    const result = updateOrderStatusSchema.safeParse({ paymentMethod: "CASH" });
    expect(result.success).toBe(false);
  });

  it("rejects a paymentMethod without paymentStatus: PAID", () => {
    const result = updateOrderStatusSchema.safeParse({
      status: "CONFIRMED",
      paymentMethod: "CASH",
    });
    expect(result.success).toBe(false);
  });

  it("rejects PAY_LATER as a settle payment method", () => {
    const result = updateOrderStatusSchema.safeParse({
      paymentStatus: "PAID",
      paymentMethod: "PAY_LATER",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a paymentNote over 300 characters", () => {
    const result = updateOrderStatusSchema.safeParse({
      paymentStatus: "PAID",
      paymentNote: "a".repeat(301),
    });
    expect(result.success).toBe(false);
  });
});

describe("settlePaymentMethodEnum", () => {
  it("excludes PAY_LATER from the settle-payment options", () => {
    expect(settlePaymentMethodEnum.options).not.toContain("PAY_LATER");
  });

  it("still offers every real payment method", () => {
    expect(settlePaymentMethodEnum.options).toEqual([
      "CASH",
      "QRIS",
      "GOPAY",
      "OVO",
      "DANA",
      "SHOPEEPAY",
      "BANK_TRANSFER",
      "STRIPE_CARD",
    ]);
  });
});
