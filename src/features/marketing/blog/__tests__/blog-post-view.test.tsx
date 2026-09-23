import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Locale } from "@/components/lang/i18n-provider";

const analytics = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/analytics", () => analytics);

import { BlogPostView } from "@/features/marketing/blog/components/blog-post-view";
import {
  getBlogPosts,
  getBlogPost,
  getAllBlogPostParams,
  type BlogPost,
} from "@/features/marketing/blog/content";

const LOCALES: Locale[] = ["fr", "id", "en"];

const POST: BlogPost = {
  slug: "sample-post",
  locale: "en",
  title: "A sample post title",
  description: "A sample description.",
  date: "2026-06-09",
  readMinutes: 6,
  category: "Direct sales",
  blocks: [{ type: "p", text: "Body paragraph." }],
};

// ── The blog CTA as it rendered before it became the shared ArticleCta ─────────
// Copied verbatim from blog-post-view.tsx at 5214e27. The refactor must not
// change a single attribute of this markup.
//
// One DELIBERATE difference from that copy: the fr title now has a non-breaking
// space before "?" (French typography; the docs CTA already did), so a snippet
// or a narrow screen cannot wrap the "?" onto its own line.
//
// A second DELIBERATE difference: the body no longer opens with "Five minutes." /
// "Cinq minutes." / "Lima menit.". How long setup takes was never measured, so the
// pinned body strings below were updated on purpose, not to make a test pass.
// Everything else is still byte-for-byte.
const LEGACY_CTA_COPY: Record<Locale, { title: string; body: string; button: string }> = {
  fr: {
    title: "Prêt à essayer ?",
    body: "Sans carte. Votre premier lien est gratuit pour toujours.",
    button: "Démarrer gratuitement →",
  },
  id: {
    title: "Siap mencoba?",
    body: "Tanpa kartu. Link pertamamu gratis selamanya.",
    button: "Mulai gratis →",
  },
  en: {
    title: "Ready to try it?",
    body: "No card. Your first link is free forever.",
    button: "Start free →",
  },
};

function LegacyBlogCta({ locale }: { locale: Locale }) {
  const copy = LEGACY_CTA_COPY[locale];
  return (
    <section
      style={{
        padding: "100px 24px",
        textAlign: "center",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg, transparent, rgba(217,174,59,0.04))",
      }}
    >
      <h2
        className="epi-display"
        style={{
          fontSize: "clamp(28px, 4.5vw, 48px)",
          margin: "0 0 16px",
          color: "var(--epi-cream-50)",
        }}
      >
        {copy.title}
      </h2>
      <p style={{ fontSize: 16, color: "rgba(251,249,228,0.55)", marginBottom: 32 }}>{copy.body}</p>
      <a
        href="/register"
        style={{
          display: "inline-flex",
          padding: "16px 36px",
          borderRadius: 999,
          background: "var(--epi-gold-500)",
          color: "var(--epi-navy-900)",
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textDecoration: "none",
          boxShadow: "0 12px 32px -10px rgba(217,174,59,0.65)",
        }}
      >
        {copy.button}
      </a>
    </section>
  );
}

/** The flex row that holds the avatar and the name/meta lines. */
function bylineOf(nameText: string): HTMLElement {
  return screen.getByText(nameText).parentElement!.parentElement as HTMLElement;
}

/** Click an anchor without letting jsdom attempt (and log) a real navigation. */
function clickWithoutNavigating(el: HTMLElement) {
  el.addEventListener("click", (e) => e.preventDefault(), { once: true });
  fireEvent.click(el);
}

describe("BlogPostView CTA (unchanged by the ArticleCta refactor)", () => {
  it.each(LOCALES)("%s: renders byte-identical markup to the pre-refactor CTA", (locale) => {
    const legacy = render(<LegacyBlogCta locale={locale} />);
    const legacyHtml = legacy.container.innerHTML;
    legacy.unmount();

    const { container } = render(<BlogPostView locale={locale} post={{ ...POST, locale }} />);

    // The CTA is the only <section>: the post itself is an <article>.
    const sections = container.querySelectorAll("section");
    expect(sections).toHaveLength(1);
    expect(sections[0].outerHTML).toBe(legacyHtml);
  });

  it.each(LOCALES)("%s: links to /register with the existing copy", (locale) => {
    render(<BlogPostView locale={locale} post={{ ...POST, locale }} />);
    const copy = LEGACY_CTA_COPY[locale];

    expect(screen.getByRole("heading", { level: 2, name: copy.title })).toBeInTheDocument();
    expect(screen.getByText(copy.body)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.button }).getAttribute("href")).toBe("/register");
  });

  it.each(LOCALES)(
    "%s: makes no setup-time claim (how long setup takes was never measured)",
    (locale) => {
      const { container } = render(<BlogPostView locale={locale} post={{ ...POST, locale }} />);

      const cta = container.querySelector("section")?.textContent ?? "";
      expect(cta).not.toMatch(/\b(5|five|cinq|lima)[-\s]?(min\b|minute|menit)/i);
    }
  );

  it("a click sends the blog cta_click event", () => {
    render(<BlogPostView locale="en" post={POST} />);

    clickWithoutNavigating(screen.getByRole("link", { name: LEGACY_CTA_COPY.en.button }));

    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith("cta_click", {
      event_category: "engagement",
      event_label: "blog_article_start_free",
    });
  });
});

describe("BlogPostView byline", () => {
  it.each([
    ["fr", "Équipe Epidom"],
    ["id", "Tim Epidom"],
    ["en", "Epidom Team"],
  ] as const)(
    "%s: a post without an author is credited to the team, avatar = brand mark",
    (locale, teamName) => {
      render(<BlogPostView locale={locale} post={{ ...POST, locale }} />);

      const byline = bylineOf(teamName);
      // The brand mark is an inline SVG; no portrait image is ever invented.
      expect(byline.querySelector("svg")).not.toBeNull();
      expect(byline.querySelector("img")).toBeNull();
    }
  );

  it("sits under the title and description, above the article body", () => {
    render(<BlogPostView locale="en" post={POST} />);

    const follows = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const byline = bylineOf("Epidom Team");

    expect(follows(screen.getByRole("heading", { level: 1 }), byline)).toBe(true);
    expect(follows(screen.getByText(POST.description), byline)).toBe(true);
    expect(follows(byline, screen.getByText("Body paragraph."))).toBe(true);
  });

  it("shows the publication date (as a <time>) and the reading time from the post data", () => {
    render(<BlogPostView locale="en" post={POST} />);

    const time = screen.getByText("June 9, 2026");
    expect(time.tagName).toBe("TIME");
    expect(time.getAttribute("datetime")).toBe("2026-06-09");
    expect(bylineOf("Epidom Team").textContent).toContain("6 min read");
  });

  it.each([
    ["fr", "juin", "6 min de lecture"],
    ["id", "Juni", "6 menit baca"],
  ] as const)("%s: date and reading time are localized", (locale, month, read) => {
    const post = { ...POST, locale };
    render(<BlogPostView locale={locale} post={post} />);

    const text = bylineOf(locale === "fr" ? "Équipe Epidom" : "Tim Epidom").textContent ?? "";
    expect(text).toContain(month);
    expect(text).toContain("2026");
    expect(text).toContain(read);
  });

  it("shows the date once: the line above the title carries the category only", () => {
    render(<BlogPostView locale="en" post={POST} />);

    expect(screen.getAllByText(/June 9, 2026/)).toHaveLength(1);
    expect(screen.getByText("Direct sales")).toBeInTheDocument();
  });

  it("a real author with a photo: renders the photo, name and role instead of the team + mark", () => {
    const post: BlogPost = {
      ...POST,
      author: {
        name: "Test Author",
        role: "Co-founder",
        photoSrc: "/images/authors/test-author.jpg",
      },
    };
    render(<BlogPostView locale="en" post={post} />);

    const img = screen.getByRole("img", { name: "Test Author" });
    expect(img.getAttribute("src")).toBe("/images/authors/test-author.jpg");

    const byline = bylineOf("Test Author");
    expect(byline.querySelector("svg")).toBeNull();
    expect(byline.textContent).toContain("Co-founder");
    // Date and reading time still come from the post.
    expect(byline.textContent).toContain("June 9, 2026");
    expect(byline.textContent).toContain("6 min read");
    expect(screen.queryByText("Epidom Team")).toBeNull();
  });

  it("a named author without a photo keeps the brand mark and shows no role when none is given", () => {
    const post: BlogPost = { ...POST, author: { name: "Test Author" } };
    render(<BlogPostView locale="en" post={post} />);

    const byline = bylineOf("Test Author");
    expect(byline.querySelector("svg")).not.toBeNull();
    expect(byline.querySelector("img")).toBeNull();
    // The meta line starts with the date, not a stray role separator.
    expect(screen.getByText("June 9, 2026").parentElement?.textContent).toBe(
      "June 9, 2026 · 6 min read"
    );
  });
});

describe("blog content contract (read by the sitemap and structured data)", () => {
  it("getAllBlogPostParams still returns one { locale, slug } per post, and each resolves", () => {
    const params = getAllBlogPostParams();
    const expected = LOCALES.reduce((n, l) => n + getBlogPosts(l).length, 0);

    expect(params).toHaveLength(expected);
    for (const p of params) {
      expect(Object.keys(p).sort()).toEqual(["locale", "slug"]);
      expect(getBlogPost(p.locale, p.slug)?.slug).toBe(p.slug);
    }
  });

  it("every post carries an ISO date-only `date` and a numeric `readMinutes` (the byline relies on both)", () => {
    for (const l of LOCALES) {
      for (const p of getBlogPosts(l)) {
        expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof p.readMinutes).toBe("number");
      }
    }
  });

  it("every real post renders with the team byline and the CTA", () => {
    for (const { locale, slug } of getAllBlogPostParams()) {
      const post = getBlogPost(locale, slug)!;
      const { container, unmount } = render(<BlogPostView locale={locale} post={post} />);

      expect(container.querySelectorAll("section")).toHaveLength(1);
      expect(container.querySelectorAll('a[href="/register"]')).toHaveLength(1);
      expect(container.querySelectorAll("time")).toHaveLength(1);
      unmount();
    }
  });
});
