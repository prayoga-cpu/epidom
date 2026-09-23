import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const state = vi.hoisted(() => ({ locale: "en" as "en" | "fr" | "id" }));
vi.mock("@/components/lang/i18n-provider", async () => {
  const { makeT } = await import("./i18n-helper");
  // strict: a key missing from fr or id renders as MISSING(key) instead of falling back to English.
  return { useI18n: () => ({ locale: state.locale, t: makeT(state.locale, true) }) };
});

import { PrivacyContent } from "../components/privacy-content";
import { CookiePolicyContent } from "../components/cookie-policy-content";
import { GdprContent } from "../components/gdpr-content";
import { TermsContent } from "@/features/marketing/terms/components/terms-content";
import { RefundPolicyContent } from "@/features/marketing/refund-policy/components/refund-policy-content";
import { COOKIE_LINKS, PROVIDERS } from "../providers";
import { DICTIONARIES, type TestLocale } from "./i18n-helper";
import { SUPPORT_EMAIL_DISPLAY, SUPPORT_MAILTO } from "@/lib/constants/contact";

const LOCALES: TestLocale[] = ["en", "fr", "id"];

const PAGES = [
  {
    name: "privacy",
    Component: PrivacyContent,
    ids: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"],
  },
  {
    name: "cookie policy",
    Component: CookiePolicyContent,
    ids: ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"],
  },
  { name: "gdpr", Component: GdprContent, ids: ["g1", "g2", "g3", "g4", "g5", "g6"] },
  {
    name: "terms",
    Component: TermsContent,
    ids: ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11"],
  },
  {
    name: "refund policy",
    Component: RefundPolicyContent,
    ids: ["r1", "r2", "r3", "r4", "r5", "r6", "r7"],
  },
] as const;

function renderPage(Component: () => React.ReactElement, locale: TestLocale) {
  state.locale = locale;
  return render(<Component />);
}

/** Section ids on the page: every element with an id inside the body grid. */
const sectionIds = (root: HTMLElement) =>
  Array.from(root.querySelectorAll("section > div > div[id]")).map((el) => el.id);

const hrefs = (nav: Element) =>
  Array.from(nav.querySelectorAll('a[href^="#"]')).map((a) => a.getAttribute("href")!.slice(1));

describe.each(PAGES)("legal page: $name", ({ Component, ids }) => {
  describe.each(LOCALES)("%s", (locale) => {
    it("renders with no missing translation keys", () => {
      const { container } = renderPage(Component, locale);
      expect(container.textContent).not.toContain("MISSING(");
      expect(container.querySelector("h1")?.textContent?.trim()).toBeTruthy();
    });

    it("has the expected section ids, and both contents lists link to exactly those", () => {
      const { container } = renderPage(Component, locale);
      expect(sectionIds(container)).toEqual([...ids]);

      const desktop = container.querySelector("aside nav")!;
      const mobile = container.querySelector("details nav")!;
      expect(hrefs(desktop)).toEqual([...ids]);
      expect(hrefs(mobile)).toEqual([...ids]);
    });

    it("titles the contents list and links back to the localized home page", () => {
      const { container } = renderPage(Component, locale);
      const back = container.querySelector("section > div > div:last-child a[href]:last-of-type");
      expect(back?.getAttribute("href")).toBe(locale === "fr" ? "/" : `/${locale}`);
      expect(container.querySelector("details summary")?.textContent).toBeTruthy();
    });
  });
});

describe("support contact comes from the shared constants", () => {
  it.each(LOCALES)(
    "%s: every contact block uses SUPPORT_MAILTO and SUPPORT_EMAIL_DISPLAY",
    (locale) => {
      for (const { Component } of PAGES) {
        const { container, unmount } = renderPage(Component, locale);
        const mailto = container.querySelector(`a[href^="mailto:"]`);
        // The refund policy also embeds the addresses in a step; the contact block is the last mailto.
        expect(mailto?.getAttribute("href")).toBe(SUPPORT_MAILTO);
        expect(mailto?.textContent).toBe(SUPPORT_EMAIL_DISPLAY);
        unmount();
      }
    }
  );

  it("the legal namespaces in every locale contain no hardcoded support address", () => {
    for (const locale of LOCALES) {
      const dict = DICTIONARIES[locale] as Record<string, unknown>;
      for (const ns of ["legal", "terms", "refundPolicy", "privacy", "gdpr", "cookiePolicy"]) {
        expect(JSON.stringify(dict[ns]), `${locale}.${ns}`).not.toMatch(/prionation\.io/i);
      }
    }
  });

  it("the legal source files do not type an address either", () => {
    const files = [
      "src/features/marketing/legal/components/legal-document.tsx",
      "src/features/marketing/legal/components/privacy-content.tsx",
      "src/features/marketing/legal/components/cookie-policy-content.tsx",
      "src/features/marketing/legal/components/gdpr-content.tsx",
      "src/features/marketing/terms/components/terms-content.tsx",
      "src/features/marketing/refund-policy/components/refund-policy-content.tsx",
    ];
    for (const f of files) {
      expect(readFileSync(join(process.cwd(), f), "utf8"), f).not.toMatch(/@prionation\.io/);
    }
  });

  it.each(LOCALES)(
    "%s: the refund steps carry the constant, with no placeholder left over",
    (locale) => {
      const { container } = renderPage(RefundPolicyContent, locale);
      const step1 = container.querySelector("#r2 ol li span:last-child")!;
      expect(step1.textContent).toContain(SUPPORT_EMAIL_DISPLAY);
      expect(container.textContent).not.toContain("{email}");
    }
  );
});

describe("cookie policy", () => {
  it.each(LOCALES)("%s: names every tracker the site really runs", (locale) => {
    const { container } = renderPage(CookiePolicyContent, locale);
    const text = container.textContent ?? "";
    expect(text).toContain("Google Analytics");
    expect(text).toContain("Meta Pixel");
    expect(text).toContain("Vercel Analytics");
    expect(text).toContain("Stripe");
    // The cookies the code actually sets, with the names the code uses.
    for (const name of [
      "better-auth.session_token",
      "epidom-staff-session",
      "epidom_locale_pref",
      "epidom:lastVisitedUrl",
      "cookie-consent-preferences",
    ]) {
      expect(text).toContain(name);
    }
  });

  it.each(LOCALES)("%s: no longer makes the two false claims", (locale) => {
    const dict = JSON.stringify((DICTIONARIES[locale] as Record<string, unknown>).cookiePolicy);
    expect(dict).not.toMatch(/self-hosted|no third-party trackers|No advertising or social-media/i);
  });

  it("links to each provider's own cookie policy and opens it safely", () => {
    const { container } = renderPage(CookiePolicyContent, "en");
    const external = Array.from(container.querySelectorAll('a[href^="https://"]'));
    const hosts = external.map((a) => new URL(a.getAttribute("href")!).host);
    expect(hosts).toEqual(
      expect.arrayContaining([
        "policies.google.com",
        "www.facebook.com",
        "vercel.com",
        "stripe.com",
      ])
    );
    for (const a of external) {
      expect(a.getAttribute("rel")).toContain("noopener");
      expect(a.getAttribute("target")).toBe("_blank");
    }
  });
});

describe("GDPR and privacy claims", () => {
  it.each(LOCALES)(
    "%s: no locale of the GDPR page (or the privacy page) names a hosting region",
    (locale) => {
      const dict = DICTIONARIES[locale] as Record<string, unknown>;
      for (const ns of ["gdpr", "privacy", "cookiePolicy"]) {
        const raw = JSON.stringify(dict[ns]);
        expect(raw, `${locale}.${ns}`).not.toMatch(
          /frankfurt|francfort|singapore|singapour|ap-southeast/i
        );
        expect(raw, `${locale}.${ns}`).not.toMatch(
          /data protection officer|\bDPO\b|délégué à la protection/i
        );
      }
      const { container } = renderPage(GdprContent, locale);
      expect(container.textContent).not.toMatch(/Frankfurt/i);
    }
  );

  it.each(LOCALES)(
    "%s: the GDPR page describes transfers outside the EU/EEA without claiming safeguards",
    (locale) => {
      const { container } = renderPage(GdprContent, locale);
      const s5 = container.querySelector("#g5")!.textContent ?? "";
      expect(s5).toMatch(/EEA|EEE|WEE/);
      expect(s5).not.toMatch(
        /we (use|rely on) standard contractual clauses|Any transfers outside the EEA rely/i
      );
    }
  );

  it.each(LOCALES)(
    "%s: the privacy page and the GDPR page list every provider in PROVIDERS",
    (locale) => {
      const dict = DICTIONARIES[locale] as {
        privacy: { processors: Record<string, { name: string }> };
      };
      for (const Component of [PrivacyContent, GdprContent]) {
        const { container, unmount } = renderPage(Component, locale);
        for (const p of PROVIDERS) {
          expect(container.textContent, `${locale} ${p.id}`).toContain(
            dict.privacy.processors[p.id].name
          );
        }
        unmount();
      }
    }
  );

  it("every provider link is an https URL opened safely", () => {
    const { container } = renderPage(GdprContent, "en");
    const links = Array.from(container.querySelectorAll("#g4 a"));
    expect(links.length).toBeGreaterThan(5);
    for (const a of links) {
      expect(a.getAttribute("href")).toMatch(/^https:\/\//);
      expect(a.getAttribute("rel")).toContain("noopener");
    }
  });

  it("the processors the code really talks to are all in the list", () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "stripe",
        "xendit",
        "resend",
        "vercel",
        "neon",
        "inngest",
        "google",
        "meta",
        "openai",
        "osm",
        "ipapi",
        "webpush",
        "fonnte",
        "cloudflare",
      ])
    );
  });

  it.each(LOCALES)(
    "%s: the privacy page states the staff attendance data it processes",
    (locale) => {
      const { container } = renderPage(PrivacyContent, locale);
      const s2 = container.querySelector("#p2")!.textContent ?? "";
      expect(s2).toMatch(/selfie/i);
      expect(s2).toMatch(/GPS/);
    }
  );

  it.each(LOCALES)(
    "%s: the privacy retention section matches the 30 / 365 day lifecycle",
    (locale) => {
      const { container } = renderPage(PrivacyContent, locale);
      const s6 = container.querySelector("#p6")!.textContent ?? "";
      expect(s6).toMatch(/\b30\b/);
      expect(s6).toMatch(/\b365\b/);
    }
  );
});

describe("terms and refund policy stay in sync across locales", () => {
  it("fr has every terms.section11 key, translated rather than copied from English", () => {
    const fr = (DICTIONARIES.fr as { terms: { section11: Record<string, string> } }).terms
      .section11;
    const en = (DICTIONARIES.en as { terms: { section11: Record<string, string> } }).terms
      .section11;
    expect(Object.keys(fr).sort()).toEqual([
      "content",
      "item1",
      "item2",
      "item3",
      "item4",
      "title",
    ]);
    for (const k of Object.keys(en)) {
      expect(fr[k]).toBeTruthy();
      expect(fr[k]).not.toBe(en[k]);
    }
    // Same figures as the English clause: the retention numbers must not drift in translation.
    expect(fr.item1).toMatch(/30/);
    expect(fr.item2).toMatch(/31/);
    expect(fr.item2).toMatch(/365/);
    expect(fr.item3).toMatch(/365/);
    expect(fr.item3).toMatch(/12/);
  });

  it.each(["terms", "refundPolicy", "privacy", "gdpr", "cookiePolicy", "legal"])(
    "fr and id have exactly the keys en has under %s",
    (ns) => {
      const leaves = (o: unknown, prefix = ""): string[] =>
        o && typeof o === "object"
          ? Object.entries(o).flatMap(([k, v]) => leaves(v, `${prefix}${k}.`))
          : [prefix.slice(0, -1)];
      const en = leaves((DICTIONARIES.en as Record<string, unknown>)[ns]).sort();
      expect(leaves((DICTIONARIES.fr as Record<string, unknown>)[ns]).sort(), `fr.${ns}`).toEqual(
        en
      );
      expect(leaves((DICTIONARIES.id as Record<string, unknown>)[ns]).sort(), `id.${ns}`).toEqual(
        en
      );
    }
  );

  it.each(LOCALES)("%s: the terms page renders section 11 with its four list items", (locale) => {
    const { container } = renderPage(TermsContent, locale);
    expect(container.querySelectorAll("#s11 ul li")).toHaveLength(4);
  });

  it.each(LOCALES)("%s: the refund page keeps its steps and the key-policy card", (locale) => {
    const { container } = renderPage(RefundPolicyContent, locale);
    expect(container.querySelectorAll("#r2 ol li")).toHaveLength(4);
    expect(container.querySelectorAll("#r1 ul li")).toHaveLength(3);
    expect(container.querySelectorAll("#r4 ul li")).toHaveLength(3);
    expect(container.querySelector("aside")?.textContent).toContain("14");
  });

  it.each(LOCALES)(
    "%s: only the pages that were rewritten carry a new last-updated date",
    (locale) => {
      const dict = DICTIONARIES[locale] as Record<string, { lastUpdatedDate: string }>;
      expect(dict.terms.lastUpdatedDate).toMatch(/2025/);
      expect(dict.refundPolicy.lastUpdatedDate).toMatch(/2025/);
      for (const ns of ["privacy", "gdpr", "cookiePolicy"])
        expect(dict[ns].lastUpdatedDate).toMatch(/2026/);
    }
  );
});

describe("French typography in the new legal copy", () => {
  it("puts a no-break space before : ; ? ! in fr strings of the rewritten pages", () => {
    const fr = DICTIONARIES.fr as Record<string, unknown>;
    const bad: string[] = [];
    const walk = (o: unknown, path: string) => {
      if (typeof o === "string") {
        // a plain space directly before a double-punctuation mark
        if (/ [:;?!](\s|$)/.test(o)) bad.push(`${path}: ${o.slice(0, 60)}`);
      } else if (o && typeof o === "object") {
        for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
      }
    };
    for (const ns of ["privacy", "gdpr", "cookiePolicy", "legal"]) walk(fr[ns], ns);
    walk((fr.terms as Record<string, unknown>).section11, "terms.section11");
    expect(bad).toEqual([]);
  });
});

describe("Cloudflare R2 backups are a disclosed processor", () => {
  type Dict = {
    privacy: {
      processors: Record<string, { name: string; purpose: string }>;
      s6: { item4: string };
    };
  };

  it("the 90 days the pages state is the backup job's own retention", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/backup/export-tables.ts"), "utf8");
    expect(src).toMatch(/const RETENTION_DAYS = 90;/);
  });

  it.each(LOCALES)(
    "%s: privacy and GDPR both name Cloudflare R2 and the 90-day retention",
    (locale) => {
      const cf = (DICTIONARIES[locale] as Dict).privacy.processors.cloudflare;
      expect(cf.name).toContain("Cloudflare");
      expect(cf.purpose).toMatch(/\b90\b/);

      const privacy = renderPage(PrivacyContent, locale);
      const p4 = privacy.container.querySelector("#p4")!.textContent ?? "";
      expect(p4).toContain(cf.name);
      expect(p4).toContain(cf.purpose);
      privacy.unmount();

      const gdpr = renderPage(GdprContent, locale);
      expect(gdpr.container.querySelector("#g4")!.textContent).toContain(cf.name);
    }
  );

  it.each(LOCALES)(
    "%s: the retention section says backup copies expire within 90 days",
    (locale) => {
      const item4 = (DICTIONARIES[locale] as Dict).privacy.s6.item4;
      expect(item4).toMatch(/\b365\b/);
      expect(item4).toMatch(/\b90\b/);
      const { container } = renderPage(PrivacyContent, locale);
      expect(container.querySelectorAll("#p6 ul li")[3].textContent).toContain(item4);
    }
  );
});

describe("Google Analytics disclosure covers what the app really sends", () => {
  // The words each locale uses for: inside the signed-in app / order number / item price and quantity.
  const FRAGMENTS = {
    en: [/inside the signed-in app/, /order number/, /price and quantity of each item/],
    fr: [/dans l'application/, /numéro de commande/, /prix et la quantité de chaque article/],
    id: [/di dalam aplikasi/, /nomor pesanan/, /harga, dan jumlah setiap item/],
  } as const;

  it.each(LOCALES)(
    "%s: the analytics section names in-app pages, actions and sale details",
    (locale) => {
      const { container } = renderPage(CookiePolicyContent, locale);
      const items = Array.from(container.querySelectorAll("#c5 ul li")).map(
        (li) => li.textContent ?? ""
      );
      expect(items).toHaveLength(3);
      expect(items[0]).toContain("Google Analytics");
      expect(items[1]).toContain("Google Analytics");
      expect(items[2]).toContain("Vercel Analytics");
      for (const re of FRAGMENTS[locale]) expect(items[1]).toMatch(re);
    }
  );

  it.each(LOCALES)("%s: the privacy page discloses the same in what we collect", (locale) => {
    const { container } = renderPage(PrivacyContent, locale);
    const item11 = container.querySelectorAll("#p2 ul li")[10].textContent ?? "";
    expect(item11).toContain("Google Analytics");
    expect(item11).toMatch(FRAGMENTS[locale][1]);
    expect(item11).toMatch(FRAGMENTS[locale][2]);
  });
});

describe("cross-references read as one link, not a doubled label", () => {
  it.each(LOCALES)(
    "%s: an in-site link ends its item, introduced by a colon, and is named once",
    (locale) => {
      for (const Component of [PrivacyContent, GdprContent, CookiePolicyContent]) {
        const { container, unmount } = renderPage(Component, locale);
        const internal = Array.from(container.querySelectorAll("li a")).filter(
          (a) => !/^https?:/.test(a.getAttribute("href") ?? "")
        );
        expect(internal.length).toBeGreaterThan(0);
        for (const a of internal) {
          const label = a.textContent ?? "";
          const text = a.closest("li")!.textContent ?? "";
          expect(text.endsWith(label), text).toBe(true);
          // named once: the sentence before the link does not spell out the same label
          expect(text.toLowerCase().split(label.toLowerCase()).length - 1, text).toBe(1);
          // and that sentence hands over to the link with a colon
          expect(text.slice(0, text.length - label.length).trim(), text).toMatch(/:$/);
        }
        unmount();
      }
    }
  );

  it.each(LOCALES)("%s: the privacy page keeps its four cross-references", (locale) => {
    const { container } = renderPage(PrivacyContent, locale);
    const to = (suffix: string) => container.querySelectorAll(`li a[href$="${suffix}"]`).length;
    expect(to("/cookie-policy")).toBe(2); // what we collect, withdrawing consent
    expect(to("/terms")).toBe(1); // how long we keep it
    expect(to("/gdpr")).toBe(1); // international transfers
  });
});

describe("cookie policy provider links are labelled for what they open", () => {
  it.each(LOCALES)("%s: cookie pages say so, privacy policies say so", (locale) => {
    const legal = (
      DICTIONARIES[locale] as { legal: { providerPolicy: string; providerCookies: string } }
    ).legal;
    expect(legal.providerCookies).not.toBe(legal.providerPolicy);
    const { container } = renderPage(CookiePolicyContent, locale);
    const label = (href: string) => container.querySelector(`a[href="${href}"]`)?.textContent;
    expect(label(COOKIE_LINKS.google)).toBe(legal.providerCookies);
    expect(label(COOKIE_LINKS.meta)).toBe(legal.providerCookies);
    expect(label(COOKIE_LINKS.stripe)).toBe(legal.providerCookies);
    expect(label(COOKIE_LINKS.vercel)).toBe(legal.providerPolicy);
    expect(label(COOKIE_LINKS.googleAccount)).toBe(legal.providerPolicy);
  });
});

describe("the refund key-policy callout on a phone", () => {
  it.each(LOCALES)(
    "%s: is rendered outside the desktop-only sidebar, under the contents list",
    (locale) => {
      const body = (DICTIONARIES[locale] as { refundPolicy: { keyPolicyBody: string } })
        .refundPolicy.keyPolicyBody;
      const { container } = renderPage(RefundPolicyContent, locale);

      const mobile = container.querySelector("section > div.lg\\:hidden")!;
      expect(mobile.textContent).toContain(body);
      expect(mobile.closest("aside")).toBeNull();
      // the desktop copy is still in the sidebar
      expect(container.querySelector("aside")!.textContent).toContain(body);

      const details = container.querySelector("section > details")!;
      expect(
        details.compareDocumentPosition(mobile) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  );

  it("pages without a callout render no mobile copy", () => {
    for (const Component of [TermsContent, PrivacyContent, GdprContent, CookiePolicyContent]) {
      const { container, unmount } = renderPage(Component, "en");
      expect(container.querySelectorAll("section > div.lg\\:hidden")).toHaveLength(0);
      unmount();
    }
  });
});

describe("French typography of the legal chrome", () => {
  it("fr: the support-email label is followed by a no-break space before the colon", () => {
    for (const { Component } of PAGES) {
      const { container, unmount } = renderPage(Component, "fr");
      const label = container.querySelector('a[href^="mailto:"]')!.previousElementSibling!;
      expect(label.textContent).toMatch(/\S : $/);
      unmount();
    }
  });

  it.each(["en", "id"] as const)("%s: the support-email label keeps a plain colon", (locale) => {
    for (const { Component } of PAGES) {
      const { container, unmount } = renderPage(Component, locale);
      const label = container.querySelector('a[href^="mailto:"]')!.previousElementSibling!;
      expect(label.textContent).toMatch(/\S: $/);
      expect(label.textContent).not.toContain(" ");
      unmount();
    }
  });

  it("fr: month names are lowercase in every last-updated date", () => {
    const fr = DICTIONARIES.fr as Record<string, { lastUpdatedDate: string }>;
    for (const ns of ["terms", "refundPolicy", "privacy", "gdpr", "cookiePolicy"]) {
      expect(fr[ns].lastUpdatedDate, ns).not.toMatch(
        /(Janvier|Février|Mars|Avril|Mai|Juin|Juillet|Août|Septembre|Octobre|Novembre|Décembre)/
      );
    }
    expect(fr.terms.lastUpdatedDate).toBe("novembre 2025");
    expect(fr.refundPolicy.lastUpdatedDate).toBe("novembre 2025");
  });
});

describe("spelling of the legal copy", () => {
  const legalNamespaces = ["legal", "terms", "refundPolicy", "privacy", "gdpr", "cookiePolicy"];

  it("en is American: summarize, recognize, customize", () => {
    const en = DICTIONARIES.en as Record<string, unknown>;
    for (const ns of legalNamespaces) {
      expect(JSON.stringify(en[ns]), ns).not.toMatch(
        /summaris|recognis|customis|organis|authoris|minimis|behaviour|colour|licence/i
      );
    }
    expect(JSON.stringify(en.gdpr)).toContain("summarizes");
    expect(JSON.stringify(en.gdpr)).toContain("recognizes");
    expect(JSON.stringify(en.cookiePolicy)).toContain("customize");
  });

  it("id calls the storefront halaman toko, not etalase", () => {
    const id = DICTIONARIES.id as Record<string, unknown>;
    for (const ns of legalNamespaces) expect(JSON.stringify(id[ns]), ns).not.toMatch(/etalase/i);
    expect(JSON.stringify(id.privacy)).toContain("halaman toko");
  });
});
