import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import {
  extractSubscriptionPeriod,
  getInvoiceSubscriptionId,
  isSubscriptionCanceling,
} from "../stripe";

const sub = (fields: Record<string, unknown>) => fields as unknown as Stripe.Subscription;
const invoice = (fields: Record<string, unknown>) => fields as unknown as Stripe.Invoice;

describe("extractSubscriptionPeriod", () => {
  it("reads the period from the first subscription item (basil and later)", () => {
    const period = extractSubscriptionPeriod(
      sub({
        items: { data: [{ current_period_start: 1790000000, current_period_end: 1792592000 }] },
      })
    );
    expect(period).toEqual({
      currentPeriodStart: new Date(1790000000 * 1000),
      currentPeriodEnd: new Date(1792592000 * 1000),
    });
  });

  it("falls back to the top-level period of older API versions", () => {
    const period = extractSubscriptionPeriod(
      sub({
        current_period_start: 1700000000,
        current_period_end: 1702678400,
        items: { data: [{}] },
      })
    );
    expect(period?.currentPeriodEnd).toEqual(new Date(1702678400 * 1000));
  });

  it("returns null when neither location has a period", () => {
    expect(extractSubscriptionPeriod(sub({ items: { data: [] } }))).toBeNull();
  });
});

describe("isSubscriptionCanceling", () => {
  it("is true for cancel_at_period_end or a set cancel_at, with no period on the object", () => {
    expect(isSubscriptionCanceling(sub({ cancel_at_period_end: true, cancel_at: null }))).toBe(
      true
    );
    expect(
      isSubscriptionCanceling(sub({ cancel_at_period_end: false, cancel_at: 1792592000 }))
    ).toBe(true);
    expect(isSubscriptionCanceling(sub({ cancel_at_period_end: false, cancel_at: null }))).toBe(
      false
    );
  });
});

describe("getInvoiceSubscriptionId", () => {
  it("reads parent.subscription_details.subscription", () => {
    expect(
      getInvoiceSubscriptionId(
        invoice({ parent: { subscription_details: { subscription: "sub_parent" } } })
      )
    ).toBe("sub_parent");
  });

  it("accepts an expanded subscription object", () => {
    expect(
      getInvoiceSubscriptionId(
        invoice({ parent: { subscription_details: { subscription: { id: "sub_expanded" } } } })
      )
    ).toBe("sub_expanded");
  });

  it("falls back to a line item's subscription", () => {
    expect(
      getInvoiceSubscriptionId(
        invoice({
          parent: null,
          lines: {
            data: [
              { parent: null },
              { parent: { subscription_item_details: { subscription: "sub_line" } } },
            ],
          },
        })
      )
    ).toBe("sub_line");
  });

  it("falls back to the top-level subscription of older API versions", () => {
    expect(getInvoiceSubscriptionId(invoice({ subscription: "sub_legacy" }))).toBe("sub_legacy");
  });

  it("returns null for a one-off invoice", () => {
    expect(getInvoiceSubscriptionId(invoice({ parent: null, lines: { data: [] } }))).toBeNull();
  });
});
