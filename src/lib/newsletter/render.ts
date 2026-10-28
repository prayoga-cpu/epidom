/**
 * Turns a campaign's content into the email each recipient receives. Pure
 * string work with no server imports, so the admin editor's preview renders
 * exactly what the send will.
 *
 * - "rich" content (the editor's HTML) gets the EPIDOM layout, and inline
 *   styles on every tag, since mail apps drop <style> blocks unevenly.
 * - "html" content (a pasted design) goes out as written.
 *
 * Both get the footer with the reader's own unsubscribe link, unless pasted
 * HTML places {{unsubscribe_url}} itself.
 */

export type NewsletterContentMode = "rich" | "html";

/** Where pasted HTML wants the reader's unsubscribe link. */
export const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";

type FooterLocale = "fr" | "en" | "id";

const FOOTER_COPY: Record<FooterLocale, { reason: string; unsubscribe: string }> = {
  fr: {
    reason:
      "Vous recevez cet e-mail car vous vous êtes inscrit(e) sur epidom.fr ou avez un compte Epidom.",
    unsubscribe: "Se désinscrire",
  },
  en: {
    reason:
      "You're receiving this email because you signed up on epidom.fr or have an Epidom account.",
    unsubscribe: "Unsubscribe",
  },
  id: {
    reason: "Anda menerima email ini karena mendaftar di epidom.fr atau memiliki akun Epidom.",
    unsubscribe: "Berhenti berlangganan",
  },
};

/** The language a recipient's footer (and unsubscribe page) is in: fr, id, else en. */
export function newsletterLocale(locale: string | null | undefined): FooterLocale {
  const base = (locale ?? "").slice(0, 2).toLowerCase();
  return base === "fr" || base === "id" ? base : "en";
}

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const TAG_STYLES: [tag: string, style: string][] = [
  ["p", "margin:0 0 16px;color:#333333;font-size:16px;line-height:1.6;"],
  ["h1", "margin:24px 0 12px;color:#111111;font-size:28px;line-height:1.3;font-weight:800;"],
  ["h2", "margin:24px 0 12px;color:#111111;font-size:22px;line-height:1.3;font-weight:700;"],
  ["h3", "margin:20px 0 8px;color:#111111;font-size:18px;line-height:1.4;font-weight:700;"],
  ["ul", "margin:0 0 16px;padding-left:24px;"],
  ["ol", "margin:0 0 16px;padding-left:24px;"],
  ["li", "margin:0 0 6px;color:#333333;font-size:16px;line-height:1.6;"],
  [
    "blockquote",
    "margin:0 0 16px;padding:4px 0 4px 16px;border-left:4px solid #dddddd;color:#555555;",
  ],
  ["hr", "border:none;border-top:1px solid #eeeeee;margin:24px 0;"],
  ["img", "display:block;max-width:100%;height:auto;margin:0 auto 16px;border-radius:8px;"],
  ["a", "color:#444444;text-decoration:underline;"],
  [
    "code",
    "font-family:Menlo,Consolas,monospace;background:#f5f5f5;padding:2px 4px;border-radius:4px;",
  ],
];

const BUTTON_STYLE =
  "display:inline-block;background-color:#444444;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;";

/** Put `style` in front of each `<tag …>`'s own style, so the tag's own declarations win. */
function styleTags(html: string, tag: string, style: string, onlyMatching?: RegExp): string {
  return html.replace(new RegExp(`<${tag}(\\s[^>]*)?>`, "gi"), (whole, attrs: string = "") => {
    if (onlyMatching && !onlyMatching.test(attrs)) return whole;
    const own = /\sstyle="([^"]*)"/i.exec(attrs);
    if (own) return `<${tag}${attrs.replace(own[0], ` style="${style}${own[1]}"`)}>`;
    return `<${tag} style="${style}"${attrs}>`;
  });
}

/** Inline email styles for the editor's HTML. Exported for tests. */
export function styleRichContent(html: string): string {
  let out = html
    // A paragraph inside a list item would add a paragraph's gap to every bullet.
    .replace(/<li>(\s*)<p>/gi, '<li>$1<p style="margin:0;">')
    // A paragraph holding only a button centers it.
    .replace(
      /<p>(\s*<a\s[^>]*data-variant="button"[^>]*>[\s\S]*?<\/a>\s*)<\/p>/gi,
      '<p style="text-align:center;margin:24px 0;">$1</p>'
    );
  out = styleTags(out, "a", BUTTON_STYLE, /data-variant="button"/i);
  for (const [tag, style] of TAG_STYLES) out = styleTags(out, tag, style);
  return out;
}

function stripScripts(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** True when the content has text or an image (the editor's empty state is `<p></p>`). */
export function hasNewsletterContent(html: string): boolean {
  if (/<img\b/i.test(html)) return true;
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim().length > 0
  );
}

function preheader(previewText: string | null | undefined): string {
  if (!previewText?.trim()) return "";
  // The filler keeps mail apps from pulling body text into the preview line.
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText.trim())}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>`;
}

function footer(locale: FooterLocale, unsubscribeUrl: string): string {
  const copy = FOOTER_COPY[locale];
  return `<div style="padding:24px 12px;text-align:center;color:#888888;font-family:${FONT_STACK};font-size:12px;line-height:1.6;">
  <p style="margin:0 0 8px;">${copy.reason}</p>
  <p style="margin:0;"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#888888;text-decoration:underline;">${copy.unsubscribe}</a> · <a href="https://epidom.fr" style="color:#888888;text-decoration:underline;">epidom.fr</a></p>
</div>`;
}

export interface RenderNewsletterInput {
  subject: string;
  previewText?: string | null;
  contentMode: NewsletterContentMode;
  contentHtml: string;
  /** The recipient's language, for the footer. */
  locale: string;
  unsubscribeUrl: string;
}

/** The complete HTML document one recipient receives. */
export function renderNewsletterEmail(input: RenderNewsletterInput): string {
  const locale = newsletterLocale(input.locale);
  const content = stripScripts(input.contentHtml);
  const hasPlaceholder = content.includes(UNSUBSCRIBE_PLACEHOLDER);
  const withLink = (html: string) =>
    html.split(UNSUBSCRIBE_PLACEHOLDER).join(escapeHtml(input.unsubscribeUrl));
  const foot = hasPlaceholder ? "" : footer(locale, input.unsubscribeUrl);

  if (input.contentMode === "html") {
    if (/<\/body>/i.test(content)) {
      const withFooter = content.replace(/<\/body>/i, `${foot}</body>`);
      return withLink(
        withFooter.replace(/<body([^>]*)>/i, `<body$1>${preheader(input.previewText)}`)
      );
    }
    return withLink(`<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:0;">${preheader(input.previewText)}${content}${foot}</body>
</html>`);
  }

  return withLink(`<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9f9f9;">
${preheader(input.previewText)}
<div style="font-family:${FONT_STACK};line-height:1.6;color:#333333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background-color:#444444;padding:32px;border-radius:12px 12px 0 0;text-align:center;">
    <div style="color:#ffffff;font-size:28px;letter-spacing:2px;font-weight:800;">EPIDOM</div>
  </div>
  <div style="background:#ffffff;padding:32px 28px;border:1px solid #eeeeee;border-top:none;border-radius:0 0 12px 12px;">
${styleRichContent(content)}
  </div>
  ${foot}
</div>
</body>
</html>`);
}
