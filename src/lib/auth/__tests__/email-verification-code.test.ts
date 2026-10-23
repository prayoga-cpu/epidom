import { describe, it, expect } from "vitest";
import { emailOTP } from "better-auth/plugins/email-otp";
import {
  DISABLED_EMAIL_OTP_PATHS,
  EMAIL_CODE_LENGTH,
  normalizeEmailCode,
} from "../email-verification-code";

describe("DISABLED_EMAIL_OTP_PATHS", () => {
  // Every HTTP path the plugin opens, read from the installed version, so a
  // Better Auth upgrade that adds one (say, a new "sign in by code" route)
  // fails here instead of quietly going live.
  const plugin = emailOTP({ sendVerificationOTP: async () => {} });
  const httpPaths = Object.values(plugin.endpoints)
    .map((endpoint) => (endpoint as { path?: string }).path)
    .filter((path): path is string => typeof path === "string");

  it("leaves only /email-otp/verify-email reachable", () => {
    const open = httpPaths.filter((path) => !DISABLED_EMAIL_OTP_PATHS.includes(path));
    expect(open).toEqual(["/email-otp/verify-email"]);
  });

  it("lists only paths the plugin really has (a typo would leave the real one open)", () => {
    for (const path of DISABLED_EMAIL_OTP_PATHS) expect(httpPaths).toContain(path);
  });
});

describe("normalizeEmailCode", () => {
  it("keeps the digits of a pasted code, up to the code length", () => {
    expect(normalizeEmailCode("123 456")).toBe("123456");
    expect(normalizeEmailCode("Code: 042917")).toBe("042917");
    expect(normalizeEmailCode("1234567890")).toBe("1234567890".slice(0, EMAIL_CODE_LENGTH));
    expect(normalizeEmailCode("abc")).toBe("");
  });
});
