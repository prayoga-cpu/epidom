// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";
import { CONSENT_MODE_COOKIE } from "@/lib/consent-region";

const ORIGIN = "https://epidom.fr";
const BROWSER = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1";

function request(path: string, { country, cookie }: { country?: string; cookie?: string } = {}) {
  const headers = new Headers({ "user-agent": BROWSER, "accept-language": "fr-FR" });
  if (country) headers.set("x-vercel-ip-country", country);
  if (cookie) headers.set("cookie", `${CONSENT_MODE_COOKIE}=${cookie}`);
  return new NextRequest(`${ORIGIN}${path}`, { headers });
}

const modeCookie = (res: Response) =>
  (res.headers.get("set-cookie") ?? "")
    .split(/,(?=\s*[^;,]+=)/)
    .find((c) => c.trim().startsWith(`${CONSENT_MODE_COOKIE}=`));

describe("proxy: the consent mode for the visitor's country", () => {
  it.each(["/", "/pricing", "/register", "/sales-page-1", "/id/sales-page-2"])(
    "%s from Indonesia is labelled opt-out before the page loads",
    async (path) => {
      const res = await proxy(request(path, { country: "ID" }));
      expect(modeCookie(res)).toMatch(new RegExp(`^${CONSENT_MODE_COOKIE}=opt-out;`));
      expect(modeCookie(res)).not.toMatch(/HttpOnly/i);
    }
  );

  it("from France, opt-in", async () => {
    const res = await proxy(request("/", { country: "FR" }));
    expect(modeCookie(res)).toMatch(new RegExp(`^${CONSENT_MODE_COOKIE}=opt-in;`));
  });

  it("with no country header, opt-in", async () => {
    const res = await proxy(request("/register"));
    expect(modeCookie(res)).toMatch(new RegExp(`^${CONSENT_MODE_COOKIE}=opt-in;`));
  });

  it("not set again when the browser already has it", async () => {
    const res = await proxy(request("/", { country: "ID", cookie: "opt-out" }));
    expect(modeCookie(res)).toBeUndefined();
  });

  it("not on a redirect (some are permanent and cacheable); the page it leads to sets it", async () => {
    const headers = new Headers({ "user-agent": BROWSER, "accept-language": "id-ID", "x-vercel-ip-country": "ID" });
    const res = await proxy(new NextRequest(`${ORIGIN}/sales-page-1`, { headers }));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get("set-cookie")).toBeNull();

    const landed = await proxy(new NextRequest(`${ORIGIN}/id/sales-page-1`, { headers }));
    expect(modeCookie(landed)).toMatch(/opt-out/);
  });
});
