import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: h.send };
  },
}));

const VERIFY_URL =
  "https://epidom.fr/api/auth/verify-email?token=abc.def.ghi&callbackURL=%2Fonboarding%3Fverified%3D1";
const RESET_URL = "https://epidom.fr/reset-password/tok123?callbackURL=%2Flogin&x=1";

describe("verification and password-reset emails", () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    h.send.mockReset();
    process.env.RESEND_API_KEY = "re_test";
    h.send.mockResolvedValue({ data: { id: "msg_1" }, error: null });
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  });

  it("makes the 'copy this link' fallback a real link, not plain text", async () => {
    const { sendVerificationEmail } = await import("../email.service");

    await sendVerificationEmail("new@example.com", "Ana", VERIFY_URL);

    const { html } = h.send.mock.calls[0][0];
    const escaped = VERIFY_URL.replace(/&/g, "&amp;");
    // The button and the fallback both link to the same URL.
    expect(html.split(`href="${escaped}"`)).toHaveLength(3);
    expect(html).toContain(`>${escaped}</a>`);
  });

  it("offers the link and the 6-digit code in the same email, code first in the subject", async () => {
    const { sendVerificationEmail } = await import("../email.service");

    await sendVerificationEmail("new@example.com", "Ana", VERIFY_URL, "042917");

    expect(h.send).toHaveBeenCalledTimes(1);
    const { subject, html } = h.send.mock.calls[0][0];
    // Readable from the inbox list or a notification, even with links disabled.
    expect(subject).toBe("042917 is your EPIDOM verification code");
    expect(html).toContain("Option 1: tap the button");
    expect(html).toContain("Option 2: enter this code in EPIDOM");
    expect(html).toContain(">042917</span>");
    // The link is still there, as the button and as the fallback.
    expect(html.split(`href="${VERIFY_URL.replace(/&/g, "&amp;")}"`)).toHaveLength(3);
    expect(html).toContain("The link and the code expire in 1 hour");
  });

  it("falls back to the link-only email when no code could be made", async () => {
    const { sendVerificationEmail } = await import("../email.service");

    await sendVerificationEmail("new@example.com", "Ana", VERIFY_URL, null);

    const { subject, html } = h.send.mock.calls[0][0];
    expect(subject).toBe("Verify your email for EPIDOM");
    expect(html).not.toContain("Option 2");
    expect(html).toContain("This link expires in 1 hour");
  });

  it("does the same in the password-reset email", async () => {
    const { sendPasswordResetEmail } = await import("../email.service");

    await sendPasswordResetEmail("owner@example.com", "Ana", RESET_URL);

    const { html } = h.send.mock.calls[0][0];
    expect(html).toContain(`>${RESET_URL.replace(/&/g, "&amp;")}</a>`);
  });

  it("escapes the signup name, so a name cannot add its own link to our email", async () => {
    const { sendVerificationEmail } = await import("../email.service");

    await sendVerificationEmail(
      "victim@example.com",
      '<a href="https://evil.example">Claim your prize</a>',
      VERIFY_URL
    );

    const { html } = h.send.mock.calls[0][0];
    expect(html).not.toContain('https://evil.example"');
    expect(html).toContain("Hi &lt;a href=&quot;https://evil.example&quot;&gt;");
  });
});

describe("greetingFor", () => {
  it("trims the name and falls back to a bare greeting", async () => {
    const { greetingFor } = await import("../email.service");

    expect(greetingFor("Thirst traps ")).toBe("Hi Thirst traps,");
    expect(greetingFor("   ")).toBe("Hi,");
    expect(greetingFor(null)).toBe("Hi,");
    expect(greetingFor("Tom & Jerry")).toBe("Hi Tom &amp; Jerry,");
  });
});
