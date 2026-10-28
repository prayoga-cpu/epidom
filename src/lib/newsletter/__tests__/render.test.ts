import { describe, it, expect } from "vitest";
import {
  hasNewsletterContent,
  newsletterLocale,
  renderNewsletterEmail,
  styleRichContent,
} from "../render";

const base = {
  subject: "October news",
  previewText: null,
  contentMode: "rich" as const,
  contentHtml: "<p>Hello</p>",
  locale: "fr",
  unsubscribeUrl: "https://epidom.fr/newsletter/unsubscribe?t=abc&l=fr",
};

describe("styleRichContent", () => {
  it("inlines a style on every tag mail apps would otherwise leave bare", () => {
    const out = styleRichContent("<h2>Title</h2><p>Text <a href=\"https://x.fr\">link</a></p>");
    expect(out).toMatch(/<h2 style="[^"]*font-size:22px/);
    expect(out).toMatch(/<p style="[^"]*font-size:16px/);
    expect(out).toMatch(/<a style="color:#444444;text-decoration:underline;" href="https:\/\/x.fr">/);
  });

  it("turns a button link into a centered dark button", () => {
    const out = styleRichContent(
      '<p><a target="_blank" href="https://epidom.fr" data-variant="button">Try it</a></p>'
    );
    expect(out).toMatch(/<p style="[^"]*text-align:center;margin:24px 0;">/);
    expect(out).toMatch(/<a style="[^"]*background-color:#444444;color:#ffffff;[^"]*"/);
  });

  it("drops a list item's paragraph gap", () => {
    expect(styleRichContent("<ul><li><p>One</p></li></ul>")).toMatch(
      /<li style="[^"]*"><p style="[^"]*margin:0;">One/
    );
  });

  it("leaves look-alike tags alone", () => {
    expect(styleRichContent("<pre>x</pre><abbr>y</abbr>")).toBe("<pre>x</pre><abbr>y</abbr>");
  });
});

describe("renderNewsletterEmail", () => {
  it("wraps editor content in the EPIDOM layout with a footer in the reader's language", () => {
    const html = renderNewsletterEmail(base);
    expect(html).toContain("EPIDOM");
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain("Se désinscrire");
    expect(html).toContain('href="https://epidom.fr/newsletter/unsubscribe?t=abc&amp;l=fr"');
  });

  it("falls back to an English footer for a language it doesn't know", () => {
    expect(renderNewsletterEmail({ ...base, locale: "de" })).toContain("Unsubscribe");
    expect(renderNewsletterEmail({ ...base, locale: "id" })).toContain("Berhenti berlangganan");
  });

  it("adds the preview line hidden at the top", () => {
    const html = renderNewsletterEmail({ ...base, previewText: "Big news <inside>" });
    expect(html).toMatch(/<div style="display:none;[^"]*">Big news &lt;inside&gt;/);
  });

  it("strips scripts", () => {
    const html = renderNewsletterEmail({
      ...base,
      contentHtml: "<p>Hi</p><script>alert(1)</script>",
    });
    expect(html).not.toContain("<script");
  });

  it("sends pasted HTML as written, with the footer before </body>", () => {
    const html = renderNewsletterEmail({
      ...base,
      contentMode: "html",
      contentHtml: '<html><body style="background:red"><table><tr><td>Hi</td></tr></table></body></html>',
    });
    expect(html).toMatch(/<td>Hi<\/td><\/tr><\/table><div style="padding:24px 12px;[^"]*">[\s\S]*<\/div><\/body>/);
    expect(html).not.toContain("<td style=");
  });

  it("puts the link where pasted HTML asks for it, with no extra footer", () => {
    const html = renderNewsletterEmail({
      ...base,
      contentMode: "html",
      contentHtml: '<p><a href="{{unsubscribe_url}}">Stop</a></p>',
    });
    expect(html).toContain('<a href="https://epidom.fr/newsletter/unsubscribe?t=abc&amp;l=fr">Stop</a>');
    expect(html).not.toContain("Se désinscrire");
  });
});

describe("hasNewsletterContent", () => {
  it("treats the editor's empty paragraph as empty", () => {
    expect(hasNewsletterContent("<p></p>")).toBe(false);
    expect(hasNewsletterContent("<p>&nbsp;</p>")).toBe(false);
    expect(hasNewsletterContent("")).toBe(false);
  });

  it("counts text or an image", () => {
    expect(hasNewsletterContent("<p>Hi</p>")).toBe(true);
    expect(hasNewsletterContent('<img src="x.png">')).toBe(true);
  });
});

describe("newsletterLocale", () => {
  it("keeps fr and id, maps the rest to en", () => {
    expect(newsletterLocale("fr")).toBe("fr");
    expect(newsletterLocale("fr-FR")).toBe("fr");
    expect(newsletterLocale("id")).toBe("id");
    expect(newsletterLocale("en")).toBe("en");
    expect(newsletterLocale(null)).toBe("en");
  });
});
