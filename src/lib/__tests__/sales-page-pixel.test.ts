// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { META_PIXEL_ID, GA_MEASUREMENT_ID } from "@/components/analytics/tracking-vendors";
import { COOKIE_CONSENT_STORAGE_KEY } from "@/lib/cookie-consent";
import { TRACKING_EVENTS_ENDPOINT } from "@/lib/tracking-events";

// public/sales-pages/pixel.js is a plain browser script, not a module: run its
// source the way the page does, with document.currentScript pointing at the
// <script data-page> tag.
const SOURCE = readFileSync(join(process.cwd(), "public", "sales-pages", "pixel.js"), "utf8");

type Logged = Record<string, unknown>;
let logged: Logged[];
const listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject]> = [];

/**
 * Runs the script against the real jsdom window, except for its hostname
 * (jsdom's location can't be replaced): the script sees `window` through a
 * proxy whose location is on `hostname`.
 */
function runPixel(page: string | null = "sales-page-2", hostname = "epidom.fr") {
  const tag = document.createElement("script");
  if (page) tag.setAttribute("data-page", page);
  Object.defineProperty(document, "currentScript", { value: tag, configurable: true });
  const add = document.addEventListener.bind(document);
  vi.spyOn(document, "addEventListener").mockImplementation((type, fn, options) => {
    if (fn) listeners.push([document, type, fn]);
    add(type, fn, options);
  });
  const location = new URL(`https://${hostname}${window.location.pathname}${window.location.search}`);
  const win = new Proxy(window, {
    get: (target, key) => (key === "location" ? location : Reflect.get(target, key, target)),
    set: (target, key, value) => Reflect.set(target, key, value, target),
  });
  new Function("window", SOURCE)(win);
}

const bar = () => document.querySelector("[data-epidom-cookie-bar]") as HTMLElement | null;
const barButton = (action: string) =>
  bar()!.shadowRoot!.querySelector(`[data-action="${action}"]`) as HTMLButtonElement;
const fbqCalls = () =>
  ((window as unknown as { fbq: { queue: IArguments[] } }).fbq.queue ?? []).map((args) =>
    Array.from(args)
  );
const injected = (src: string) => document.querySelector(`script[src="${src}"]`) !== null;
const FBEVENTS = "https://connect.facebook.net/en_US/fbevents.js";

function saveChoice(analytics: boolean, marketing: boolean) {
  localStorage.setItem(
    COOKIE_CONSENT_STORAGE_KEY,
    JSON.stringify({ essential: true, analytics, marketing, language: "fr", timestamp: 1, version: "1.0.0" })
  );
}

beforeEach(() => {
  logged = [];
  localStorage.clear();
  document.head.innerHTML = "";
  document.body.innerHTML =
    '<a class="btn" href="/register" data-cta="hero"><b>Commencer gratuitement →</b></a>' +
    "<footer>© Epidom</footer>";
  document.cookie = "_fbp=; Max-Age=0; Path=/";
  document.cookie = "epidom_consent_mode=; Max-Age=0; Path=/";
  document.documentElement.setAttribute("lang", "fr");
  window.history.replaceState(null, "", "/sales-page-2?fbclid=AbC123&utm_source=meta&utm_campaign=launch");
  delete (window as unknown as { fbq?: unknown }).fbq;
  delete (window as unknown as { _fbq?: unknown })._fbq;
  delete (window as unknown as { gtag?: unknown }).gtag;
  delete (window as unknown as { dataLayer?: unknown }).dataLayer;
  vi.stubGlobal(
    "Blob",
    class {
      constructor(public parts: string[]) {}
    }
  );
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: vi.fn((url: string, blob: { parts: string[] }) => {
      expect(url).toBe(TRACKING_EVENTS_ENDPOINT);
      logged.push(JSON.parse(blob.parts.join("")));
      return true;
    }),
  });
});

afterEach(() => {
  for (const [target, type, fn] of listeners.splice(0)) target.removeEventListener(type, fn);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("public/sales-pages/pixel.js", () => {
  it("uses the site's pixel, Analytics id and consent key", () => {
    expect(SOURCE).toContain(`var PIXEL_ID = "${META_PIXEL_ID}";`);
    expect(SOURCE).toContain(`var GA_ID = "${GA_MEASUREMENT_ID}";`);
    expect(SOURCE).toContain(`var CONSENT_KEY = "${COOKIE_CONSENT_STORAGE_KEY}";`);
    expect(SOURCE).toContain(`var ENDPOINT = "${TRACKING_EVENTS_ENDPOINT}";`);
  });

  it("asks first: shows the bar and sends nothing to Meta or Google before an answer", () => {
    runPixel();

    expect(bar()).not.toBeNull();
    expect(bar()!.shadowRoot!.textContent).toContain("Nous utilisons des cookies");
    expect(injected(FBEVENTS)).toBe(false);
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
    expect(fbqCalls()).toEqual([]);
    expect(logged).toEqual([]);
  });

  it("Accept saves the site's record, loads the pixel and sends PageView + ViewContent", () => {
    runPixel();
    barButton("accept").click();

    expect(bar()).toBeNull();
    const saved = JSON.parse(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)!);
    expect(saved).toMatchObject({ analytics: true, marketing: true, language: "fr", version: "1.0.0" });

    expect(injected(FBEVENTS)).toBe(true);
    expect(document.querySelector('script[src*="googletagmanager"]')).not.toBeNull();
    expect(fbqCalls()).toEqual([
      ["init", META_PIXEL_ID],
      ["track", "PageView"],
      [
        "track",
        "ViewContent",
        { content_name: "sales-page-2", content_category: "sales_page", language: "fr" },
      ],
    ]);
    expect(logged).toEqual([
      {
        kind: "CONSENT",
        name: "ACCEPT_ALL",
        analytics: true,
        marketing: true,
        path: "/sales-page-2",
        source: "sales_page",
        locale: "fr",
      },
      { kind: "PIXEL", name: "PageView", path: "/sales-page-2", source: "sales_page", locale: "fr" },
      {
        kind: "PIXEL",
        name: "ViewContent",
        content: "sales-page-2",
        path: "/sales-page-2",
        source: "sales_page",
        locale: "fr",
      },
    ]);
  });

  it("Reject saves the refusal and loads nothing", () => {
    runPixel();
    barButton("reject").click();

    expect(bar()).toBeNull();
    expect(JSON.parse(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)!)).toMatchObject({
      analytics: false,
      marketing: false,
    });
    expect(injected(FBEVENTS)).toBe(false);
    expect(fbqCalls()).toEqual([]);
    expect(logged).toEqual([
      expect.objectContaining({ kind: "CONSENT", name: "REJECT_ALL", marketing: false }),
    ]);
  });

  it("Customize lets the visitor allow analytics without the pixel", () => {
    runPixel();
    barButton("customize").click();
    const root = bar()!.shadowRoot!;
    (root.querySelector('[data-category="analytics"]') as HTMLButtonElement).click();
    barButton("save").click();

    expect(JSON.parse(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)!)).toMatchObject({
      analytics: true,
      marketing: false,
    });
    expect(injected(FBEVENTS)).toBe(false);
    expect(document.querySelector('script[src*="googletagmanager"]')).not.toBeNull();
    expect(logged).toEqual([
      expect.objectContaining({ kind: "CONSENT", name: "CUSTOM", analytics: true, marketing: false }),
    ]);
  });

  it("an answer given on the site is honoured: no bar, the pixel loads at once", () => {
    saveChoice(false, true);
    runPixel();

    expect(bar()).toBeNull();
    expect(injected(FBEVENTS)).toBe(true);
    expect(fbqCalls()[1]).toEqual(["track", "PageView"]);
  });

  it("a refusal given on the site is honoured too", () => {
    saveChoice(false, false);
    runPixel();

    expect(bar()).toBeNull();
    expect(injected(FBEVENTS)).toBe(false);
  });

  it("sends SignUpClick on a sign-up button, only with consent", () => {
    saveChoice(true, true);
    runPixel();
    logged = [];
    (document.querySelector("[data-cta] b") as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );

    expect(fbqCalls().at(-1)).toEqual([
      "trackCustom",
      "SignUpClick",
      { content_name: "sales-page-2", cta: "hero", language: "fr" },
    ]);
    expect(logged).toEqual([
      expect.objectContaining({ kind: "PIXEL", name: "SignUpClick", content: "sales-page-2 · hero" }),
    ]);
  });

  it("carries the ad's click id and UTM tags on to /register", () => {
    runPixel();

    expect(document.querySelector("[data-cta]")!.getAttribute("href")).toBe(
      "/register?fbclid=AbC123&utm_source=meta&utm_campaign=launch"
    );
  });

  it("logs the public URL in the page's language, also when the file is opened", () => {
    document.documentElement.setAttribute("lang", "id");
    window.history.replaceState(null, "", "/sales-pages/sales-page-3.id.html");
    saveChoice(true, true);
    runPixel("sales-page-3");

    expect(logged[0]).toMatchObject({ path: "/id/sales-page-3", locale: "id" });
  });

  it("shows the bar in the page's language", () => {
    document.documentElement.setAttribute("lang", "en");
    runPixel();
    expect(bar()!.shadowRoot!.textContent).toContain("We use cookies");
    expect(
      bar()!.shadowRoot!.querySelector('a[href="/en/cookie-policy"]')
    ).not.toBeNull();
  });

  it("never feeds the production pixel from a preview deployment", () => {
    runPixel("sales-page-2", "dev.epidom.fr");
    barButton("accept").click();

    expect(injected(FBEVENTS)).toBe(false);
    expect(fbqCalls()).toEqual([]);
    expect(logged).toEqual([]);
    // The answer is still saved, as on the site.
    expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).not.toBeNull();
  });

  describe("by the visitor's country (epidom_consent_mode, set by the proxy)", () => {
    const setMode = (mode: string) => (document.cookie = `epidom_consent_mode=${mode}; Path=/`);

    it("where no consent is needed: no bar, an automatic accept, the pixel loads at once", () => {
      setMode("opt-out");
      runPixel();

      expect(bar()).toBeNull();
      expect(JSON.parse(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)!)).toMatchObject({
        analytics: true,
        marketing: true,
        language: "fr",
        version: "1.0.0",
        auto: true,
      });
      // An automatic record isn't a language choice: the legacy keys stay untouched.
      expect(localStorage.getItem("locale")).toBeNull();
      expect(injected(FBEVENTS)).toBe(true);
      expect(fbqCalls().map((c) => c[1])).toEqual([META_PIXEL_ID, "PageView", "ViewContent"]);
      expect(logged.map((e) => `${e.kind}:${e.name}`)).toEqual([
        "CONSENT:AUTO",
        "PIXEL:PageView",
        "PIXEL:ViewContent",
      ]);
    });

    it("where consent is needed: an automatic accept is dropped and the bar asks", () => {
      setMode("opt-out");
      runPixel();
      for (const [target, type, fn] of listeners.splice(0)) target.removeEventListener(type, fn);
      vi.restoreAllMocks(); // runPixel spies on addEventListener again
      delete (window as unknown as { fbq?: unknown }).fbq;
      document.head.innerHTML = "";
      document.querySelector("[data-epidom-cookie-settings]")?.remove();

      setMode("opt-in");
      runPixel();

      expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBeNull();
      expect(bar()).not.toBeNull();
      expect(injected(FBEVENTS)).toBe(false);
    });

    it("never overrides a choice the visitor made, wherever they are", () => {
      saveChoice(false, false);
      setMode("opt-out");
      runPixel();
      expect(injected(FBEVENTS)).toBe(false);
      expect(JSON.parse(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)!).auto).toBeUndefined();
    });

    it("an automatic accept can be turned off from Manage cookies", () => {
      setMode("opt-out");
      runPixel();
      (document.querySelector("footer [data-epidom-cookie-settings] button") as HTMLButtonElement).click();
      const root = bar()!.shadowRoot!;
      expect(root.querySelector('[data-category="marketing"]')!.getAttribute("aria-checked")).toBe("true");
      (root.querySelector('[data-category="marketing"]') as HTMLButtonElement).click();
      barButton("save").click();

      const saved = JSON.parse(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)!);
      expect(saved).toMatchObject({ marketing: false, analytics: true });
      expect(saved.auto).toBeUndefined();
      expect(fbqCalls().at(-1)).toEqual(["consent", "revoke"]);
    });
  });

  describe("withdrawing from the sales page", () => {
    const manage = () =>
      document.querySelector("footer [data-epidom-cookie-settings] button") as HTMLButtonElement;
    const switchOf = (key: string) =>
      bar()!.shadowRoot!.querySelector(`[data-category="${key}"]`) as HTMLButtonElement;

    it("puts a Manage cookies button in the footer", () => {
      saveChoice(true, true);
      runPixel();
      expect(manage().textContent).toBe("Gérer les cookies");
    });

    it("reopens on the settings with the saved choice, and turning the pixel off revokes it", () => {
      saveChoice(true, true);
      document.cookie = "_fbp=fb.1.123.456; Path=/";
      runPixel();
      logged = [];
      manage().click();

      expect(bar()).not.toBeNull();
      expect(switchOf("marketing").getAttribute("aria-checked")).toBe("true");
      expect(switchOf("analytics").getAttribute("aria-checked")).toBe("true");
      switchOf("marketing").click();
      barButton("save").click();

      expect(bar()).toBeNull();
      expect(fbqCalls().at(-1)).toEqual(["consent", "revoke"]);
      expect(document.cookie).not.toContain("_fbp=");
      expect(JSON.parse(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)!)).toMatchObject({
        analytics: true,
        marketing: false,
      });
      expect(logged).toEqual([
        expect.objectContaining({ kind: "CONSENT", name: "CUSTOM", analytics: true, marketing: false }),
      ]);

      // No pixel events once withdrawn.
      (document.querySelector("[data-cta]") as HTMLElement).dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
      expect(logged.some((e) => e.name === "SignUpClick")).toBe(false);
    });

    it("a later Accept grants again without a second PageView", () => {
      saveChoice(false, true);
      runPixel();
      manage().click();
      switchOf("marketing").click();
      barButton("save").click();
      manage().click();
      barButton("back").click();
      barButton("accept").click();

      const calls = fbqCalls();
      expect(calls.filter((c) => c[0] === "track" && c[1] === "PageView")).toHaveLength(1);
      expect(calls.at(-1)).toEqual(["consent", "grant"]);
    });

    it("a reopened bar can be closed without changing anything", () => {
      saveChoice(false, false);
      runPixel();
      manage().click();
      logged = [];
      barButton("close").click();

      expect(bar()).toBeNull();
      expect(logged).toEqual([]);
      expect(JSON.parse(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)!)).toMatchObject({
        analytics: false,
        marketing: false,
      });
    });

    it("a first-visit bar has no close button: it needs an answer", () => {
      runPixel();
      expect(bar()!.shadowRoot!.querySelector('[data-action="close"]')).toBeNull();
    });
  });

  it("does nothing without data-page", () => {
    runPixel(null);
    expect(bar()).toBeNull();
  });
});
