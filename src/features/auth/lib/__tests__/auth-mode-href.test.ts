import { describe, it, expect } from "vitest";
import { authModeHref } from "../auth-mode-href";

describe("authModeHref", () => {
  it("is the bare path when there is nothing to carry over", () => {
    expect(authModeHref("login", null)).toBe("/login");
    expect(authModeHref("register", null)).toBe("/register");
    expect(authModeHref("login", new URLSearchParams())).toBe("/login");
    expect(authModeHref("register", "")).toBe("/register");
  });

  it("does NOT carry ?email= across: an address is personal data and must not be copied onto a second URL", () => {
    // Deliberate change: this used to carry the homepage-CTA address over. Everything in a
    // URL reaches analytics as page_location and stays in history, so the toggle drops it.
    expect(authModeHref("login", new URLSearchParams("email=jane%40bakery.com"))).toBe("/login");
    expect(authModeHref("register", new URLSearchParams("email=jane%40bakery.com"))).toBe(
      "/register"
    );
    expect(authModeHref("login", "email=jane%40bakery.com")).toBe("/login");
    expect(authModeHref("login", "?email=jane%40bakery.com")).toBe("/login");
  });

  it("drops email wherever it sits and keeps everything else", () => {
    expect(
      authModeHref(
        "login",
        new URLSearchParams("next=%2Fstaff-invite%2Ftok&email=jane%40bakery.com&plan=pos")
      )
    ).toBe("/login?next=%2Fstaff-invite%2Ftok&plan=pos");
  });

  it("carries ?next= across in both directions", () => {
    const search = new URLSearchParams("next=%2Ftransfer-ownership%2Fabc");
    expect(authModeHref("login", search)).toBe("/login?next=%2Ftransfer-ownership%2Fabc");
    expect(authModeHref("register", search)).toBe("/register?next=%2Ftransfer-ownership%2Fabc");
  });

  it("carries ?callbackUrl= across (what the middleware sets when it bounces a visitor to /login)", () => {
    expect(authModeHref("register", new URLSearchParams("callbackUrl=%2Fonboarding"))).toBe(
      "/register?callbackUrl=%2Fonboarding"
    );
  });

  it("carries next and callbackUrl together, in the order they arrived", () => {
    const search = new URLSearchParams("next=%2Fstaff-invite%2Ftok&callbackUrl=%2Fstores");
    expect(authModeHref("login", search)).toBe(
      "/login?next=%2Fstaff-invite%2Ftok&callbackUrl=%2Fstores"
    );
  });

  it("carries params it has never heard of, such as campaign tags", () => {
    expect(authModeHref("register", new URLSearchParams("utm_source=newsletter&plan=pos"))).toBe(
      "/register?utm_source=newsletter&plan=pos"
    );
  });

  it("drops the one-shot flags the login form consumes itself", () => {
    expect(authModeHref("register", new URLSearchParams("error=state_mismatch"))).toBe("/register");
    expect(authModeHref("register", new URLSearchParams("registered=true"))).toBe("/register");
    expect(
      authModeHref(
        "register",
        new URLSearchParams("error=state_mismatch&next=%2Fstores%2Fabc&registered=true")
      )
    ).toBe("/register?next=%2Fstores%2Fabc");
  });

  it("does not corrupt values that need encoding", () => {
    const tag = "spring sale+2026";
    const next = "/staff-invite/tok?x=1&y=2";
    const href = authModeHref(
      "login",
      new URLSearchParams({ utm_campaign: tag, next }) // builds the encoded string the browser would carry
    );

    const parsed = new URLSearchParams(href.split("?")[1]);
    expect(href.startsWith("/login?")).toBe(true);
    expect(parsed.get("utm_campaign")).toBe(tag);
    expect(parsed.get("next")).toBe(next);
  });

  it("accepts the raw query string too, with or without the leading ?", () => {
    expect(authModeHref("login", "next=%2Fstores%2Fabc")).toBe("/login?next=%2Fstores%2Fabc");
    expect(authModeHref("login", "?next=%2Fstores%2Fabc")).toBe("/login?next=%2Fstores%2Fabc");
  });

  it("does not mutate what it was given", () => {
    const search = new URLSearchParams("error=x&email=jane%40bakery.com");
    authModeHref("login", search);
    expect(search.toString()).toBe("error=x&email=jane%40bakery.com");
  });
});
