import { describe, it, expect } from "vitest";
import {
  EMAIL_VERIFIED_LANDING,
  GOOGLE_SIGNUP_LANDING,
  emailVerificationCallbackURL,
  googleSignupCallbackURL,
} from "@/features/auth/register/lib/verification-landing";

describe("verification landing constants", () => {
  it("are the exact URLs the wizard reads", () => {
    expect(EMAIL_VERIFIED_LANDING).toBe("/onboarding?verified=1");
    expect(GOOGLE_SIGNUP_LANDING).toBe("/onboarding?signup=google");
  });
});

describe("emailVerificationCallbackURL", () => {
  it.each([
    ["absent", undefined],
    ["null", null],
    ["empty", ""],
  ])("lands on the wizard when next is %s", (_label, next) => {
    expect(emailVerificationCallbackURL(next)).toBe("/onboarding?verified=1");
  });

  it.each([
    ["protocol-relative", "//evil.example"],
    ["absolute", "https://evil.example/phish"],
    ["javascript:", "javascript:alert(1)"],
    ["backslash trick", "/\\evil.example"],
    ["tab smuggled in", "/\t/evil.example"],
    ["relative without a slash", "evil.example"],
  ])("ignores an unsafe next (%s) and lands on the wizard", (_label, next) => {
    expect(emailVerificationCallbackURL(next)).toBe("/onboarding?verified=1");
  });

  it.each([
    ["/transfer-ownership/abc", "/transfer-ownership/abc"],
    ["/staff-invite/tok?x=1", "/staff-invite/tok?x=1"],
    ["/store/abc/pos#top", "/store/abc/pos#top"],
    // Look-alikes of the wizard path are not the wizard and stay untouched.
    ["/onboarding/", "/onboarding/"],
    ["/onboardingx", "/onboardingx"],
  ])("keeps a safe deep link %s exactly as given", (next, expected) => {
    expect(emailVerificationCallbackURL(next)).toBe(expected);
  });

  it.each([
    ["/onboarding", "/onboarding?verified=1"],
    ["/onboarding?verified=1", "/onboarding?verified=1"],
    ["/onboarding?verified=0", "/onboarding?verified=1"],
    ["/onboarding?step=2", "/onboarding?step=2&verified=1"],
  ])("adds the flag when next is the wizard itself (%s)", (next, expected) => {
    expect(emailVerificationCallbackURL(next)).toBe(expected);
  });
});

describe("googleSignupCallbackURL", () => {
  it.each([undefined, null, "", "//evil.example", "https://evil.example"])(
    "lands on the wizard for next=%s",
    (next) => {
      expect(googleSignupCallbackURL(next)).toBe("/onboarding?signup=google");
    }
  );

  it("keeps a safe deep link exactly as given", () => {
    expect(googleSignupCallbackURL("/staff-invite/tok")).toBe("/staff-invite/tok");
  });

  it("adds the flag when next is the wizard itself", () => {
    expect(googleSignupCallbackURL("/onboarding")).toBe("/onboarding?signup=google");
  });

  it.each(["/stores", "/stores?tab=all", "/stores#top"])(
    "treats the generic /stores landing (%s) as no deep link: a new account has no store",
    (next) => {
      expect(googleSignupCallbackURL(next)).toBe("/onboarding?signup=google");
    }
  );

  it.each([
    ["/store/abc/pos", "/store/abc/pos"],
    ["/storesx", "/storesx"],
    ["/transfer-ownership/abc?token=1", "/transfer-ownership/abc?token=1"],
  ])("keeps a real deep link %s that only looks like /stores", (next, expected) => {
    expect(googleSignupCallbackURL(next)).toBe(expected);
  });
});
