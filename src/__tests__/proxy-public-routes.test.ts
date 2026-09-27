// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";
import { sessionCookieNames } from "@/lib/auth/cookies";

const ORIGIN = "http://localhost:3000";
const [SESSION_COOKIE] = sessionCookieNames(undefined);

function request(pathAndQuery: string, cookies?: Record<string, string>) {
  const headers = new Headers();
  if (cookies) {
    headers.set(
      "cookie",
      Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; ")
    );
  }
  return new NextRequest(`${ORIGIN}${pathAndQuery}`, { headers });
}

const isRedirect = (status: number) => status >= 300 && status < 400;

describe("proxy: the signup pages a visitor reaches before they have a session", () => {
  // An email signup has no session until the verification link is clicked, so
  // "check your email" must render for an anonymous visitor. It used to be
  // missing from the public list, and a brand-new signup was bounced to /login.
  it.each([
    "/verify-email-sent",
    "/verify-email-sent?email=jane%40bakery.com",
    "/verify-email-sent?email=jane%40bakery.com&next=%2Ftransfer-ownership%2Fabc",
  ])("serves %s to an anonymous visitor", async (path) => {
    const res = await proxy(request(path));

    expect(isRedirect(res.status)).toBe(false);
    expect(res.headers.get("location")).toBeNull();
  });

  it("serves /verify-email-sent to a signed-in visitor too", async () => {
    const res = await proxy(
      request("/verify-email-sent?email=a%40b.com", { [SESSION_COOKIE]: "t" })
    );

    expect(isRedirect(res.status)).toBe(false);
  });

  // The wizard does its own session check (src/app/(app)/onboarding/page.tsx),
  // so the proxy must let every verification / Google landing through intact.
  it.each([
    "/onboarding",
    "/onboarding?verified=1",
    "/onboarding?signup=google",
    "/onboarding?verified=1&error=TOKEN_EXPIRED",
  ])("leaves %s to the page's own session check", async (path) => {
    const res = await proxy(request(path));

    expect(isRedirect(res.status)).toBe(false);
    expect(res.headers.get("location")).toBeNull();
  });

  it("still sends an anonymous visitor on a protected page to /login (control)", async () => {
    const res = await proxy(request("/stores"));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") as string);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("callbackUrl")).toBe("/stores");
  });
});
