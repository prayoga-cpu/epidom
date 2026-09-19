import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: h.send };
  },
}));

import { sendStoreOwnershipTransferEmail } from "../email.service";

const URL = `https://app.example.com/transfer-ownership/accept?token=${"a".repeat(64)}`;

describe("sendStoreOwnershipTransferEmail", () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test";
    h.send.mockResolvedValue({ data: { id: "msg_1" }, error: null });
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  });

  it("emails the recipient the accept link", async () => {
    const result = await sendStoreOwnershipTransferEmail("new@owner.com", "Kopi Kita", "Olivia", URL);

    expect(result).toEqual({ success: true, messageId: "msg_1" });
    const payload = h.send.mock.calls[0][0];
    expect(payload.to).toBe("new@owner.com");
    expect(payload.html).toContain(`href="${URL}"`);
    expect(payload.html).toContain("Kopi Kita");
    expect(payload.html).toContain("Olivia");
  });

  it("keeps the subject plain text — no HTML entities for names containing & < >", async () => {
    await sendStoreOwnershipTransferEmail("new@owner.com", "Tom & Jerry's <Cafe>", "A & B", URL);
    const { subject } = h.send.mock.calls[0][0];
    expect(subject).toBe(`A & B wants to transfer "Tom & Jerry's <Cafe>" to you on EPIDOM`);
    expect(subject).not.toContain("&amp;");
  });

  it("escapes every user-controlled string in the HTML body (no markup injection)", async () => {
    await sendStoreOwnershipTransferEmail(
      "new@owner.com",
      `<img src=x onerror=alert(1)>`,
      `<script>alert(1)</script>`,
      URL
    );
    const { html } = h.send.mock.calls[0][0];
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("falls back to a neutral sender when the owner has no name", async () => {
    await sendStoreOwnershipTransferEmail("new@owner.com", "Kopi", null, URL);
    const { subject, html } = h.send.mock.calls[0][0];
    expect(subject).toContain("The current owner");
    expect(html).toContain("The current owner");
  });

  it("reports (not throws) a provider error, so the caller can undo the invite", async () => {
    h.send.mockResolvedValue({ data: null, error: { message: "domain not verified" } });
    expect(await sendStoreOwnershipTransferEmail("n@o.co", "Kopi", "O", URL)).toEqual({
      success: false,
      error: "domain not verified",
    });

    h.send.mockRejectedValue(new Error("network down"));
    expect(await sendStoreOwnershipTransferEmail("n@o.co", "Kopi", "O", URL)).toEqual({
      success: false,
      error: "network down",
    });
  });

  it("with no API key configured, short-circuits to success without sending (dev mode)", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendStoreOwnershipTransferEmail("n@o.co", "Kopi", "O", URL);
    expect(result).toEqual({ success: true, messageId: "dev-mode" });
    expect(h.send).not.toHaveBeenCalled();
  });
});
