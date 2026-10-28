import { describe, it, expect, vi, beforeEach } from "vitest";

var mockPrisma: any;
vi.mock("@/lib/prisma", () => {
  mockPrisma = {
    user: { findMany: vi.fn() },
    newsletterSubscriber: { findMany: vi.fn() },
    salesLead: { findMany: vi.fn() },
    newsletterUnsubscribe: { findMany: vi.fn() },
  };
  return { prisma: mockPrisma };
});

import {
  countByAudience,
  customerGroupOf,
  loadNewsletterContacts,
  mergeNewsletterContacts,
  selectRecipients,
} from "../newsletter-audience.service";

const NOW = new Date("2026-10-28T10:00:00Z");
const sub = (over: Record<string, unknown>) => ({
  plan: "POS",
  status: "ACTIVE",
  trialEndsAt: null,
  stripeSubscriptionId: "sub_1",
  ...over,
});

describe("customerGroupOf", () => {
  it("sorts every plan state into free, trial or paid", () => {
    expect(customerGroupOf(null, NOW)).toBe("FREE");
    expect(customerGroupOf(sub({ plan: "FREE" }) as never, NOW)).toBe("FREE");
    expect(customerGroupOf(sub({ status: "INCOMPLETE" }) as never, NOW)).toBe("FREE");
    expect(customerGroupOf(sub({ status: "CANCELED" }) as never, NOW)).toBe("FREE");
    expect(customerGroupOf(sub({ trialEndsAt: new Date("2026-11-05") }) as never, NOW)).toBe("TRIAL");
    expect(customerGroupOf(sub({ trialEndsAt: new Date("2026-10-01") }) as never, NOW)).toBe("PAID");
    expect(customerGroupOf(sub({}) as never, NOW)).toBe("PAID");
    expect(customerGroupOf(sub({ status: "PAST_DUE" }) as never, NOW)).toBe("PAID");
    expect(customerGroupOf(sub({ stripeSubscriptionId: null }) as never, NOW)).toBe("PAID");
  });
});

describe("mergeNewsletterContacts", () => {
  const contacts = mergeNewsletterContacts({
    users: [
      { email: "Owner@Cafe.fr", locale: "fr", group: "PAID" },
      { email: "free@warung.id", locale: "id", group: "FREE" },
    ],
    subscribers: [
      { email: "owner@cafe.fr", locale: "en" },
      { email: "fan@mail.com", locale: "en" },
      { email: "gone@mail.com", locale: "fr" },
    ],
    leads: [
      { email: "lead@shop.fr", locale: "fr" },
      { email: "lead@shop.fr", locale: "en" },
      { email: "not-an-email", locale: "fr" },
    ],
    unsubscribed: new Set(["gone@mail.com"]),
  });

  it("keeps one contact per address, in every group it belongs to", () => {
    expect(contacts.map((c) => c.email).sort()).toEqual([
      "fan@mail.com",
      "free@warung.id",
      "lead@shop.fr",
      "owner@cafe.fr",
    ]);
    expect(contacts.find((c) => c.email === "owner@cafe.fr")?.groups).toEqual(["PAID", "SUBSCRIBERS"]);
  });

  it("lets the account's language win over a form's", () => {
    expect(contacts.find((c) => c.email === "owner@cafe.fr")?.locale).toBe("fr");
    expect(contacts.find((c) => c.email === "lead@shop.fr")?.locale).toBe("fr");
  });

  it("leaves out unsubscribed and malformed addresses", () => {
    expect(contacts.some((c) => c.email === "gone@mail.com")).toBe(false);
    expect(contacts.some((c) => c.email === "not-an-email")).toBe(false);
  });

  it("selects by audience and language", () => {
    expect(selectRecipients(contacts, ["PAID"], "all").map((c) => c.email)).toEqual(["owner@cafe.fr"]);
    expect(selectRecipients(contacts, ["SUBSCRIBERS", "FREE"], "all")).toHaveLength(3);
    expect(selectRecipients(contacts, ["SUBSCRIBERS", "FREE", "LEADS"], "fr").map((c) => c.email).sort()).toEqual([
      "lead@shop.fr",
      "owner@cafe.fr",
    ]);
    expect(selectRecipients(contacts, [], "all")).toEqual([]);
  });

  it("counts each audience in the chosen language", () => {
    expect(countByAudience(contacts, "all")).toEqual({
      SUBSCRIBERS: 2,
      LEADS: 1,
      FREE: 1,
      TRIAL: 0,
      PAID: 1,
    });
    expect(countByAudience(contacts, "id")).toEqual({
      SUBSCRIBERS: 0,
      LEADS: 0,
      FREE: 1,
      TRIAL: 0,
      PAID: 0,
    });
  });
});

describe("loadNewsletterContacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.newsletterSubscriber.findMany.mockResolvedValue([]);
    mockPrisma.salesLead.findMany.mockResolvedValue([]);
    mockPrisma.newsletterUnsubscribe.findMany.mockResolvedValue([{ email: "Quit@Cafe.fr" }]);
  });

  it("reads only verified, active accounts and leaves staff logins (current or former) out", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { email: "owner@cafe.fr", locale: "fr", business: { id: "b1" }, staffMember: null, subscription: null },
      {
        email: "cashier@cafe.fr",
        locale: "fr",
        business: null,
        staffMember: { isActive: true, role: "CASHIER" },
        subscription: null,
      },
      {
        email: "former-staff@cafe.fr",
        locale: "fr",
        business: null,
        staffMember: { isActive: false, role: "CASHIER" },
        subscription: null,
      },
      { email: "quit@cafe.fr", locale: "fr", business: { id: "b2" }, staffMember: null, subscription: null },
    ]);

    const contacts = await loadNewsletterContacts(NOW);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { emailVerified: true, deactivatedAt: null } })
    );
    expect(contacts.map((c) => c.email)).toEqual(["owner@cafe.fr"]);
  });
});
