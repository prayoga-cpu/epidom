// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";
import { sessionCookieNames } from "@/lib/auth/cookies";
import { LAST_VISITED_COOKIE, REMEMBER_PREF_COOKIE } from "@/lib/last-visited";
import { LOCALE_PREF_COOKIE } from "@/lib/i18n-routing";

const ORIGIN = "http://localhost:3000";
const [SESSION_COOKIE] = sessionCookieNames(undefined);

/** A returning, signed-in visitor whose last app page is remembered. */
const SIGNED_IN_WITH_RESUME = {
  [SESSION_COOKIE]: "token",
  [REMEMBER_PREF_COOKIE]: "true",
  [LAST_VISITED_COOKIE]: encodeURIComponent("/stores"),
};

function request(
  pathAndQuery: string,
  opts: { cookies?: Record<string, string>; headers?: Record<string, string> } = {}
) {
  const headers = new Headers(opts.headers);
  if (opts.cookies) {
    headers.set(
      "cookie",
      Object.entries(opts.cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; ")
    );
  }
  return new NextRequest(`${ORIGIN}${pathAndQuery}`, { headers });
}

const isRedirect = (status: number) => status >= 300 && status < 400;

/**
 * Follow the proxy's redirects the way a browser would (same cookies and
 * headers on every hop) until it stops redirecting. Fails the test on a loop.
 */
async function follow(
  pathAndQuery: string,
  opts: Parameters<typeof request>[1] = {}
): Promise<{ hops: Array<{ status: number; to: string }>; final: Response; finalPath: string }> {
  const seen = new Set<string>();
  const hops: Array<{ status: number; to: string }> = [];
  let current = pathAndQuery;
  for (let i = 0; i < 6; i++) {
    expect(seen.has(current), `redirect loop: ${[...seen, current].join(" -> ")}`).toBe(false);
    seen.add(current);
    const res = await proxy(request(current, opts));
    if (!isRedirect(res.status)) return { hops, final: res, finalPath: current };
    const location = new URL(res.headers.get("location") as string);
    const next = location.pathname + location.search;
    hops.push({ status: res.status, to: next });
    current = next;
  }
  throw new Error(`more than 6 redirects from ${pathAndQuery}: ${JSON.stringify(hops)}`);
}

describe("proxy: the deleted /payments page", () => {
  it.each([
    ["/payments", "/pricing"],
    ["/id/payments", "/id/pricing"],
    ["/en/payments", "/en/pricing"],
  ])("%s permanently redirects (308) to %s", async (from, to) => {
    const res = await proxy(request(from));

    expect(res.status).toBe(308);
    const location = new URL(res.headers.get("location") as string);
    expect(location.origin).toBe(ORIGIN);
    expect(location.pathname).toBe(to);
  });

  it("drops the old ?plan= query (and any other), keeping nothing of the dead form", async () => {
    for (const from of [
      "/payments?plan=pro",
      "/id/payments?plan=starter&x=1",
      "/en/payments?plan=",
    ]) {
      const res = await proxy(request(from));
      expect(res.status).toBe(308);
      expect(new URL(res.headers.get("location") as string).search).toBe("");
    }
  });

  it("tolerates a trailing slash", async () => {
    const res = await proxy(request("/id/payments/"));
    expect(res.status).toBe(308);
    expect(new URL(res.headers.get("location") as string).pathname).toBe("/id/pricing");
  });

  it("does not depend on the session: an anonymous visitor and a signed-in one land on the same page", async () => {
    const anonymous = await proxy(request("/payments?plan=pro"));
    const signedIn = await proxy(request("/payments?plan=pro", { cookies: SIGNED_IN_WITH_RESUME }));

    for (const res of [anonymous, signedIn]) {
      expect(res.status).toBe(308);
      expect(new URL(res.headers.get("location") as string).pathname).toBe("/pricing");
    }
  });

  it("wins over the resume-redirect: a returning signed-in visitor is not bounced to their last app page", async () => {
    // Sanity: the same cookies DO resume from a live marketing page ...
    const resumed = await proxy(request("/about", { cookies: SIGNED_IN_WITH_RESUME }));
    expect(new URL(resumed.headers.get("location") as string).pathname).toBe("/stores");

    // ... but not from the retired one.
    const res = await proxy(request("/payments", { cookies: SIGNED_IN_WITH_RESUME }));
    expect(new URL(res.headers.get("location") as string).pathname).toBe("/pricing");
  });

  it("is answered for router prefetches too", async () => {
    const res = await proxy(request("/payments", { headers: { "next-router-prefetch": "1" } }));
    expect(res.status).toBe(308);
    expect(new URL(res.headers.get("location") as string).pathname).toBe("/pricing");
  });

  it("is a public, cacheable answer: nothing session-shaped on the response", async () => {
    const res = await proxy(request("/payments", { cookies: SIGNED_IN_WITH_RESUME }));
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("vary") ?? "").not.toMatch(/cookie/i);
    expect(res.headers.get("cache-control") ?? "").not.toMatch(/no-store/i);
  });
});

describe("proxy: the deleted /status page", () => {
  it.each([
    ["/status", "/contact"],
    ["/id/status", "/id/contact"],
    ["/en/status", "/en/contact"],
    ["/en/status/", "/en/contact"],
  ])("%s permanently redirects (308) to %s", async (from, to) => {
    const res = await proxy(request(from));

    expect(res.status).toBe(308);
    const location = new URL(res.headers.get("location") as string);
    expect(location.origin).toBe(ORIGIN);
    expect(location.pathname).toBe(to);
    expect(location.search).toBe("");
  });

  it("wins over the resume-redirect for a returning signed-in visitor", async () => {
    const res = await proxy(request("/status", { cookies: SIGNED_IN_WITH_RESUME }));
    expect(res.status).toBe(308);
    expect(new URL(res.headers.get("location") as string).pathname).toBe("/contact");
  });
});

describe("proxy: retired-path redirects never loop", () => {
  const VISITORS: Array<[string, Parameters<typeof request>[1]]> = [
    ["anonymous", {}],
    ["signed in with a remembered last page", { cookies: SIGNED_IN_WITH_RESUME }],
    [
      "signed in, French device",
      { cookies: { [SESSION_COOKIE]: "t" }, headers: { "accept-language": "fr-FR" } },
    ],
    ["Indonesian device", { headers: { "accept-language": "id-ID,id;q=0.9" } }],
    ["English device", { headers: { "accept-language": "en-US,en;q=0.9" } }],
    ["explicit English pick", { cookies: { [LOCALE_PREF_COOKIE]: "en" } }],
    ["explicit Indonesian pick", { cookies: { [LOCALE_PREF_COOKIE]: "id" } }],
  ];

  it.each(VISITORS)(
    "%s: /payments settles on a real page in a few hops, without revisiting a URL",
    async (_who, opts) => {
      const { hops, finalPath } = await follow("/payments?plan=pro", opts);

      // The first hop is always the permanent redirect; anything after it is the
      // ordinary language redirect every /pricing visit gets, never /payments.
      expect(hops[0].status).toBe(308);
      expect(hops.length).toBeLessThanOrEqual(2);
      expect(hops.map((h) => h.to).join(" ")).not.toContain("payments");
      expect(finalPath).toMatch(/^(\/id|\/en)?\/pricing$/);
    }
  );

  it.each(VISITORS)(
    "%s: /status goes to Contact first and never comes back to /status",
    async (_who, opts) => {
      // Where it finally settles is Contact's business (a signed-in visitor
      // with a remembered page is resumed from there, as from any marketing
      // page); what matters here is the permanent hop and no loop.
      const { hops } = await follow("/status", opts);

      expect(hops[0].status).toBe(308);
      expect(hops[0].to).toMatch(/^(\/id|\/en)?\/contact$/);
      expect(hops.map((h) => h.to).join(" ")).not.toContain("status");
    }
  );

  it.each(["/pricing", "/id/pricing", "/en/pricing"])(
    "%s (the destination) is served, not redirected back, even for a signed-in visitor with a remembered page",
    async (path) => {
      const res = await proxy(request(path, { cookies: SIGNED_IN_WITH_RESUME }));
      expect(isRedirect(res.status)).toBe(false);
    }
  );

  it("does not swallow /payments look-alikes: they are ordinary unknown paths", async () => {
    // Not a marketing path any more, so an anonymous visitor meets the login
    // wall like on any unknown route (this is also what proves /payments is
    // gone from the public-route list).
    const res = await proxy(request("/payments/anything"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") as string).pathname).toBe("/login");
  });
});
