import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { en } from "@/locales/en";
import { fr } from "@/locales/fr";
import { id } from "@/locales/id";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockLocale = vi.hoisted(() => ({ value: "fr" as "en" | "fr" | "id" }));
const session = vi.hoisted(() => ({ user: null as null | { id: string } }));
const analytics = vi.hoisted(() => ({ trackEvent: vi.fn(), trackMetaPixelEvent: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-client", () => ({
  useUser: () => ({ user: session.user, loading: false, session: null }),
}));

vi.mock("@/lib/analytics", () => analytics);

vi.mock("@/components/lang/i18n-provider", async () => {
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
    INTL_LOCALES: { en: "en-US", fr: "fr-FR", id: "id-ID" },
    useI18n: () => ({
      locale: mockLocale.value,
      t: (key: string) => {
        const value = lookup(dictionaries[mockLocale.value], key) ?? lookup(en, key);
        return typeof value === "string" ? value : key;
      },
    }),
  };
});

import { HeroSection } from "../hero-section";
import { ProblemPickerSection } from "../problem-picker-section";
import { MarginCalculatorSection } from "../margin-calculator-section";
import { MigrationModal } from "../migration-modal";
import { NF525_SETTLED } from "../../lib/migration";
import { PricingSection } from "../pricing-section";
import { ThreeSpacesSection } from "../three-spaces-section";
import { UsesSection } from "../uses-section";
import { PosTourSection } from "../pos-tour-section";
import { FinalCtaSection } from "../final-cta-section";
import { PAINS } from "../../data/problems";
import { PRODUCT_SCREENS } from "@/features/marketing/shared/content/product-screens";
import { POS_TRIAL_REGISTER_HREF } from "@/features/onboarding/lib/plan-intent";
import { APP_RELEASE_DATE, APP_VERSION } from "@/lib/version";
import { onlinePaymentCopyKey } from "@/config/storefront-ordering.config";
import { WHATSAPP_NUMBERS } from "@/lib/constants/contact";
import { getLocalizedPath } from "@/lib/i18n-routing";

const DICTS = { en, fr, id } as const;
type Loc = keyof typeof DICTS;

function text(loc: Loc, path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
      DICTS[loc]
    );
  if (typeof value !== "string") throw new Error(`${loc} is missing ${path}`);
  return value;
}

/** Intl puts narrow no-break spaces in French amounts; compare on plain spaces. */
const plain = (value: string | null | undefined) => (value ?? "").replace(/\s/g, " ");

beforeEach(() => {
  mockLocale.value = "fr";
  session.user = null;
  analytics.trackEvent.mockClear();
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

// ── Hero ─────────────────────────────────────────────────────────────────────

describe("HeroSection", () => {
  it("the 'already have a till' link opens the migration modal", () => {
    const open = vi.fn();
    render(<HeroSection onOpenMigration={open} />);
    fireEvent.click(
      screen.getByRole("button", { name: text("fr", "redesign.landing.hero.migrationLink") })
    );
    expect(open).toHaveBeenCalledOnce();
  });

  it.each([
    ["fr", "Commande en ligne et caisse, pour cafés", "Vos clients commandent, vous encaissez"],
    ["en", "Online ordering + POS for cafés", "Customers order on their phone, you get paid"],
    ["id", "Kasir Pesan Lewat HP", "Pelanggan pesan dari HP, Anda langsung dibayar"],
  ] as const)("%s: one h1, with its tagline under it", (loc, headline, tagline) => {
    mockLocale.value = loc;
    render(<HeroSection onOpenMigration={() => {}} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const h1 = screen.getByRole("heading", { level: 1, name: headline });
    const taglineEl = screen.getByText(
      (_, el) => el?.tagName === "P" && el.textContent === tagline
    );
    expect(h1.compareDocumentPosition(taglineEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("fr: the headline breaks on two lines and reads as one sentence", () => {
    mockLocale.value = "fr";
    render(<HeroSection onOpenMigration={() => {}} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.querySelectorAll("br")).toHaveLength(1);
    expect(h1.textContent).toBe("Commande en ligne et caisse, pour cafés");
  });

  it("the search card checks whether a link is free, offers to claim it, and lists the cafés already on Epidom", async () => {
    mockLocale.value = "en";
    window.localStorage.clear();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const fetchMock = vi.fn(async (url: string) => {
      const q = new URL(url, "http://x").searchParams.get("q") ?? "";
      const data =
        q === "Bob"
          ? {
              stores: [{ slug: "bobs-cafe", displayName: "Bob's Café" }],
              link: { slug: "bob", available: false },
            }
          : q === "my-new-cafe"
            ? { stores: [], link: { slug: "my-new-cafe", available: true } }
            : { stores: [], link: null };
      return { ok: true, json: async () => ({ data }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<HeroSection onOpenMigration={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /Claim your free phone-orders link/ }));
    const input = await screen.findByRole("combobox", {
      name: "Claim your free phone-orders link",
    });
    expect(input).toHaveFocus();

    // Taken: said plainly; the cafés that match are listed, each opening its page.
    fireEvent.change(input, { target: { value: "@Bob" } });
    const option = await screen.findByRole("option", { name: /Bob's Café/ });
    expect(screen.getByText("epidom.fr/@bob is taken. Try another name.")).toBeInTheDocument();
    expect(screen.getByText("Already on Epidom")).toBeInTheDocument();
    expect(within(option).getByRole("link", { name: /^Open Link$/ })).toHaveAttribute(
      "href",
      "/@bobs-cafe"
    );
    expect(fetchMock.mock.calls[0][0]).toBe("/api/public/storefront-search?q=Bob");

    // Free: claim it. The link is handed to the setup wizard through the browser.
    fireEvent.change(input, { target: { value: "my-new-cafe" } });
    expect(await screen.findByText("epidom.fr/@my-new-cafe is free")).toBeInTheDocument();
    const claim = screen.getByRole("link", { name: "Create my store with this link" });
    expect(claim).toHaveAttribute("href", "/register");
    expect(screen.getByText(/no card needed/)).toBeInTheDocument();
    fireEvent.click(claim);
    expect(JSON.parse(window.localStorage.getItem("epidom:claimed-link")!).slug).toBe(
      "my-new-cafe"
    );

    // Too short to be a link, and no café: the old "not on Epidom" answer.
    fireEvent.change(input, { target: { value: "zq" } });
    expect(await screen.findByText("@zq is not on Epidom yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Register your store now" })).toHaveAttribute(
      "href",
      "/register"
    );
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("offers the 14-day POS trial next to the search, and says no card is needed", () => {
    render(<HeroSection onOpenMigration={() => {}} />);
    expect(
      screen.getByRole("link", { name: text("fr", "redesign.landing.hero.trialCta") })
    ).toBeInTheDocument();
    expect(screen.getByText(text("fr", "redesign.landing.hero.noCard"))).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: text("fr", "redesign.landing.hero.ctaCalculator") })
    ).toBeNull();
  });

  it("sets the headline in the display face and the tagline on one line in its light companion, one colour", () => {
    mockLocale.value = "en";
    render(<HeroSection onOpenMigration={() => {}} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className).toMatch(/\bepi-display\b/);
    const taglineEl = screen.getByText(
      (_, el) =>
        el?.tagName === "P" && el.textContent === "Customers order on their phone, you get paid"
    );
    expect(taglineEl.className).toMatch(/\bepi-display-light\b/);
    expect(taglineEl.className).toMatch(/whitespace-nowrap/);
    expect(taglineEl.querySelector("[class*='gold']")).toBeNull();
    // Sized from its box (as wide as the h1), not a fixed size.
    expect(taglineEl.getAttribute("style")).toMatch(/--tagline-em:\s*[\d.]+/);
    expect(taglineEl.className).toMatch(/100cqi/);
  });

  it("shows the photo with alt text in the visitor's language, loaded eagerly at high priority", () => {
    mockLocale.value = "en";
    render(<HeroSection onOpenMigration={() => {}} />);
    const photo = screen.getByRole("img", { name: /café staff laughing/ });
    expect(photo).toHaveAttribute("fetchpriority", "high");
    expect(photo).not.toHaveAttribute("loading", "lazy");
  });

  describe("facts", () => {
    // UTC-11: a visitor here would see the release day slip to the day before if
    // the date were read in local time.
    beforeEach(() => {
      vi.stubEnv("TZ", "Pacific/Pago_Pago");
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    const releaseDay = (intlLocale: string) =>
      new Intl.DateTimeFormat(intlLocale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${APP_RELEASE_DATE}T00:00:00Z`));

    it("lists 24h WhatsApp support and the last update, which opens the changelog", () => {
      render(<HeroSection onOpenMigration={() => {}} />);
      const facts = screen.getByText("Support en ligne 24 h/24").closest("dl")!;
      expect(within(facts).getAllByRole("term")).toHaveLength(2);
      expect(within(facts).queryByText("Vitrine")).toBeNull();
      expect(within(facts).getByRole("button", { name: /par WhatsApp$/ })).toBeInTheDocument();
      expect(within(facts).getByText("Dernière mise à jour")).toBeInTheDocument();
      const update = within(facts).getByRole("link", { name: plain(releaseDay("fr-FR")) });
      expect(update).toHaveAttribute("href", getLocalizedPath("/changelog", "fr"));
      // The date only: a version number means nothing to a café owner.
      expect(update.textContent).not.toContain(APP_VERSION);
    });

    it("en: the update date reads the English way, year included", () => {
      mockLocale.value = "en";
      render(<HeroSection onOpenMigration={() => {}} />);
      expect(screen.getByText("Last updated")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: releaseDay("en-US") })).toBeInTheDocument();
      expect(releaseDay("en-US")).toMatch(/\d{4}$/);
    });

    it.each([
      ["fr", /par WhatsApp$/, ["France", "Indonésie"], ["fr", "id"]],
      ["id", /via WhatsApp$/, ["Indonesia", "Prancis"], ["id", "fr"]],
    ] as const)(
      "%s: support opens both WhatsApp numbers, the visitor's market first",
      (loc, trigger, labels, markets) => {
        mockLocale.value = loc;
        render(<HeroSection onOpenMigration={() => {}} />);
        fireEvent.click(screen.getByRole("button", { name: trigger }));
        const links = within(screen.getByRole("dialog")).getAllByRole("link");
        expect(links.map((a) => a.textContent)).toEqual(labels);
        expect(links.map((a) => a.getAttribute("href"))).toEqual(
          markets.map((m) => `https://wa.me/${WHATSAPP_NUMBERS[m].number}`)
        );
        for (const a of links) expect(a).toHaveAttribute("target", "_blank");
      }
    );
  });
});

// ── Problem picker ───────────────────────────────────────────────────────────

describe("ProblemPickerSection", () => {
  it("opens on Commissions, so the panel is never empty", () => {
    render(<ProblemPickerSection />);
    const chip = screen.getByRole("button", { name: "Commissions" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("heading", {
        name: text("fr", "redesign.landing.picker.pains.commissions.pain"),
      })
    ).toBeInTheDocument();
  });

  it("switching pain updates the panel and is tracked; the panel is a polite live region", () => {
    const { container } = render(<ProblemPickerSection />);
    fireEvent.click(screen.getByRole("button", { name: "Coupures" }));
    expect(
      screen.getByRole("heading", {
        name: text("fr", "redesign.landing.picker.pains.outages.pain"),
      })
    ).toBeInTheDocument();
    expect(screen.getByText("estimation du secteur")).toBeInTheDocument();
    expect(analytics.trackEvent).toHaveBeenCalledWith("problem_selected", { pain_id: "outages" });
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it("the phone select switches pain too", () => {
    render(<ProblemPickerSection />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "queues" } });
    expect(screen.getByText("données US")).toBeInTheDocument();
  });

  it("the commissions button hands the 30 % platform rate to the home page's calculator", () => {
    render(<ProblemPickerSection />);
    const cta = screen.getByRole("link", { name: "Calculer mes commissions" });
    expect(cta).toHaveAttribute("href", "/?commission=30#calculator");
    fireEvent.click(cta);
    expect(analytics.trackEvent).toHaveBeenCalledWith("problem_cta_click", {
      pain_id: "commissions",
      cta: "calculator",
    });
  });

  it("en: the calculator link stays on the English home page", () => {
    mockLocale.value = "en";
    render(<ProblemPickerSection />);
    expect(screen.getByRole("link", { name: "Calculate my commissions" })).toHaveAttribute(
      "href",
      "/en?commission=30#calculator"
    );
  });

  it("commissions is sold as POS, never Free (online ordering is a POS feature)", () => {
    expect(PAINS.find((p) => p.id === "commissions")?.plans).toEqual(["POS"]);
    render(<ProblemPickerSection />);
    const panel = screen.getByRole("article");
    expect(within(panel).getByText("POS")).toBeInTheDocument();
    expect(within(panel).queryByText("Free")).toBeNull();
  });

  it("the stock button goes to the stock guide in the visitor's language", () => {
    mockLocale.value = "en";
    render(<ProblemPickerSection />);
    fireEvent.click(screen.getByRole("button", { name: "Accurate tracking" }));
    expect(screen.getByRole("link", { name: "See stock tracking" })).toHaveAttribute(
      "href",
      "/en/docs/stock-and-supplier-orders"
    );
  });
});

// ── Calculator ───────────────────────────────────────────────────────────────

describe("MarginCalculatorSection", () => {
  it("points to the comparison pages from beside its heading, in the visitor's language", () => {
    for (const [loc, href] of [
      ["fr", "/compare"],
      ["en", "/en/compare"],
      ["id", "/id/compare"],
    ] as const) {
      mockLocale.value = loc;
      const { unmount } = render(<MarginCalculatorSection preset={null} />);
      expect(
        screen.getByRole("link", { name: text(loc, "redesign.landing.calculator.compareLink") })
      ).toHaveAttribute("href", href);
      unmount();
    }
  });

  it("shows today's commissions and a saving for the default numbers, with its assumptions", () => {
    render(<MarginCalculatorSection preset={null} />);
    // 30 000 € × 25 % × 30 % = 2 250 € of commissions.
    expect(plain(screen.getByText(/Vous payez environ/).textContent)).toContain("2 250 €");
    expect(plain(screen.getByText(/Hypothèse/).textContent)).toContain("1,5 % + 0,25 €");
    expect(plain(screen.getByText(/Prix du forfait/).textContent)).toContain("13,99 €");
    expect(screen.getByText("Économie par mois")).toBeInTheDocument();
  });

  it("switches currency: amounts, plan prices and the result follow, with the currency's example figures", () => {
    render(<MarginCalculatorSection preset={null} />);
    fireEvent.click(screen.getByRole("radio", { name: /USD/ }));
    // 30 000 $ × 25 % × 30 % = 2 250 $ of commissions, and the POS plan at $14.99.
    expect(plain(screen.getByText(/Vous payez environ/).textContent)).toContain("2 250 $US");
    expect(plain(screen.getByText(/Prix du forfait/).textContent)).toContain("$14.99");
    expect(analytics.trackEvent).toHaveBeenCalledWith("calculator_currency", { currency: "USD" });

    fireEvent.click(screen.getByRole("radio", { name: /IDR/ }));
    const revenue = screen.getByLabelText(text("fr", "redesign.landing.calculator.revenue"));
    expect(revenue).toHaveValue(100_000_000);
  });

  it("fills the till fee from a competitor's public price and compares it with Epidom", () => {
    render(<MarginCalculatorSection preset={null} />);
    const picker = screen.getByLabelText(text("fr", "redesign.landing.calculator.currentPos"));
    // Moka is priced in rupiah: picking it moves the calculator to IDR.
    fireEvent.change(picker, { target: { value: "moka-premium" } });

    expect(screen.getByRole("radio", { name: /IDR/ })).toBeChecked();
    const fee = screen.getByLabelText(text("fr", "redesign.landing.calculator.currentPosFee"));
    expect(fee).toHaveValue(299_000);
    expect(fee).toHaveAccessibleDescription(/prix public de Moka Premium/);

    const till = screen.getByText(
      text("fr", "redesign.landing.calculator.tillTitle")
    ).parentElement!;
    expect(plain(till.textContent)).toContain("Moka Premium");
    // 299 000 − 229 000 = 70 000 less a month.
    expect(plain(till.textContent)).toContain("70 000 IDR de moins par mois");
    // Moka's comparison is written in Indonesian and English only.
    expect(within(till).getByRole("link")).toHaveAttribute("href", "/en/compare/moka");
    expect(analytics.trackEvent).toHaveBeenCalledWith("calculator_competitor", {
      competitor: "moka-premium",
    });
  });

  it("shows a yearly price as its monthly share", () => {
    mockLocale.value = "id";
    render(<MarginCalculatorSection preset={null} />);
    fireEvent.change(screen.getByLabelText(text("id", "redesign.landing.calculator.currentPos")), {
      target: { value: "qasir-pro" },
    });
    const fee = screen.getByLabelText(text("id", "redesign.landing.calculator.currentPosFee"));
    expect(fee).toHaveValue(58_250); // Rp 699.000 a year / 12
    expect(
      plain(
        fee.getAttribute("aria-describedby") &&
          document.getElementById(fee.getAttribute("aria-describedby")!)?.textContent
      )
    ).toMatch(/699\.000/);
  });

  it("a till with no public price keeps the fee for the visitor to type, and says so", () => {
    render(<MarginCalculatorSection preset={null} />);
    const fee = screen.getByLabelText(text("fr", "redesign.landing.calculator.currentPosFee"));
    fireEvent.change(fee, { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText(text("fr", "redesign.landing.calculator.currentPos")), {
      target: { value: "zelty" },
    });
    expect(fee).toHaveValue(120);
    expect(fee).toHaveAccessibleDescription(/aucun|pas trouvé de prix public pour Zelty/);
    expect(screen.getByRole("radio", { name: /EUR/ })).toBeChecked();
  });

  it("switching away from a till's currency unpicks it", () => {
    render(<MarginCalculatorSection preset={null} />);
    const picker = screen.getByLabelText(
      text("fr", "redesign.landing.calculator.currentPos")
    ) as HTMLSelectElement;
    fireEvent.change(picker, { target: { value: "innovorder-starter" } });
    expect(picker.value).toBe("innovorder-starter");
    fireEvent.click(screen.getByRole("radio", { name: /IDR/ }));
    expect(picker.value).toBe("");
  });

  it("says a negative result plainly and points to the free page", () => {
    render(<MarginCalculatorSection preset={null} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "0" } });
    expect(screen.getByText(/Epidom vous coûterait/)).toBeInTheDocument();
    expect(screen.queryByText("Économie par mois")).toBeNull();
    expect(screen.getByRole("link", { name: "Créer ma page gratuitement" })).toHaveAttribute(
      "href",
      "/register"
    );
    expect(analytics.trackEvent).toHaveBeenCalledWith("calculator_start");
  });

  it("offers only paid plans, and says why Free is not one", () => {
    render(<MarginCalculatorSection preset={null} />);
    const plans = screen.getByRole("group", {
      name: text("fr", "redesign.landing.calculator.plan"),
    });
    expect(within(plans).getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByText(/ne prend pas de commandes/)).toBeInTheDocument();
  });

  it("takes the commission preset from the problem picker", () => {
    const { rerender } = render(<MarginCalculatorSection preset={null} />);
    const rate = screen.getByLabelText(/Commission plateforme/) as HTMLInputElement;
    fireEvent.change(rate, { target: { value: "12" } });
    rerender(<MarginCalculatorSection preset={{ commission: 30, nonce: 1 }} />);
    expect(rate.value).toBe("30");
  });

  it("follows the visitor's currency: US dollars on the English site", () => {
    mockLocale.value = "en";
    render(<MarginCalculatorSection preset={null} />);
    expect(screen.getByText(/You pay about/).textContent).toContain("$2,250");
    expect(screen.getByText(/Assumption/).textContent).toContain("2.9% + $0.30");
  });
});

// ── Migration modal ──────────────────────────────────────────────────────────

describe("MigrationModal", () => {
  function answer(label: string | RegExp) {
    fireEvent.click(screen.getByRole("button", { name: label }));
  }

  it("asks where the business is first, the site language's market on top", () => {
    render(<MigrationModal open onClose={() => {}} />);
    expect(screen.getByText("Étape 1 sur 4")).toBeInTheDocument();
    const markets = within(screen.getByRole("group")).getAllByRole("button");
    expect(markets.map((b) => b.textContent)).toEqual(["France", "Indonésie", "Un autre pays"]);
  });

  it.each([
    ["France", ["Zelty", "L'Addition", "Lightspeed", "SumUp", "Tiller"]],
    ["Indonésie", ["Moka", "Majoo", "Pawoon", "ESB POS", "Qasir"]],
    ["Un autre pays", ["Square", "Toast", "Lightspeed", "Clover", "SumUp"]],
  ] as const)("%s lists that market's tills, then other and none", (market, tills) => {
    render(<MigrationModal open onClose={() => {}} />);
    answer(market);
    const options = within(screen.getByRole("group")).getAllByRole("button");
    expect(options.map((b) => b.textContent)).toEqual([...tills, "Autre caisse", "Pas de caisse"]);
  });

  it("fr: keep my till + online ordering, 1 outlet → POS trial, with the till kept", () => {
    render(<MigrationModal open onClose={() => {}} />);
    answer("France");
    answer("Zelty");
    // No "switch fully" on the French site until NF525 is settled.
    expect(screen.queryByRole("button", { name: "Passer entièrement à Epidom" }) !== null).toBe(
      NF525_SETTLED
    );
    answer("Garder ma caisse, ajouter la commande en ligne");
    answer("1");
    const result = screen.getByTestId("migration-result");
    expect(within(result).getAllByText("POS").length).toBeGreaterThan(0);
    expect(within(result).getByText("Votre caisse actuelle, telle quelle.")).toBeInTheDocument();
    expect(within(result).getByRole("link", { name: "Essai POS 14 jours" })).toHaveAttribute(
      "href",
      POS_TRIAL_REGISTER_HREF
    );
    expect(analytics.trackEvent).toHaveBeenCalledWith("migration_path_selected", {
      market: "fr",
      current_pos: "zelty",
      path: "A",
      outlets: "1",
    });
  });

  it("keep my till + margin says, on the card, what only works with Epidom sales", () => {
    render(<MigrationModal open onClose={() => {}} />);
    answer("France");
    answer("SumUp");
    answer("Garder ma caisse, suivre ma marge et mes recettes");
    answer("2 à 3");
    const result = screen.getByTestId("migration-result");
    expect(
      within(result).getByText(/saisissez les mouvements de stock à la main/)
    ).toBeInTheDocument();
    expect(
      within(result).getByRole("link", { name: "Voir le forfait Opérations" })
    ).toHaveAttribute("href", "/pricing#plans");
  });

  it.each([
    ["France", "Tiller", WHATSAPP_NUMBERS.fr.number],
    ["Indonésie", "Moka", WHATSAPP_NUMBERS.id.number],
  ] as const)("4+ outlets in %s goes to that market's WhatsApp", (market, till, number) => {
    render(<MigrationModal open onClose={() => {}} />);
    answer(market);
    answer(till);
    answer("Garder ma caisse, ajouter la commande en ligne");
    answer("4 et plus");
    const link = within(screen.getByTestId("migration-result")).getByRole("link", {
      name: "Parler sur WhatsApp",
    });
    expect(link).toHaveAttribute("href", `https://wa.me/${number}`);
  });

  it("the NF525 gate follows the business's country, not the site language", () => {
    mockLocale.value = "en";
    render(<MigrationModal open onClose={() => {}} />);
    answer("France");
    answer("Zelty");
    expect(screen.getByText("How do you want to start?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Switch fully to Epidom" }) !== null).toBe(
      NF525_SETTLED
    );
  });

  it("en: the full switch is offered, and 2-3 outlets explains the move to Operations", () => {
    mockLocale.value = "en";
    render(<MigrationModal open onClose={() => {}} />);
    answer("Another country");
    answer("No POS");
    answer("Run everything on Epidom, till included");
    answer("2 to 3");
    const result = screen.getByTestId("migration-result");
    expect(within(result).getByText(/The POS plan covers one outlet/)).toBeInTheDocument();
    expect(within(result).getByText(/Importing from a spreadsheet/)).toBeInTheDocument();
  });

  it("Back walks back a step; Escape and the 44px close button close it", () => {
    const onClose = vi.fn();
    render(<MigrationModal open onClose={onClose} />);
    answer("France");
    answer("Lightspeed");
    answer("Retour");
    expect(screen.getByText("Qu'utilisez-vous aujourd'hui ?")).toBeInTheDocument();
    answer("Retour");
    expect(screen.getByText("Où se trouve votre commerce ?")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    const close = screen.getByRole("button", { name: "Fermer" });
    expect(close.className).toMatch(/size-11/);
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("asks for no email", () => {
    render(<MigrationModal open onClose={() => {}} />);
    expect(screen.getByRole("dialog").querySelector("input")).toBeNull();
  });
});

// ── Pricing, spaces, final CTA ──────────────────────────────────────────────

describe("PricingSection", () => {
  it.each([
    ["fr", "13,99 €", "27,99 €", "0 €"],
    ["en", "$14.99", "$29.99", "$0"],
    ["id", "Rp 229k", "Rp 459k", "Rp 0"],
  ] as const)("%s: prices come from the shared price table", (loc, pos, ops, free) => {
    mockLocale.value = loc;
    render(<PricingSection />);
    for (const price of [pos, ops, free]) expect(screen.getByText(price)).toBeInTheDocument();
  });

  it("only POS carries the 'most popular' mark, and Free promises no ordering", () => {
    render(<PricingSection />);
    expect(screen.getAllByText(text("fr", "redesign.pricingPage.mostPopular"))).toHaveLength(1);
    const popular = screen.getByText(text("fr", "redesign.pricingPage.mostPopular")).closest("li");
    expect(popular).toHaveTextContent("POS");
    expect(screen.getByText("Votre vitrine et son QR code, pour toujours.")).toBeInTheDocument();
  });
});

describe("ThreeSpacesSection", () => {
  it("opens a no-login demo for each card in a new tab: the café's page, the till, the dashboard", () => {
    render(<ThreeSpacesSection exampleStorefrontSlug="le-petit-four" />);
    const demos = screen.getAllByRole("link", { name: /démo en direct/ });
    expect(demos.map((a) => a.getAttribute("href"))).toEqual([
      "/demo/phone-orders",
      "/demo/pos",
      "/demo/dashboard",
    ]);
    for (const a of demos) {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
    }
    // Step 1 says there is no login; steps 2 and 3 just offer the demo.
    expect(demos.map((a) => a.textContent)).toEqual([
      "Sans connexion, démo en direct →",
      "Ouvrir la démo en direct →",
      "Ouvrir la démo en direct →",
    ]);
    expect(analytics.trackEvent).not.toHaveBeenCalledWith("demo_open", expect.anything());
    fireEvent.click(demos[1]);
    expect(analytics.trackEvent).toHaveBeenCalledWith("demo_open", { target: "pos" });
  });

  it("badges each space with the plan it needs", () => {
    render(<ThreeSpacesSection exampleStorefrontSlug={null} />);
    for (const badge of ["Free", "POS", "Opérations"]) {
      expect(screen.getByText(badge)).toBeInTheDocument();
    }
    expect(
      screen.getByText(text("fr", "redesign.landing.spaces.storefrontShort"))
    ).toBeInTheDocument();
  });

  it("draws each card's picture in code (decorative, hidden from screen readers), not a screenshot", () => {
    mockLocale.value = "en";
    const { container } = render(<ThreeSpacesSection exampleStorefrontSlug={null} />);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(container.querySelectorAll("ol > li > [aria-hidden='true']")).toHaveLength(3);
  });
});

describe("PosTourSection", () => {
  const tabs = () => screen.getAllByRole("tab");

  it.each(["fr", "en", "id"] as const)("%s: every string it asks for exists", (loc) => {
    mockLocale.value = loc;
    const { container } = render(<PosTourSection />);
    expect(container.textContent).not.toContain("redesign.");
    expect(tabs()).toHaveLength(4);
  });

  it("opens on phone orders: its pitch is shown and only the visible screens are announced", () => {
    mockLocale.value = "en";
    render(<PosTourSection />);
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[0]).toHaveTextContent(text("en", "redesign.posTour.f1Tab"));
    expect(
      screen.getByText(text("en", onlinePaymentCopyKey("redesign.posTour.f1Body")))
    ).toBeInTheDocument();
    for (const shot of [PRODUCT_SCREENS.storefrontMenu, PRODUCT_SCREENS.storefrontCheckout]) {
      expect(screen.getByRole("img", { name: shot.alt.en })).toBeInTheDocument();
    }
    // The other features' screens stay mounted for an instant switch, hidden from screen readers.
    expect(screen.queryByRole("img", { name: PRODUCT_SCREENS.posCashier.alt.en })).toBeNull();
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", tabs()[0].id);
  });

  it("a tap opens that feature: its pitch and its screen, and stops the autoplay", () => {
    mockLocale.value = "en";
    render(<PosTourSection />);
    fireEvent.click(screen.getByRole("tab", { name: /One link, no app store/ }));
    expect(tabs()[3]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[0]).toHaveAttribute("aria-selected", "false");
    expect(
      screen.getByRole("img", { name: PRODUCT_SCREENS.posCashier.alt.en })
    ).toBeInTheDocument();
    expect(screen.getByText(text("en", "redesign.posTour.f4Body"))).toBeInTheDocument();
  });

  it("the progress line opens the next feature when it ends, and wraps round", () => {
    mockLocale.value = "en";
    const { container } = render(<PosTourSection />);
    fireEvent.animationEnd(container.querySelector("[style*='animation-duration']")!);
    expect(tabs()[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.click(tabs()[3]);
    // Picked by hand: nothing advances any more.
    expect(container.querySelector("[style*='animation-duration']")?.className).not.toMatch(
      /animate-\[epi-fill/
    );
  });

  it("finance shows just the report-tab strip, cropped so the capture's edge badge stays out", () => {
    mockLocale.value = "en";
    render(<PosTourSection />);
    fireEvent.click(tabs()[1]);
    const shot = screen.getByRole("img", { name: PRODUCT_SCREENS.backOfficeFinanceTabs.alt.en });
    // The crop box is a bit narrower than the file, so the image is drawn slightly wider than its card.
    expect(shot.getAttribute("style")).toMatch(/width:\s*1\d\d(\.\d+)?%/);
  });

  it("desktop: pinned and scroll-driven, no timer; picking a feature scrolls to it", () => {
    mockLocale.value = "en";
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("min-height: 640px"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    const { container } = render(<PosTourSection />);
    // The line follows the scroll (a CSS variable), it does not run on a timer.
    expect(screen.getByTestId("pos-tour-progress")).toBeInTheDocument();
    expect(container.querySelector("[style*='animation-duration']")).toBeNull();
    fireEvent.click(tabs()[3]);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("arrow keys, Home and End move between features (roving focus)", () => {
    render(<PosTourSection />);
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1]);
    fireEvent.keyDown(tabs()[0], { key: "ArrowUp" });
    expect(tabs()[3]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[3]).toHaveFocus();
    fireEvent.keyDown(tabs()[3], { key: "ArrowDown" });
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs()[0], { key: "End" });
    expect(tabs()[3]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs()[3], { key: "Home" });
    expect(tabs()[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[0]).toHaveFocus();
  });
});

describe("FinalCtaSection", () => {
  it("closes with the trial and WhatsApp, and no email field", () => {
    const { container } = render(<FinalCtaSection />);
    expect(screen.getByRole("link", { name: "Essai POS 14 jours" })).toHaveAttribute(
      "href",
      POS_TRIAL_REGISTER_HREF
    );
    expect(screen.getByRole("link", { name: "Parler sur WhatsApp" }).getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/33/
    );
    expect(container.querySelector("input")).toBeNull();
  });

  it("a WhatsApp tap is a Contact for Meta", () => {
    analytics.trackMetaPixelEvent.mockClear();
    render(<FinalCtaSection />);
    fireEvent.click(screen.getByRole("link", { name: "Parler sur WhatsApp" }));
    expect(analytics.trackMetaPixelEvent).toHaveBeenCalledWith("Contact", {
      content_name: "final_whatsapp",
    });
  });
});

// ── No Sources list (removed 11.10.2026) ─────────────────────────────────────

describe("Figures without the Sources list", () => {
  it.each(["fr", "en", "id"] as const)("%s: no footnote marker is left behind", (loc) => {
    mockLocale.value = loc;
    const { container } = render(
      <>
        <ProblemPickerSection />
        <MarginCalculatorSection preset={null} />
      </>
    );
    expect(container.querySelector('a[href^="#source-"]')).toBeNull();
    expect(container.textContent).not.toMatch(/\[\d+\]/);
  });

  it("every pain but 'apps' still shows its figure", () => {
    for (const pain of PAINS) expect(pain.hasNumber, pain.id).toBe(pain.id !== "apps");
  });
});

// ── What is Epidom used for ─────────────────────────────────────────────────

describe("UsesSection", () => {
  it("opens on Cafés with ONE card (a headline and three ticks), and switching the tab swaps it", () => {
    mockLocale.value = "en";
    render(<UsesSection />);
    expect(screen.getByRole("tab", { name: "Cafés" })).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getAllByRole("heading", { level: 3 })).toHaveLength(1);
    expect(within(panel).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText(en.redesign.landing.uses.cafe.card1)).toBeInTheDocument();
    expect(screen.getByText(en.redesign.landing.uses.cafe.card2)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Bakeries" }));
    expect(screen.getByRole("tab", { name: "Bakeries" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(en.redesign.landing.uses.bakery.card1)).toBeInTheDocument();
    expect(screen.queryByText(en.redesign.landing.uses.cafe.card1)).toBeNull();
  });

  it("offers the live demo in a new tab, and a link to the page of the visitor's language (or /products)", () => {
    mockLocale.value = "en";
    const { unmount } = render(<UsesSection />);
    const panel = within(screen.getByRole("tabpanel"));
    const demo = panel.getByRole("link", { name: /Open live demo/ });
    expect(demo).toHaveAttribute("href", "/demo/phone-orders");
    expect(demo).toHaveAttribute("target", "_blank");
    expect(panel.getByRole("link", { name: /See Phone Orders/ })).toHaveAttribute(
      "href",
      "/en/commission-free-online-ordering"
    );
    unmount();

    // French has no page for this group yet: it falls back to /products.
    mockLocale.value = "fr";
    render(<UsesSection />);
    expect(
      within(screen.getByRole("tabpanel")).getByRole("link", { name: /Voir la commande mobile/ })
    ).toHaveAttribute("href", expect.stringMatching(/^\/(products|[a-z-]+)$/));
  });

  it("falls back to the gradient when a kind's photo file is missing, and never leaves a broken image", () => {
    mockLocale.value = "en";
    render(<UsesSection />);
    const photo = document.querySelector<HTMLImageElement>("img[src='/images/uses/cafe.jpg']")!;
    expect(photo).not.toBeNull();
    fireEvent.error(photo);
    expect(photo.style.display).toBe("none");
  });
});

// ── One order, three steps ──────────────────────────────────────────────────

describe("ThreeSpacesSection: one order in three steps", () => {
  it.each(["fr", "en", "id"] as const)(
    "%s: an ordered list of three numbered steps, no missing string",
    (loc) => {
      mockLocale.value = loc;
      const { container } = render(<ThreeSpacesSection exampleStorefrontSlug={null} />);
      expect(container.textContent).not.toContain("redesign.");
      const steps = within(container.querySelector("ol")!).getAllByRole("listitem");
      expect(steps).toHaveLength(3);
      steps.forEach((step, i) => {
        expect(step).toHaveTextContent(
          text(loc, "redesign.landing.spaces.stepLabel").replace(
            "{n}",
            String(i + 1).padStart(2, "0")
          )
        );
      });
      expect(steps[1]).toHaveTextContent(text(loc, "redesign.landing.spaces.posShort"));
    }
  );

  it("ends on 'All running · Connect Claude MCP', linking to the connector page in the visitor's language", () => {
    for (const [loc, href] of [
      ["en", "/en/claude-connector-pos"],
      ["fr", "/connecteur-claude-caisse"],
      ["id", "/id/konektor-claude-kasir"],
    ] as const) {
      mockLocale.value = loc;
      const { container, unmount } = render(<ThreeSpacesSection exampleStorefrontSlug={null} />);
      expect(container.textContent).toContain(text(loc, "redesign.landing.spaces.allRunning"));
      expect(
        screen.getByRole("link", {
          name: new RegExp(text(loc, "redesign.landing.spaces.connectClaude")),
        })
      ).toHaveAttribute("href", href);
      unmount();
    }
  });
});
