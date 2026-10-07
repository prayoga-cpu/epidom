// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// public/sales-pages/tracker.js is a plain browser script, not a module: run
// its source the way the page does, with document.currentScript pointing at
// the <script data-page> tag.
const SOURCE = readFileSync(join(process.cwd(), "public", "sales-pages", "tracker.js"), "utf8");

let sent: Array<Record<string, unknown>>;
// Listeners each run adds to document/window, removed after every test so
// one test's tracker never reports another test's clicks.
const listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject]> = [];

function runTracker(page: string | null) {
  const tag = document.createElement("script");
  if (page) tag.setAttribute("data-page", page);
  Object.defineProperty(document, "currentScript", { value: tag, configurable: true });
  for (const target of [document, window] as EventTarget[]) {
    const add = target.addEventListener.bind(target);
    vi.spyOn(target, "addEventListener").mockImplementation((type, fn, options) => {
      if (fn) listeners.push([target, type, fn]);
      add(type, fn, options);
    });
  }
  new Function(SOURCE)();
}

beforeEach(() => {
  sent = [];
  document.cookie = "epidom_sales_page=; Max-Age=0; Path=/";
  document.body.innerHTML =
    '<a class="btn" href="/register" data-cta="hero"><b>Commencer gratuitement →</b></a>';
  document.documentElement.setAttribute("lang", "fr");
  window.history.replaceState(null, "", "/sales-page-2?utm_source=meta&utm_campaign=launch");
  // Keep the payload readable: the tracker wraps it in a Blob for sendBeacon.
  vi.stubGlobal(
    "Blob",
    class {
      constructor(public parts: string[]) {}
    }
  );
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: vi.fn((url: string, blob: { parts: string[] }) => {
      expect(url).toBe("/api/public/sales-pages/events");
      sent.push(JSON.parse(blob.parts.join("")));
      return true;
    }),
  });
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
    cb();
    return 0;
  });
});

afterEach(() => {
  for (const [target, type, fn] of listeners.splice(0)) target.removeEventListener(type, fn);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("sales page tracker", () => {
  it("sends a view with the ad's tags and remembers the page and language in the cookie", () => {
    runTracker("sales-page-2");

    expect(sent[0]).toEqual({
      type: "VIEW",
      page: "sales-page-2",
      locale: "fr",
      utmSource: "meta",
      utmCampaign: "launch",
    });
    expect(document.cookie).toContain("epidom_sales_page=sales-page-2.fr");
  });

  it.each(["en", "id"])("reports the %s copy under its language", (lang) => {
    document.documentElement.setAttribute("lang", lang);
    runTracker("sales-page-2");

    expect(sent[0]).toMatchObject({ type: "VIEW", page: "sales-page-2", locale: lang });
    expect(document.cookie).toContain(`epidom_sales_page=sales-page-2.${lang}`);
  });

  it("sends the button's name when a CTA is clicked, even on its inner text", () => {
    runTracker("sales-page-2");
    sent = [];

    // The click lands on the <b> inside the link, as it does on the real page.
    document.querySelector("b")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(sent).toEqual([{ type: "CTA_CLICK", cta: "hero", page: "sales-page-2", locale: "fr" }]);
  });

  it("counts a middle click (open in a new tab), not other buttons", () => {
    runTracker("sales-page-2");
    sent = [];

    const b = document.querySelector("b")!;
    b.dispatchEvent(new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    b.dispatchEvent(new MouseEvent("auxclick", { bubbles: true, button: 2 }));

    expect(sent).toEqual([{ type: "CTA_CLICK", cta: "hero", page: "sales-page-2", locale: "fr" }]);
  });

  it("puts its own copy back in the cookie when Back restores it, and on a sign-up click", () => {
    runTracker("sales-page-2");
    // The visitor opened the English copy, then came back with Back.
    document.cookie = "epidom_sales_page=sales-page-2.en; Path=/";

    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    expect(document.cookie).toContain("epidom_sales_page=sales-page-2.fr");

    document.cookie = "epidom_sales_page=sales-page-2.en; Path=/";
    document.querySelector("b")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.cookie).toContain("epidom_sales_page=sales-page-2.fr");
  });

  it("sends each scroll milestone once", () => {
    runTracker("sales-page-2");
    sent = [];

    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("scroll"));

    expect(sent.map((e) => e.type)).toEqual(["SCROLL_50", "SCROLL_90"]);
  });

  it("does nothing on a page that forgot its data-page", () => {
    runTracker(null);

    expect(sent).toEqual([]);
    expect(document.cookie).not.toContain("epidom_sales_page=");
  });
});
