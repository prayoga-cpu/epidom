import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * `public/sw.js` is a plain script, not a module — it can't be imported, so it
 * is evaluated here inside a stubbed worker global scope and its internals are
 * handed back for assertion.
 *
 * Worth the setup: this file is the one part of the offline stack that can
 * never be exercised by the app's own tests (no service worker in jsdom) and
 * the one where a mistake is invisible until a cashier loses signal. The rules
 * covered below — which paths are warmable, which chunks get pulled in with a
 * page, and where the /go launcher sends someone with no connection — are all
 * load-bearing for "does the installed app open offline".
 */
interface WorkerScope {
  goLauncherHtml: (section: string, saved: string[]) => string;
  isWarmablePath: (path: string) => boolean;
  isShellCacheable: (url: URL, response: Response) => boolean;
  isCacheableResponse: (response: Response) => boolean;
  NEXT_ASSET_PATTERN: RegExp;
}

let sw: WorkerScope;

beforeAll(() => {
  const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
  const factory = new Function(
    "self",
    "caches",
    "fetch",
    `${source}
    return { goLauncherHtml, isWarmablePath, isShellCacheable, isCacheableResponse, NEXT_ASSET_PATTERN };`
  );

  sw = factory(
    {
      location: { hostname: "app.epidom.fr", origin: "https://app.epidom.fr" },
      addEventListener: () => {},
      skipWaiting: () => {},
      clients: { claim: () => Promise.resolve() },
      registration: {},
    },
    {
      open: () => Promise.resolve({ keys: () => Promise.resolve([]) }),
      keys: () => Promise.resolve([]),
    },
    () => Promise.reject(new Error("offline"))
  ) as WorkerScope;
});

/** Runs the launcher document's inline script against stubbed browser globals. */
function runLauncher(
  section: string,
  saved: string[],
  stored: { local?: string | null; cookie?: string } = {}
): string {
  const html = sw.goLauncherHtml(section, saved);
  const script = html.split("<script>")[1].split("</" + "script>")[0];

  let replaced = "";
  new Function("localStorage", "document", "location", script)(
    { getItem: () => stored.local ?? null },
    { cookie: stored.cookie ?? "" },
    {
      replace: (url: string) => {
        replaced = url;
      },
    }
  );
  return replaced;
}

describe("sw: warmable paths", () => {
  it("accepts dashboard sections and nothing else", () => {
    expect(sw.isWarmablePath("/store/abc/pos")).toBe(true);
    expect(sw.isWarmablePath("/store/abc/pos/orders")).toBe(true);
    expect(sw.isWarmablePath("/")).toBe(false);
    expect(sw.isWarmablePath("/login")).toBe(false);
    expect(sw.isWarmablePath("/@some-storefront")).toBe(false);
    expect(sw.isWarmablePath("/admin/capacity")).toBe(false);
  });

  it("refuses print views — they auto-open the print dialog with no page behind them", () => {
    expect(sw.isWarmablePath("/store/abc/finance/print")).toBe(false);
  });
});

describe("sw: chunk discovery", () => {
  it("finds bundles in script tags, preload links and the inlined flight payload", () => {
    const html = `
      <link rel="preload" href="/_next/static/css/abc123.css" as="style"/>
      <script src="/_next/static/chunks/main-app-9f8e7d.js" async></script>
      <script>self.__next_f.push([1,"\\"/_next/static/chunks/app/store/%5BstoreId%5D/page-1a2b.js\\""])</script>
    `;
    const found = html.match(sw.NEXT_ASSET_PATTERN) ?? [];

    expect(found).toContain("/_next/static/css/abc123.css");
    expect(found).toContain("/_next/static/chunks/main-app-9f8e7d.js");
    expect(found).toContain("/_next/static/chunks/app/store/%5BstoreId%5D/page-1a2b.js");
  });

  it("does not reach outside the static prefix", () => {
    const found = "/_next/image?url=/logo.png".match(sw.NEXT_ASSET_PATTERN);
    expect(found).toBeNull();
  });
});

describe("sw: /go offline launcher", () => {
  it("resumes the last-visited page when that page is saved", () => {
    expect(
      runLauncher("/dashboard", ["/store/s1/pos", "/store/s1/dashboard"], {
        local: "/store/s1/pos",
      })
    ).toBe("/store/s1/pos");
  });

  it("keeps the query string of the resumed page", () => {
    expect(runLauncher("/dashboard", ["/store/s1/pos"], { local: "/store/s1/pos?tab=open" })).toBe(
      "/store/s1/pos?tab=open"
    );
  });

  it("falls back to the cookie when localStorage is empty", () => {
    expect(
      runLauncher("/dashboard", ["/store/s1/pos"], {
        cookie: "other=1; epidom:lastVisitedUrl=%2Fstore%2Fs1%2Fpos; more=2",
      })
    ).toBe("/store/s1/pos");
  });

  it("honours the tapped shortcut when the last-visited page was never saved", () => {
    // Long-pressed "Cashier" → /go/pos, but they were last on Finance, which is
    // not an offline page. Landing on the saved POS screen is the right answer.
    expect(
      runLauncher("/pos", ["/store/s1/dashboard", "/store/s1/pos"], {
        local: "/store/s1/finance",
      })
    ).toBe("/store/s1/pos");
  });

  it("falls back to any saved page rather than the offline card", () => {
    expect(runLauncher("/pos", ["/store/s1/dashboard"], { local: "/store/s1/finance" })).toBe(
      "/store/s1/dashboard"
    );
  });

  it("trusts last-visited when nothing is saved — there is no better guess", () => {
    expect(runLauncher("/dashboard", [], { local: "/store/s1/pos" })).toBe("/store/s1/pos");
  });

  it("shows the offline card when there is nothing to go to", () => {
    expect(runLauncher("/dashboard", [], {})).toBe("/offline.html");
  });

  it("never redirects off-origin, whatever the stored value says", () => {
    for (const hostile of [
      "//evil.example.com",
      "https://evil.example.com/store/s1/pos",
      "/store/s1/pos\\@evil.example.com",
      "javascript:alert(1)",
    ]) {
      expect(runLauncher("/dashboard", [], { local: hostile })).toBe("/offline.html");
    }
  });
});

describe("sw: what may be stored as an app shell", () => {
  const ok = (init: ResponseInit & { redirected?: boolean } = {}) => {
    const response = new Response("<html></html>", { status: 200, ...init });
    Object.defineProperty(response, "redirected", { value: init.redirected ?? false });
    return response;
  };

  it("stores a dashboard document", () => {
    expect(sw.isShellCacheable(new URL("https://app.epidom.fr/store/s1/pos"), ok())).toBe(true);
  });

  it("refuses a login redirect, a filtered view and anything off the dashboard", () => {
    expect(
      sw.isShellCacheable(new URL("https://app.epidom.fr/store/s1/pos"), ok({ redirected: true }))
    ).toBe(false);
    expect(sw.isShellCacheable(new URL("https://app.epidom.fr/store/s1/pos?q=x"), ok())).toBe(
      false
    );
    expect(sw.isShellCacheable(new URL("https://app.epidom.fr/login"), ok())).toBe(false);
  });

  it("still refuses no-store bodies for the ordinary cache", () => {
    expect(sw.isCacheableResponse(ok({ headers: { "Cache-Control": "private, no-store" } }))).toBe(
      false
    );
    expect(
      sw.isCacheableResponse(ok({ headers: { "Cache-Control": "public, max-age=31536000" } }))
    ).toBe(true);
  });
});
