import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { StaticImageData } from "next/image";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

// ── Mocks ────────────────────────────────────────────────────────────────────
// t() reads the real English dictionary so a renamed or deleted key fails here
// instead of silently rendering the key path.

const mockLocale = vi.hoisted(() => ({ value: "en" as "en" | "fr" | "id" }));
const nav = vi.hoisted(() => ({ push: vi.fn() }));

// One shared push() so a test can see where a button sends the visitor.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: nav.push,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/components/lang/i18n-provider", async () => {
  const { en } = await import("@/locales/en");
  const { fr } = await import("@/locales/fr");
  const { id } = await import("@/locales/id");
  const dictionaries = { en, fr, id } as Record<string, unknown>;
  const lookup = (dict: unknown, key: string): unknown =>
    key
      .split(".")
      .reduce<unknown>(
        (acc, k) =>
          acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined,
        dict
      );
  return {
    useI18n: () => ({
      locale: mockLocale.value,
      t: (key: string) => {
        const value = lookup(dictionaries[mockLocale.value] ?? en, key) ?? lookup(en, key);
        return typeof value === "string" ? value : key;
      },
    }),
  };
});

vi.mock("@/features/marketing/shared/components/phone-menu", () => ({
  PhoneMenu: () => <div data-testid="phone-menu" />,
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

import { TrustBar } from "@/features/marketing/home/components/trust-bar";
import { CaseStudiesSection } from "@/features/marketing/home/components/case-studies-section";
import { PhoneKDS } from "@/features/marketing/shared/components/phone-kds";
import { FeaturesShowcaseSection } from "@/features/marketing/services/components/features-showcase-section";
import {
  TRUSTED_BRANDS,
  getConsentedBrands,
  type TrustedBrand,
} from "@/features/marketing/home/data/trusted-brands";
import {
  CASE_STUDIES,
  isPublishableCaseStudy,
  type CaseStudy,
} from "@/features/marketing/home/data/case-studies";

const DICTIONARIES = { en, fr, id } as const;
type Loc = keyof typeof DICTIONARIES;
const LOCALES: Loc[] = ["fr", "id", "en"];

function text(locale: Loc, path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
      DICTIONARIES[locale]
    );
  if (typeof value !== "string") throw new Error(`${locale} is missing ${path}`);
  return value;
}

/** testing-library collapses whitespace (incl. the no-break space fr puts before ":") in the DOM text only. */
const norm = (value: string) => value.replace(/\s+/g, " ").trim();

const logo = (name: string): StaticImageData => ({ src: `/${name}.jpg`, width: 200, height: 200 });

function brand(
  overrides: Partial<TrustedBrand> & Pick<TrustedBrand, "slug" | "name">
): TrustedBrand {
  return { logo: logo(overrides.slug), consented: false, ...overrides };
}

function study(overrides: Partial<CaseStudy> = {}): CaseStudy {
  return {
    slug: "cafe-test",
    shopName: "Café Test",
    ownerName: "Alex Owner",
    location: "Lyon",
    quote: "Orders are easier to follow now.",
    metrics: [
      { value: "-30%", label: "Missed orders", source: "Owner interview, 2026-01" },
      { value: "12 min", label: "Saved per closing", source: "Owner interview, 2026-01" },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  mockLocale.value = "en";
  nav.push.mockClear();
  // motion's whileInView needs IntersectionObserver, which jsdom lacks.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
  );
});

// ── TrustBar ─────────────────────────────────────────────────────────────────

describe("TrustBar", () => {
  it("ships with an empty brand list, so no customer logo can render", () => {
    // Was five entries all flagged consented:false. The list is now empty and the
    // five entries live in a commented template, so an unconsented logo is not
    // even imported into the client bundle.
    expect(TRUSTED_BRANDS).toEqual([]);
    expect(getConsentedBrands()).toEqual([]);
  });

  it("imports no brand logo and names no brand in code, only in the commented template", () => {
    const source = readFileSync(
      resolve(__dirname, "../../features/marketing/home/data/trusted-brands.ts"),
      "utf8"
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    expect(code).not.toMatch(/assets\/brands/);
    expect(code).not.toMatch(/\.jpg/);
    for (const brand of ["Holy Cookie", "La Fabrique", "Laura Todd", "Momma Cookies", "Pépite"]) {
      expect(code, `${brand} must only appear in the commented template`).not.toContain(brand);
    }
    // The template is still there, with its instruction.
    expect(source).toContain("../assets/brands/laura-todd.jpg");
    expect(source).toMatch(/ONLY after the brand confirms in writing/);
  });

  it("shipped state: renders nothing at all, not a label over an empty row", () => {
    const { container } = render(<TrustBar />);
    expect(container).toBeEmptyDOMElement();
    for (const fictional of ["Warung Sari", "Café Bretonne", "Maison Lacroix", "Kopi Tujuh"]) {
      expect(screen.queryByText(fictional)).toBeNull();
    }
  });

  it.each(LOCALES)("%s: the label comes from the locale", (loc) => {
    mockLocale.value = loc;
    render(<TrustBar brands={[brand({ slug: "yes", name: "Yes", consented: true })]} />);
    expect(screen.getByText(text(loc, "redesign.landing.trust.label"))).toBeInTheDocument();
  });

  it("consented state: renders only the consented logos, with the brand name as alt text", () => {
    const brands = [
      brand({ slug: "yes-one", name: "Yes One", consented: true }),
      brand({ slug: "no-one", name: "No One", consented: false }),
      brand({ slug: "yes-two", name: "Yes Two", consented: true, zoom: 1.05 }),
    ];
    render(<TrustBar brands={brands} />);
    const strip = screen.getByTestId("trusted-brands");
    expect(within(strip).getByText("Already running on Epidom")).toBeInTheDocument();
    const images = within(strip).getAllByRole("img");
    expect(images.map((img) => img.getAttribute("alt"))).toEqual(["Yes One", "Yes Two"]);
    for (const img of images) {
      expect(img).toHaveAttribute("width", "56");
      expect(img).toHaveAttribute("height", "56");
    }
    expect(screen.queryByAltText("No One")).toBeNull();
  });

  it("treats a missing or non-true consent flag as not consented", () => {
    const sloppy = { slug: "x", name: "X", logo: logo("x") } as unknown as TrustedBrand;
    const { container } = render(<TrustBar brands={[sloppy]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

// ── CaseStudiesSection ───────────────────────────────────────────────────────

describe("CaseStudiesSection", () => {
  it("ships empty", () => {
    expect(CASE_STUDIES).toEqual([]);
  });

  it("renders nothing at all when the list is empty (no heading, no hole)", () => {
    const { container } = render(<CaseStudiesSection studies={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing with the shipped data", () => {
    const { container } = render(<CaseStudiesSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders shop, owner, quote and both metrics with their sources for a valid entry", () => {
    render(<CaseStudiesSection studies={[study()]} />);
    expect(screen.getByText("Real results")).toBeInTheDocument();
    expect(screen.getByText("Alex Owner")).toBeInTheDocument();
    expect(screen.getByText(/Café Test · Lyon/)).toBeInTheDocument();
    expect(screen.getByText(/Orders are easier to follow now\./)).toBeInTheDocument();
    expect(screen.getByText("-30%")).toBeInTheDocument();
    expect(screen.getByText("Missed orders")).toBeInTheDocument();
    expect(screen.getByText("12 min")).toBeInTheDocument();
    expect(screen.getByText("Saved per closing")).toBeInTheDocument();
    expect(screen.getAllByText(/Owner interview, 2026-01/)).toHaveLength(2);
  });

  it("rejects an entry whose metric has no source", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const noSource = study({
      metrics: [
        { value: "-30%", label: "Missed orders", source: "Owner interview" },
        { value: "12 min", label: "Saved per closing", source: "   " },
      ],
    });
    expect(isPublishableCaseStudy(noSource)).toBe(false);
    const { container } = render(<CaseStudiesSection studies={[noSource]} />);
    expect(container).toBeEmptyDOMElement();
    warn.mockRestore();
  });

  it("accepts a study with the shop and quote only, and shows no figures for it", () => {
    const quoteOnly = study({ metrics: undefined });
    expect(isPublishableCaseStudy(quoteOnly)).toBe(true);
    render(<CaseStudiesSection studies={[quoteOnly]} />);
    expect(screen.getByText(/Orders are easier to follow now\./)).toBeInTheDocument();
    expect(screen.getByText(/Café Test · Lyon/)).toBeInTheDocument();
    expect(screen.queryByText("-30%")).toBeNull();
    expect(screen.queryByText(/Owner interview/)).toBeNull();
  });

  it("rejects entries with a number of metrics other than zero or two, or without a quote", () => {
    const oneMetric = study({
      metrics: [
        { value: "-30%", label: "Missed orders", source: "Interview" },
      ] as unknown as CaseStudy["metrics"],
    });
    expect(isPublishableCaseStudy(oneMetric)).toBe(false);
    expect(isPublishableCaseStudy(study({ quote: "  " }))).toBe(false);
    expect(isPublishableCaseStudy(study({ quote: {} }))).toBe(false);
  });

  it("keeps the valid entries and drops only the invalid one", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bad = study({
      slug: "bad",
      shopName: "Bad Shop",
      metrics: [
        { value: "1", label: "A", source: "" },
        { value: "2", label: "B", source: "x" },
      ],
    });
    render(<CaseStudiesSection studies={[bad, study()]} />);
    expect(screen.getByText(/Café Test · Lyon/)).toBeInTheDocument();
    expect(screen.queryByText(/Bad Shop/)).toBeNull();
    warn.mockRestore();
  });

  it("uses the locale's quote when a per-locale map is given, with French guillemets", () => {
    mockLocale.value = "fr";
    render(
      <CaseStudiesSection
        studies={[
          study({ quote: { fr: "Les commandes sont plus claires.", en: "Clearer orders." } }),
        ]}
      />
    );
    expect(screen.getByText(/Les commandes sont plus claires\./)).toBeInTheDocument();
    expect(screen.getByText(/«/)).toBeInTheDocument();
    expect(screen.queryByText(/Clearer orders/)).toBeNull();
  });

  it("links to an internal story with the locale prefix and to an external one in a new tab", () => {
    mockLocale.value = "en";
    render(
      <CaseStudiesSection
        studies={[
          study({ slug: "a", storyHref: "/blog/a-story" }),
          study({ slug: "b", shopName: "Other", storyHref: "https://example.com/story" }),
        ]}
      />
    );
    const links = screen.getAllByRole("link", { name: /Read the story/ });
    expect(links[0]).toHaveAttribute("href", "/en/blog/a-story");
    expect(links[1]).toHaveAttribute("href", "https://example.com/story");
    expect(links[1]).toHaveAttribute("target", "_blank");
    expect(links[1]).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});

// ── Mockups: no borrowed business names, and the KDS speaks the visitor's language ──

describe("PhoneKDS", () => {
  it.each(LOCALES)("%s: every label comes from the locale, none left in English", (loc) => {
    mockLocale.value = loc;
    const { container } = render(<PhoneKDS />);
    const shown = container.textContent ?? "";

    for (const key of ["tickets", "table4", "walkIn", "igLink", "markReady"]) {
      expect(shown, `${loc} kds.${key}`).toContain(text(loc, `redesign.dashboard.kds.${key}`));
    }
    expect(shown).toContain(text(loc, "redesign.dashboard.kds.kitchen").replace("{count}", "3"));
    expect(shown).toContain(`● ${text(loc, "redesign.dashboard.kds.live")}`);
    expect(shown).not.toContain("{count}");
  });

  it("fr and id do not fall back to the English KDS strings", () => {
    for (const loc of ["fr", "id"] as const) {
      mockLocale.value = loc;
      const { container, unmount } = render(<PhoneKDS />);
      const shown = container.textContent ?? "";
      for (const key of ["live", "kitchen", "tickets", "table4", "walkIn", "igLink", "markReady"]) {
        const english = text("en", `redesign.dashboard.kds.${key}`).replace("{count}", "3");
        // Some strings are the same word in both languages ("Tickets", "Table 4").
        if (
          text(loc, `redesign.dashboard.kds.${key}`) === text("en", `redesign.dashboard.kds.${key}`)
        ) {
          continue;
        }
        expect(shown, `${loc} still shows the English "${english}"`).not.toContain(english);
      }
      unmount();
    }
  });
});

// ── Services page: the report mockup no longer invents an inbox ─────────────

describe("FeaturesShowcaseSection report mockup", () => {
  it.each(LOCALES)("%s: no fictional e-mail address and no nightly e-mail promise", (loc) => {
    mockLocale.value = loc;
    const { container } = render(<FeaturesShowcaseSection />);
    const shown = container.textContent ?? "";
    // Receipts and supplier orders really do go out by e-mail (2.95.0, 2.103.0),
    // so the section may say "par e-mail"; only the report is never e-mailed.
    const report = screen.getByTestId("services-report-mockup").textContent ?? "";

    expect(shown).not.toMatch(/\S+@\S+\.\S+/);
    expect(shown).not.toContain("23:59");
    expect(report).not.toMatch(/emailed|envoyé à\s*:|dikirim ke\s*:|diemail|par e-mail|inbox/i);
    expect(report).toContain(text(loc, "redesign.servicesPage.plSettled"));
  });
});
