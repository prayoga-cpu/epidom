// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";
import { sessionCookieNames } from "@/lib/auth/cookies";
import { LAST_VISITED_COOKIE, REMEMBER_PREF_COOKIE } from "@/lib/last-visited";

const ORIGIN = "http://localhost:3000";
const [SESSION_COOKIE] = sessionCookieNames(undefined);

/**
 * A browser still holding a session cookie plus the resume cookies. The proxy
 * can only see that the cookie exists, not whether its session is alive.
 */
const RESUME_COOKIES = [
  `${SESSION_COOKIE}=stale`,
  `${REMEMBER_PREF_COOKIE}=true`,
  `${LAST_VISITED_COOKIE}=${encodeURIComponent("/stores")}`,
].join("; ");

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`${ORIGIN}${path}`, {
    headers: new Headers({ cookie: RESUME_COOKIES, ...headers }),
  });
}

const RSC_NAVIGATION = { rsc: "1", "sec-fetch-site": "same-origin" };

describe("proxy: the resume-redirect never fires on a click away from /login or /register", () => {
  // /login and /register redirect a live session to /stores, so anyone on them
  // has a dead cookie. Resuming them sent the logo "/" -> /stores -> /login.
  it.each([
    ["the auth page's logo", "/", `${ORIGIN}/login`],
    ["the same logo in Create Account mode", "/", `${ORIGIN}/register?next=%2Fonboarding`],
    ["a localized marketing link", "/en/about", `${ORIGIN}/login`],
    ["another marketing page", "/about", `${ORIGIN}/login?callbackUrl=%2Fstores`],
  ])("serves %s instead of resuming", async (_label, path, referer) => {
    const res = await proxy(request(path, { ...RSC_NAVIGATION, referer }));

    expect(res.headers.get("location")).toBeNull();
  });

  it("still resumes the same cookies arriving with no referer (address bar, bookmark)", async () => {
    const res = await proxy(request("/"));

    expect(new URL(res.headers.get("location") as string).pathname).toBe("/stores");
  });

  it("still resumes a navigation from any other page", async () => {
    const res = await proxy(request("/", { ...RSC_NAVIGATION, referer: `${ORIGIN}/about` }));

    expect(new URL(res.headers.get("location") as string).pathname).toBe("/stores");
  });

  it("ignores a referer it can't parse", async () => {
    const res = await proxy(request("/", { referer: "not a url" }));

    expect(new URL(res.headers.get("location") as string).pathname).toBe("/stores");
  });
});
