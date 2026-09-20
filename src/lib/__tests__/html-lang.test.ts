import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "@/lib/i18n-routing";
import { resolveHtmlLang } from "../html-lang";

describe("resolveHtmlLang", () => {
  it.each(LOCALES)("uses the locale the proxy set: %s", (locale) => {
    expect(resolveHtmlLang(locale)).toBe(locale);
  });

  it("stays English on routes the proxy does not stamp (dashboard, storefront)", () => {
    expect(resolveHtmlLang(null)).toBe("en");
    expect(resolveHtmlLang(undefined)).toBe("en");
    expect(resolveHtmlLang("")).toBe("en");
  });

  it("never echoes a value that is not a site locale, e.g. a header a client sent itself", () => {
    expect(resolveHtmlLang("de")).toBe("en");
    expect(resolveHtmlLang("FR")).toBe("en");
    expect(resolveHtmlLang('fr"><script>')).toBe("en");
  });
});

describe("root layout", () => {
  const source = readFileSync(resolve(process.cwd(), "src/app/layout.tsx"), "utf8");

  it("derives <html lang> from the proxy's locale header instead of hardcoding it", () => {
    expect(source).not.toMatch(/<html\s+lang="/);
    expect(source).toMatch(/<html\s+lang=\{lang\}/);
    expect(source).toMatch(/resolveHtmlLang\(\(await headers\(\)\)\.get\(LOCALE_HEADER\)\)/);
  });

  it("keeps suppressHydrationWarning on <html>, the zoom boot script and the analytics mounts", () => {
    expect(source).toMatch(/<html[^>]*suppressHydrationWarning/);
    expect(source).toContain("ZOOM_BOOT_SCRIPT");
    expect(source).toContain("<ConditionalAnalytics />");
    expect(source).toContain("<GoogleAnalyticsScript />");
    expect(source).toContain("<MetaPixelScript />");
  });
});
