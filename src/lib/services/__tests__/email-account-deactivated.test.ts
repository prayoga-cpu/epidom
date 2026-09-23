import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SUPPORT_EMAIL_ADDRESSES, SUPPORT_MAILTO } from "@/lib/constants/contact";

const h = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: h.send };
  },
}));

const DEADLINE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

describe("sendAccountDeactivatedEmail: support contact in the footer", () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    process.env.RESEND_API_KEY = "re_test";
    h.send.mockResolvedValue({ data: { id: "msg_1" }, error: null });
  });
  afterEach(() => {
    vi.doUnmock("@/lib/constants/contact");
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  });

  it("mails every support recipient and shows the first address, both read from the shared constants", async () => {
    const { sendAccountDeactivatedEmail } = await import("../email.service");

    const result = await sendAccountDeactivatedEmail("owner@example.com", "Olivia", DEADLINE);

    expect(result).toEqual({ success: true, messageId: "msg_1" });
    const { html } = h.send.mock.calls[0][0];
    expect(html).toContain(
      `<a href="${SUPPORT_MAILTO}" style="color: #444444;">${SUPPORT_EMAIL_ADDRESSES[0]}</a>`
    );
  });

  it("follows the constants: swapping the support inbox needs no change in this file", async () => {
    vi.doMock("@/lib/constants/contact", () => ({
      SUPPORT_EMAIL_ADDRESSES: ["help@example.test"],
      SUPPORT_MAILTO: "mailto:help@example.test",
    }));
    const { sendAccountDeactivatedEmail } = await import("../email.service");

    await sendAccountDeactivatedEmail("owner@example.com", null, DEADLINE);

    const { html } = h.send.mock.calls[0][0];
    expect(html).toContain(
      `<a href="mailto:help@example.test" style="color: #444444;">help@example.test</a>`
    );
    // Nothing else in the body carries a hardcoded support address.
    expect(html).not.toMatch(/prionation/i);
  });

  it("escapes what it interpolates, so a future subject line with & cannot break the attribute", async () => {
    vi.doMock("@/lib/constants/contact", () => ({
      SUPPORT_EMAIL_ADDRESSES: ["help@example.test"],
      SUPPORT_MAILTO: "mailto:help@example.test?subject=a&b",
    }));
    const { sendAccountDeactivatedEmail } = await import("../email.service");

    await sendAccountDeactivatedEmail("owner@example.com", "Olivia", DEADLINE);

    const { html } = h.send.mock.calls[0][0];
    expect(html).toContain(`href="mailto:help@example.test?subject=a&amp;b"`);
  });
});
