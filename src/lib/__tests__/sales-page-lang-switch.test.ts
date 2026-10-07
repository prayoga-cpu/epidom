// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { LANGUAGE_OPTIONS } from "@/components/lang/lang-switcher";
import { LOCALE_PREF_COOKIE } from "@/lib/i18n-routing";

// public/sales-pages/lang-switch.js is a plain browser script: run its source
// the way the page does, on a page in the given language and URL.
const SOURCE = readFileSync(join(process.cwd(), "public", "sales-pages", "lang-switch.js"), "utf8");

const originalLocation = window.location;
let assign: ReturnType<typeof vi.fn>;
const listeners: Array<[EventTarget, string, EventListenerOrEventListenerObject]> = [];

function openPage(lang: string, pathname: string, search = "") {
  document.documentElement.setAttribute("lang", lang);
  assign = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { pathname, search, hash: "", assign },
  });
  vi.spyOn(document, "addEventListener").mockImplementation(function (this: Document, type, fn, options) {
    if (fn) listeners.push([document, type, fn]);
    EventTarget.prototype.addEventListener.call(document, type, fn, options);
  });
  new Function(SOURCE)();
  const host = document.querySelector("[data-epidom-lang-switch]") as HTMLElement;
  const root = host.shadowRoot!;
  return {
    host,
    trigger: root.querySelector(".trigger") as HTMLButtonElement,
    menu: root.querySelector(".menu") as HTMLElement,
    options: [...root.querySelectorAll(".opt")] as HTMLButtonElement[],
    option: (value: string) => root.querySelector(`.opt[data-value="${value}"]`) as HTMLButtonElement,
  };
}

beforeEach(() => {
  localStorage.clear();
  document.cookie = `${LOCALE_PREF_COOKIE}=; Max-Age=0; path=/`;
  document.head.innerHTML = "";
  document.body.innerHTML = '<a href="/register" data-cta="hero"><b>Start free →</b></a>';
});

afterEach(() => {
  for (const [target, type, fn] of listeners.splice(0)) target.removeEventListener(type, fn);
  vi.restoreAllMocks();
  Object.defineProperty(window, "location", { configurable: true, writable: true, value: originalLocation });
  document.body.innerHTML = "";
});

describe("sales page language switcher", () => {
  it("offers exactly the site switcher's languages, in its order", () => {
    const { options } = openPage("fr", "/sales-page-1");

    expect(
      options.map((o) => ({
        value: o.dataset.value,
        flag: o.querySelector(".flag")!.textContent,
        short: o.querySelector(".code")!.textContent,
        label: o.querySelector(".label")!.textContent,
      }))
    ).toEqual(LANGUAGE_OPTIONS.map(({ value, flag, short, label }) => ({ value, flag, short, label })));
  });

  it("shows the page's language, closed", () => {
    const { trigger, menu, option } = openPage("en", "/en/sales-page-1");

    expect(trigger.textContent).toBe("EN");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(menu.hidden).toBe(true);
    expect(option("en").getAttribute("aria-selected")).toBe("true");
    expect(option("en").querySelector("svg")).not.toBeNull(); // the check mark
    expect(option("fr").getAttribute("aria-selected")).toBe("false");
  });

  it("opens and closes like the site's: trigger, Escape, a press outside", () => {
    const { trigger, menu } = openPage("fr", "/sales-page-1");

    trigger.click();
    expect(menu.hidden).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(menu.hidden).toBe(true);

    trigger.click();
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
    expect(menu.hidden).toBe(true);
  });

  it.each([
    ["en", "/en/sales-page-1", "id", "/id/sales-page-1"],
    ["en", "/en/sales-page-1", "fr", "/sales-page-1"],
    ["fr", "/sales-page-3", "en", "/en/sales-page-3"],
  ])("on the %s page (%s), picking %s opens %s with the ad's tags", (lang, path, pick, target) => {
    const { trigger, option } = openPage(lang, path, "?utm_source=meta");

    trigger.click();
    option(pick).click();

    expect(assign).toHaveBeenCalledWith(`${target}?utm_source=meta`);
    expect(document.cookie).toContain(`${LOCALE_PREF_COOKIE}=${pick}`);
    expect(localStorage.getItem("locale")).toBe(pick);
    expect(localStorage.getItem("lang")).toBe(pick);
  });

  it("puts the pick in a saved cookie choice too, keeping the choice itself", () => {
    localStorage.setItem(
      "cookie-consent-preferences",
      JSON.stringify({ essential: true, analytics: true, marketing: false, language: "fr", timestamp: 1, version: "1.0.0" })
    );
    const { trigger, option } = openPage("fr", "/sales-page-2");

    trigger.click();
    option("id").click();

    const saved = JSON.parse(localStorage.getItem("cookie-consent-preferences")!);
    expect(saved).toMatchObject({ language: "id", analytics: true, marketing: false, version: "1.0.0" });
  });

  it("does not reload the page for its own language", () => {
    const { trigger, option, menu } = openPage("id", "/id/sales-page-2");

    trigger.click();
    option("id").click();

    expect(assign).not.toHaveBeenCalled();
    expect(menu.hidden).toBe(true);
  });

  it("sends the sign-up buttons to /register in the page's language, storing nothing on a click", () => {
    document.body.innerHTML =
      '<a href="/register" data-cta="hero"><b>Mulai gratis →</b></a>' +
      '<a href="/register?next=%2Fonboarding#top" data-cta="final">Mulai</a>' +
      '<a href="/register?lang=fr" data-cta="steps">Mulai</a>' +
      '<a href="https://example.com/" data-cta="calculator">x</a>';
    openPage("id", "/id/sales-page-1");

    const hrefs = [...document.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/register?lang=id",
      "/register?next=%2Fonboarding&lang=id#top",
      "/register?lang=fr", // already says which language
      "https://example.com/", // not ours
    ]);

    document.querySelector("b")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // A signed-in team member checking the ad keeps their own language.
    expect(localStorage.getItem("locale")).toBeNull();
    expect(document.cookie).not.toContain(`${LOCALE_PREF_COOKIE}=`);
  });

  it("works on the page's file URL too (the admin report opens French that way)", () => {
    const { trigger, option } = openPage("fr", "/sales-pages/sales-page-2.html");

    trigger.click();
    option("en").click();

    expect(assign).toHaveBeenCalledWith("/en/sales-page-2");
  });
});
