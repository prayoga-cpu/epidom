import { describe, it, expect } from "vitest";
import { createCookieGetter } from "better-auth/cookies";
import {
  previewAuthCookiePrefix,
  resolveCrossSubDomainCookies,
  sessionCookieNames,
} from "../cookies";

/**
 * The implementation `getCrossSubDomainCookies` had in src/lib/auth.ts before
 * the preview isolation change, kept verbatim as the reference. Every host that
 * production (or local dev) can actually run on must keep getting exactly what
 * this returned — that is what "production is untouched" means here.
 */
function legacyCrossSubDomainCookies(appUrl: string | undefined, nodeEnv: string | undefined) {
  if (nodeEnv !== "production") return undefined;
  try {
    const host = new URL(appUrl || "").hostname;
    if (!host || host === "localhost" || host.endsWith(".vercel.app")) return undefined;
    const parts = host.split(".");
    const root = parts.length >= 2 ? parts.slice(-2).join(".") : host;
    return { enabled: true, domain: `.${root}` };
  } catch {
    return undefined;
  }
}

describe("resolveCrossSubDomainCookies", () => {
  const PRODUCTION_LIKE = [
    ["apex", "https://epidom.fr"],
    ["apex with slash", "https://epidom.fr/"],
    ["apex with path", "https://epidom.fr/en"],
    ["www alias", "https://www.epidom.fr"],
    ["localhost", "http://localhost:3000"],
    ["vercel.app alias", "https://epidom-eight.vercel.app"],
    ["vercel.app branch url", "https://epidom-git-epidom-revamp-x-projects.vercel.app"],
    ["empty", ""],
    ["not a url", "not a url"],
  ] as const;

  it.each(PRODUCTION_LIKE)("matches the legacy result in production for %s", (_label, url) => {
    expect(resolveCrossSubDomainCookies(url, "production")).toEqual(
      legacyCrossSubDomainCookies(url, "production")
    );
  });

  it("matches the legacy result when the URL is unset", () => {
    expect(resolveCrossSubDomainCookies(undefined, "production")).toEqual(
      legacyCrossSubDomainCookies(undefined, "production")
    );
  });

  it("shares the registrable domain for the apex and its www alias", () => {
    expect(resolveCrossSubDomainCookies("https://epidom.fr", "production")).toEqual({
      enabled: true,
      domain: ".epidom.fr",
    });
    expect(resolveCrossSubDomainCookies("https://www.epidom.fr", "production")).toEqual({
      enabled: true,
      domain: ".epidom.fr",
    });
  });

  it("keeps a sibling subdomain host-only, so dev.epidom.fr cannot write production's cookie", () => {
    expect(resolveCrossSubDomainCookies("https://dev.epidom.fr", "production")).toBeUndefined();
    expect(resolveCrossSubDomainCookies("https://staging.epidom.fr", "production")).toBeUndefined();
    expect(resolveCrossSubDomainCookies("https://a.b.epidom.fr", "production")).toBeUndefined();
    // Confirms this is the one deliberate difference from the legacy behaviour.
    expect(legacyCrossSubDomainCookies("https://dev.epidom.fr", "production")).toEqual({
      enabled: true,
      domain: ".epidom.fr",
    });
  });

  it.each(["development", "test", undefined])("is off outside production (NODE_ENV=%s)", (env) => {
    expect(resolveCrossSubDomainCookies("https://epidom.fr", env)).toBeUndefined();
  });
});

describe("previewAuthCookiePrefix", () => {
  it("only applies on a Vercel preview", () => {
    expect(previewAuthCookiePrefix("preview")).toBe("epidom-preview");
  });

  it.each(["production", "development", "", undefined])(
    "leaves Better Auth's default prefix alone for VERCEL_ENV=%s",
    (env) => {
      expect(previewAuthCookiePrefix(env)).toBeUndefined();
    }
  );
});

describe("sessionCookieNames", () => {
  it.each(["production", "development", undefined])(
    "keeps the existing production cookie names for VERCEL_ENV=%s — renaming them would sign everyone out",
    (env) => {
      expect(sessionCookieNames(env)).toEqual([
        "better-auth.session_token",
        "__Secure-better-auth.session_token",
      ]);
    }
  );

  // The readers (auth.ts getSessionResult, proxy.ts) look the session up by name,
  // while Better Auth writes it under a name it builds itself. If those ever drift
  // apart every signed-in request looks signed out, so pin them to the real thing.
  it.each([
    ["production", "production", undefined],
    ["preview", "preview", "epidom-preview"],
  ] as const)(
    "names the session cookie exactly as Better Auth writes it (%s)",
    (_label, vercelEnv, cookiePrefix) => {
      const getCookie = createCookieGetter({
        baseURL: "https://epidom.fr",
        advanced: { useSecureCookies: true, ...(cookiePrefix ? { cookiePrefix } : {}) },
      });
      const [, secureName] = sessionCookieNames(vercelEnv);
      expect(getCookie("session_token").name).toBe(secureName);
    }
  );

  it("uses a distinct pair on a preview, so production's .epidom.fr cookie is never read there", () => {
    const preview = sessionCookieNames("preview");
    const production = sessionCookieNames("production");
    expect(preview).toEqual([
      "epidom-preview.session_token",
      "__Secure-epidom-preview.session_token",
    ]);
    for (const name of preview) expect(production).not.toContain(name);
  });
});
