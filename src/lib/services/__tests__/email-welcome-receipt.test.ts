import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: h.send };
  },
}));

const originalKey = process.env.RESEND_API_KEY;

beforeEach(() => {
  vi.resetModules();
  process.env.RESEND_API_KEY = "re_test";
  h.send.mockReset();
  h.send.mockResolvedValue({ data: { id: "msg_1" }, error: null });
});
afterEach(() => {
  if (originalKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalKey;
});

describe("sendWelcomeEmail", () => {
  const payload = {
    email: "new@example.com",
    name: "Sam",
    locale: "en",
    onboardingUrl: "https://www.epidom.fr/onboarding",
  };

  it("tells a new owner about the 14-day trial and the store link, with a button to finish setup", async () => {
    const { sendWelcomeEmail } = await import("../email.service");
    expect(await sendWelcomeEmail(payload)).toEqual({ success: true, messageId: "msg_1" });

    const sent = h.send.mock.calls[0][0];
    expect(sent.to).toBe("new@example.com");
    expect(sent.subject).toContain("14-day POS trial");
    expect(sent.html).toContain("Hi Sam,");
    expect(sent.html).toMatch(/14-day POS trial starts on its own/);
    expect(sent.html).toMatch(/no card needed/i);
    expect(sent.html).toMatch(/link to share with customers/);
    expect(sent.html).toContain('href="https://www.epidom.fr/onboarding"');
  });

  it("is written in the owner's language (French, Indonesian by default)", async () => {
    const { sendWelcomeEmail } = await import("../email.service");
    await sendWelcomeEmail({ ...payload, locale: "fr" });
    await sendWelcomeEmail({ ...payload, locale: null });
    expect(h.send.mock.calls[0][0].subject).toContain("Bienvenue");
    expect(h.send.mock.calls[0][0].html).toContain("Bonjour Sam,");
    expect(h.send.mock.calls[1][0].subject).toContain("Selamat datang");
  });

  it("escapes the name, and reports a failed send instead of throwing", async () => {
    const { sendWelcomeEmail } = await import("../email.service");
    await sendWelcomeEmail({ ...payload, name: "<b>Sam</b>" });
    expect(h.send.mock.calls[0][0].html).not.toContain("<b>Sam</b>");

    h.send.mockResolvedValueOnce({ data: null, error: { message: "resend down" } });
    expect(await sendWelcomeEmail(payload)).toEqual({ success: false, error: "resend down" });
  });
});

describe("sendSubscriptionReceiptEmail", () => {
  const payload = {
    email: "owner@example.com",
    name: "Sam",
    locale: "en",
    planName: "Operations",
    amountLabel: "€281.88",
    paidAt: new Date("2026-11-10T10:00:00Z"),
    period: { start: new Date("2026-11-10T00:00:00Z"), end: new Date("2027-11-10T00:00:00Z") },
    invoiceNumber: "EPD-0001",
    invoiceUrl: "https://invoice.stripe.com/i/in_1",
    pdfUrl: "https://pay.stripe.com/invoice/in_1/pdf",
  };

  it("lists the plan, amount, date, period and invoice number, with both invoice links", async () => {
    const { sendSubscriptionReceiptEmail } = await import("../email.service");
    expect(await sendSubscriptionReceiptEmail(payload)).toEqual({
      success: true,
      messageId: "msg_1",
    });
    const sent = h.send.mock.calls[0][0];
    expect(sent.to).toBe("owner@example.com");
    expect(sent.subject).toContain("Operations");
    for (const text of ["Operations", "€281.88", "10 November 2026", "EPD-0001"]) {
      expect(sent.html).toContain(text);
    }
    expect(sent.html).toContain('href="https://invoice.stripe.com/i/in_1"');
    expect(sent.html).toContain('href="https://pay.stripe.com/invoice/in_1/pdf"');
  });

  it("leaves out what the invoice doesn't have, and is translated", async () => {
    const { sendSubscriptionReceiptEmail } = await import("../email.service");
    await sendSubscriptionReceiptEmail({
      ...payload,
      locale: "fr",
      period: null,
      invoiceNumber: null,
      pdfUrl: null,
    });
    const sent = h.send.mock.calls[0][0];
    expect(sent.subject).toContain("reçu");
    expect(sent.html).not.toContain("Période couverte");
    expect(sent.html).not.toContain("Télécharger le PDF");
    expect(sent.html).toContain("Voir la facture");
  });
});
