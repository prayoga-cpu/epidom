import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Locale } from "@/components/lang/i18n-provider";

const analytics = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/analytics", () => analytics);

import { DocsGuideView } from "@/features/marketing/docs/components/docs-guide-view";
import { DocsList } from "@/features/marketing/docs/components/docs-list";
import { getDocsGuides, getDocsGuide, getAllDocsParams } from "@/features/marketing/docs/content";

const LOCALES: Locale[] = ["fr", "id", "en"];

// Matched with a plain space: testing-library normalises the nbsp in the fr title
// (its exact character is asserted separately below).
const CTA_TITLE: Record<Locale, string> = {
  fr: "Prêt à essayer vous-même ?",
  id: "Siap mencoba sendiri?",
  en: "Ready to try this yourself?",
};
const CTA_BUTTON: Record<Locale, string> = {
  fr: "Démarrer gratuitement →",
  id: "Mulai gratis →",
  en: "Start free →",
};

/** Click an anchor without letting jsdom attempt (and log) a real navigation. */
function clickWithoutNavigating(el: HTMLElement) {
  el.addEventListener("click", (e) => e.preventDefault(), { once: true });
  fireEvent.click(el);
}

describe("DocsGuideView end-of-article CTA", () => {
  it.each(LOCALES)("%s: shows the CTA title and a Start-free link to /register", (locale) => {
    const guide = getDocsGuides(locale)[0];
    render(<DocsGuideView locale={locale} guide={guide} />);

    expect(screen.getByText(CTA_TITLE[locale])).toBeInTheDocument();
    const link = screen.getByRole("link", { name: CTA_BUTTON[locale] });
    expect(link.getAttribute("href")).toBe("/register");
  });

  it("fr: the question mark is preceded by a non-breaking space", () => {
    render(<DocsGuideView locale="fr" guide={getDocsGuides("fr")[0]} />);
    const title = screen.getByText(CTA_TITLE.fr);
    expect(title.textContent).toBe("Prêt à essayer vous-même\u00a0?");
  });

  it.each(LOCALES)(
    "%s: every guide ends with exactly one CTA, with or without a next guide",
    (locale) => {
      const guides = getDocsGuides(locale);
      expect(guides.length).toBeGreaterThan(0);

      guides.forEach((guide, i) => {
        const { container, unmount } = render(
          <DocsGuideView locale={locale} guide={guide} nextGuide={guides[i + 1]} />
        );
        expect(container.querySelectorAll("aside")).toHaveLength(1);
        expect(container.querySelectorAll('a[href="/register"]')).toHaveLength(1);
        unmount();
      });
    }
  );

  it("sits after the article body and before the Next link", () => {
    const guides = getDocsGuides("en");
    const { container } = render(
      <DocsGuideView locale="en" guide={guides[0]} nextGuide={guides[1]} />
    );

    const aside = container.querySelector("aside") as HTMLElement;
    const nextLink = screen.getByRole("link", { name: new RegExp(guides[1].title) });

    // Text of the very last block of the guide (a paragraph, or the last list item).
    const last = guides[0].blocks[guides[0].blocks.length - 1];
    const lastText = last.type === "list" ? last.items[last.items.length - 1] : last.text;
    const lastBlockEl = screen.getByText(lastText);

    const follows = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(lastBlockEl, aside)).toBe(true);
    expect(follows(aside, nextLink)).toBe(true);
    // Not nested in the article body: only the CTA's own text lives in the aside.
    expect(aside.contains(lastBlockEl)).toBe(false);
  });

  it("a click sends the docs cta_click event", () => {
    render(<DocsGuideView locale="en" guide={getDocsGuides("en")[0]} />);

    clickWithoutNavigating(screen.getByRole("link", { name: CTA_BUTTON.en }));

    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith("cta_click", {
      event_category: "engagement",
      event_label: "docs_article_start_free",
    });
  });

  it("keeps the back link and the next-guide link", () => {
    const guides = getDocsGuides("en");
    render(<DocsGuideView locale="en" guide={guides[0]} nextGuide={guides[1]} />);

    expect(screen.getByRole("link", { name: "← All guides" }).getAttribute("href")).toBe(
      "/en/docs"
    );
    expect(
      screen.getByRole("link", { name: new RegExp(guides[1].title) }).getAttribute("href")
    ).toBe(`/en/docs/${guides[1].slug}`);
  });
});

describe("DocsList (docs index)", () => {
  it.each(LOCALES)("%s: has no end-of-article CTA", (locale) => {
    const { container } = render(<DocsList locale={locale} guides={getDocsGuides(locale)} />);

    expect(container.querySelector("aside")).toBeNull();
    expect(container.querySelector('a[href="/register"]')).toBeNull();
    expect(screen.queryByText(CTA_TITLE[locale])).toBeNull();
    expect(screen.queryByText(CTA_BUTTON[locale])).toBeNull();
  });
});

describe("docs content contract (read by the sitemap)", () => {
  it("getAllDocsParams still returns one { locale, slug } per guide, and each resolves", () => {
    const params = getAllDocsParams();
    const expected = LOCALES.reduce((n, l) => n + getDocsGuides(l).length, 0);

    expect(params).toHaveLength(expected);
    for (const p of params) {
      expect(Object.keys(p).sort()).toEqual(["locale", "slug"]);
      expect(getDocsGuide(p.locale, p.slug)?.slug).toBe(p.slug);
    }
  });

  it("every guide carries an ISO date-only `date` string", () => {
    for (const l of LOCALES) {
      for (const g of getDocsGuides(l)) {
        expect(g.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});
