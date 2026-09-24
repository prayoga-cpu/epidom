import { describe, it, expect } from "vitest";
import { SHIFT_REPORT_LABELS, saleTypeLabel } from "@/lib/receipts/receipt-labels";
import {
  onlinePlatformLabel,
  orderSourceBadgeLabel,
  orderSourceLabel,
  saleTypeText,
} from "../order-channel";

/** Echoes the key, so a test can see which translation was asked for. */
const t = (key: string) => key;

describe("order-channel — what the till calls a sale's channel", () => {
  it("brand names are never translated; 'Other platform' is", () => {
    expect(onlinePlatformLabel(t, "UBER_EATS")).toBe("Uber Eats");
    expect(onlinePlatformLabel(t, "OTHER_ONLINE")).toBe("pos.onlinePlatform.other");
  });

  it("a platform order reads as its platform, anything else as its order type", () => {
    expect(saleTypeText(t, "DELIVERY", "GRABFOOD")).toBe("GrabFood");
    expect(saleTypeText(t, "DINE_IN", "POS")).toBe("pos.checkout.dineIn");
    expect(saleTypeText(t, "TAKEAWAY")).toBe("pos.checkout.takeaway");
    // A storefront delivery is not a platform order.
    expect(saleTypeText(t, "DELIVERY", "STOREFRONT")).toBe("pos.history.delivery");
  });

  it("the queue badge names the platform, so a driver's order is findable at a glance", () => {
    expect(orderSourceBadgeLabel(t, "POS")).toBe("pos.source.walkIn");
    expect(orderSourceBadgeLabel(t, "SHOPEEFOOD")).toBe("ShopeeFood");
    expect(orderSourceBadgeLabel(t, "STOREFRONT")).toBe("pos.source.online");
  });

  it("history and finance name every channel, including the new platforms", () => {
    expect(orderSourceLabel(t, "POS")).toBe("pos.history.sourcePos");
    expect(orderSourceLabel(t, "DELIVEROO")).toBe("Deliveroo");
    expect(orderSourceLabel(t, "TOKOPEDIA")).toBe("Tokopedia");
  });
});

describe("saleTypeLabel — the printed sale type (shift report, tickets)", () => {
  it("prints the platform on every receipt locale", () => {
    expect(saleTypeLabel(SHIFT_REPORT_LABELS.id, "DELIVERY", "GOFOOD")).toBe("GoFood");
    expect(saleTypeLabel(SHIFT_REPORT_LABELS.fr, "DELIVERY", "OTHER_ONLINE")).toBe(
      "Autre plateforme"
    );
  });

  it("falls back to the order type", () => {
    expect(saleTypeLabel(SHIFT_REPORT_LABELS.en, "DINE_IN", null)).toBe("Dine In");
    expect(saleTypeLabel(SHIFT_REPORT_LABELS.id, "TAKEAWAY")).toBe("Bawa Pulang");
    expect(saleTypeLabel(SHIFT_REPORT_LABELS.fr, "DELIVERY", "STOREFRONT")).toBe("Livraison");
  });
});
