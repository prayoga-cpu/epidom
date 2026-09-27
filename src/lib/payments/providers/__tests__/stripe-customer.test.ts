import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function () {
    return { checkout: { sessions: { create } } };
  }),
}));

import { createStripeCustomerPayment, toStripeAmount } from "../stripe-customer";

describe("toStripeAmount", () => {
  it("converts two-decimal currencies to hundredths", () => {
    expect(toStripeAmount(20.5, "EUR")).toBe(2050);
    expect(toStripeAmount(14.99, "usd")).toBe(1499);
    expect(toStripeAmount(229000, "IDR")).toBe(22900000);
  });

  it("leaves zero-decimal currencies in whole units", () => {
    expect(toStripeAmount(1500, "JPY")).toBe(1500);
    expect(toStripeAmount(25000, "vnd")).toBe(25000);
  });
});

describe("createStripeCustomerPayment", () => {
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.com/c/1",
      expires_at: 1790000000,
    });
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
  });

  it("charges the order total, not a hundredth of it", async () => {
    await createStripeCustomerPayment({
      orderId: "order_1",
      amount: 20.5,
      currency: "EUR",
      customerName: "Ana",
      description: "Order 1",
      successUrl: "https://epidom.fr/ok",
      cancelUrl: "https://epidom.fr/cancel",
      stripeAccountId: "acct_123",
      applicationFeeAmount: 1.25,
    });

    const params = create.mock.calls[0][0];
    expect(params.line_items[0].price_data.unit_amount).toBe(2050);
    expect(params.line_items[0].price_data.currency).toBe("eur");
    expect(params.payment_intent_data.application_fee_amount).toBe(125);
    expect(params.payment_intent_data.transfer_data.destination).toBe("acct_123");
  });
});
