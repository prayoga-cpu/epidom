import { describe, it, expect } from "vitest";
import type { Locale } from "@/components/lang/i18n-provider";
import { getBlogPosts } from "../content";
import { LANDING_SLUGS } from "@/features/marketing/landing/registry";
import type { BlogPost } from "../content";

const LOCALES: Locale[] = ["fr", "id", "en"];
const POSTS: Array<[string, BlogPost]> = LOCALES.flatMap((l) =>
  getBlogPosts(l).map((p) => [`${l}/${p.slug}`, p] as [string, BlogPost])
);

const textsOf = (p: BlogPost) => [
  p.title,
  p.description,
  ...p.blocks.flatMap((b) => (b.type === "list" ? b.items : [b.text])),
];

describe.each(POSTS)("blog post %s", (_, post) => {
  it("is a real article, not a stub", () => {
    const words = textsOf(post).join(" ").split(/\s+/).length;
    expect(words, `${post.slug}: ${words} words`).toBeGreaterThanOrEqual(800);
  });

  it("makes none of the claims the site must not make", () => {
    const all = textsOf(post).join("\n");
    expect(all).not.toMatch(
      /\b5[\s-]?min|en quelques minutes|dalam hitungan menit|in minutes\b|sekitar 5 menit/i
    );
    expect(all).not.toMatch(/NF\s?525|certifi[ée]|homologu|conforme (à la )?loi/i);
    expect(all).not.toMatch(
      /zéro commission sur (ce|le) lien|nol komisi lewat link|zero commission on orders through/i
    );
    expect(all).not.toMatch(/★|\d[.,]\d\s?\/\s?5/);
  });

  it("links only landing pages in its own language", () => {
    for (const slug of post.related ?? []) {
      expect(LANDING_SLUGS.get(slug)?.locale, `${post.slug} → ${slug}`).toBe(post.locale);
    }
  });

  it("has an ISO revision date no earlier than its publication", () => {
    if (!post.updated) return;
    expect(post.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(post.updated >= post.date).toBe(true);
  });

  if (post.locale === "fr") {
    it("uses French typography", () => {
      for (const text of textsOf(post)) expect(text, text.slice(0, 80)).not.toMatch(/ [:;?!]/);
    });
  }
});
