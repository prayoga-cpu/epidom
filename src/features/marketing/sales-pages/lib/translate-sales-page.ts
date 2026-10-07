/**
 * Builds the English and Indonesian copies of a sales page from its French
 * original (public/sales-pages/sales-page-N.html) and a table of translations
 * (../translations/). Only text can change: the page is split into markup,
 * which is copied byte for byte (every tag, class, style rule and line of
 * script), and translatable pieces: text nodes, the attributes a person reads
 * (aria-label, alt, title, placeholder) and the strings inside inline scripts.
 * So a translation can never move the design.
 *
 * Run `tsx scripts/build-sales-pages.ts` after editing a French page or a
 * table; the test in ../__tests__ fails when a copy is out of date.
 */

export type TranslatedLocale = "en" | "id";

export interface SalesPageTranslation {
  locale: TranslatedLocale;
  /**
   * [French, translation]. The French side is a whole piece (one text node,
   * attribute value or script string), compared with whitespace collapsed
   * and entities decoded, so a normal space matches the page's non-breaking
   * ones. The translation is plain text: it is escaped for HTML here. In a
   * script string it is inserted as written, so it keeps any ${…} as is.
   * Either way it takes the place of the words only: the spaces around the
   * French piece stay, and the translation's own edge spaces are dropped.
   */
  pairs: ReadonlyArray<readonly [string, string]>;
  /** Pieces deliberately left as they are (brand and plan names, symbols). */
  keep: readonly string[];
}

export type Segment =
  | { kind: "raw"; value: string }
  | { kind: "text"; value: string }
  | { kind: "attr"; name: string; value: string }
  | { kind: "literal"; quote: string; value: string }
  | { kind: "lang"; value: string };

const TRANSLATABLE_ATTRS = new Set(["aria-label", "alt", "title", "placeholder"]);

/** Any letter in any script: a piece without one (prices, symbols, numbers) is not prose. */
const HAS_LETTER = /\p{L}/u;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** The comparison key for a piece: entities decoded, any run of spaces (incl. NBSP) as one. */
export function normalizePiece(value: string, kind: Segment["kind"] = "text"): string {
  const decoded = kind === "literal" ? value : decodeEntities(value);
  return decoded.replace(/[\s  ]+/g, " ").trim();
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}

/** Index just past the `>` closing the tag that starts at `start`, skipping quoted values. */
function tagEnd(src: string, start: number): number {
  let quote = "";
  for (let i = start + 1; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return i + 1;
    }
  }
  return src.length;
}

function splitTag(tag: string, out: Segment[]): void {
  const isHtml = /^<html[\s>]/i.test(tag);
  const attrRe = /(\s)([a-zA-Z_:][-a-zA-Z0-9_:.]*)(\s*=\s*)"([^"]*)"/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(tag))) {
    const name = m[2].toLowerCase();
    const isLang = isHtml && name === "lang";
    if (!isLang && !TRANSLATABLE_ATTRS.has(name)) continue;
    const valueStart = m.index + m[1].length + m[2].length + m[3].length + 1;
    out.push({ kind: "raw", value: tag.slice(last, valueStart) });
    out.push(isLang ? { kind: "lang", value: m[4] } : { kind: "attr", name, value: m[4] });
    last = valueStart + m[4].length;
  }
  out.push({ kind: "raw", value: tag.slice(last) });
}

/** Splits inline script code into code (raw) and string contents (literal). */
function splitScript(code: string, out: Segment[]): void {
  let raw = "";
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];
    if (ch === "/" && next === "/") {
      const end = code.indexOf("\n", i);
      const stop = end === -1 ? code.length : end;
      raw += code.slice(i, stop);
      i = stop;
    } else if (ch === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      const stop = end === -1 ? code.length : end + 2;
      raw += code.slice(i, stop);
      i = stop;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < code.length && code[j] !== ch) j += code[j] === "\\" ? 2 : 1;
      out.push({ kind: "raw", value: raw + ch });
      out.push({ kind: "literal", quote: ch, value: code.slice(i + 1, j) });
      raw = code[j] ?? "";
      i = j + 1;
    } else {
      raw += ch;
      i++;
    }
  }
  if (raw) out.push({ kind: "raw", value: raw });
}

/** Splits a page into segments whose values, joined, are the page again. */
export function segmentPage(src: string): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  while (i < src.length) {
    if (src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i);
      const stop = end === -1 ? src.length : end + 3;
      out.push({ kind: "raw", value: src.slice(i, stop) });
      i = stop;
    } else if (src[i] === "<" && /[a-zA-Z/!]/.test(src[i + 1] ?? "")) {
      const end = tagEnd(src, i);
      const tag = src.slice(i, end);
      if (tag[1] === "/" || tag[1] === "!") out.push({ kind: "raw", value: tag });
      else splitTag(tag, out);
      i = end;
      const name = /^<([a-zA-Z]+)/.exec(tag)?.[1]?.toLowerCase();
      if (name === "style" || name === "script") {
        const close = src.toLowerCase().indexOf(`</${name}`, end);
        const stop = close === -1 ? src.length : close;
        const body = src.slice(end, stop);
        if (name === "script") splitScript(body, out);
        else out.push({ kind: "raw", value: body });
        i = stop;
      }
    } else {
      let next = src.indexOf("<", i + 1);
      while (next !== -1 && !/[a-zA-Z/!]/.test(src[next + 1] ?? "")) next = src.indexOf("<", next + 1);
      const stop = next === -1 ? src.length : next;
      out.push({ kind: "text", value: src.slice(i, stop) });
      i = stop;
    }
  }
  return out;
}

type Piece = Extract<Segment, { kind: "text" | "attr" | "literal" }>;

const isPiece = (s: Segment): s is Piece =>
  s.kind === "text" || s.kind === "attr" || s.kind === "literal";

/** A number-format locale such as "fr-FR" in a script: it has to follow the page's language. */
const LOCALE_TAG = /^[a-z]{2}-[A-Z]{2}$/;

/**
 * Whether a piece is something a reader sees in French. Script strings are
 * mostly code ("hours", "input", "--pct"), so only those with a space (prose,
 * " h") or a locale tag count.
 */
function isProse(seg: Piece, key: string): boolean {
  if (seg.kind !== "literal") return HAS_LETTER.test(key);
  return (/\s/.test(seg.value) && HAS_LETTER.test(key)) || LOCALE_TAG.test(key);
}

/**
 * The pieces a person reads, in page order, once each: what a translation
 * table has to cover. A script string whose edges have spaces also shows them
 * (`raw`): they are kept around the translation, so it shouldn't add its own.
 */
export function listTranslatablePieces(
  src: string
): Array<{ kind: string; text: string; raw?: string }> {
  const seen = new Set<string>();
  const pieces: Array<{ kind: string; text: string; raw?: string }> = [];
  for (const seg of segmentPage(src)) {
    if (!isPiece(seg)) continue;
    const text = normalizePiece(seg.value, seg.kind);
    if (!isProse(seg, text) && !text.includes("€")) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    const kind = seg.kind === "attr" ? `attr:${seg.name}` : seg.kind;
    pieces.push(seg.kind === "literal" && seg.value !== text ? { kind, text, raw: seg.value } : { kind, text });
  }
  return pieces;
}

const TEMPLATE_EXPRESSION = /\$\{[^}]*\}/g;

export interface TranslateResult {
  html: string;
  problems: string[];
}

/** The translated page, plus everything that stops it from being complete and correct. */
export function translateSalesPage(src: string, translation: SalesPageTranslation): TranslateResult {
  const problems: string[] = [];
  const table = new Map<string, string>();
  for (const [from, to] of translation.pairs) {
    const key = normalizePiece(from);
    if (table.has(key)) problems.push(`duplicate pair: ${JSON.stringify(key)}`);
    table.set(key, to);
  }
  const keep = new Set(translation.keep.map((k) => normalizePiece(k)));
  const used = new Set<string>();
  let sawLang = false;

  const html = segmentPage(src)
    .map((seg) => {
      if (seg.kind === "raw") return seg.value;
      if (seg.kind === "lang") {
        sawLang = true;
        return translation.locale;
      }
      const key = normalizePiece(seg.value, seg.kind);
      // Script strings are matched as written: decoding would blur `\"` and `"`.
      const target = table.get(seg.kind === "literal" ? normalizePiece(seg.value, "text") : key);
      if (target === undefined) {
        if (key && !keep.has(key)) {
          if (isProse(seg, key)) problems.push(`untranslated ${seg.kind}: ${JSON.stringify(key)}`);
          else if (key.includes("€")) problems.push(`price still in euros: ${JSON.stringify(key)}`);
        }
        return seg.value;
      }
      used.add(seg.kind === "literal" ? normalizePiece(seg.value, "text") : key);
      if (target.includes("€")) problems.push(`translation still in euros: ${JSON.stringify(target)}`);
      // The translation replaces the words; the spaces around them stay the
      // French page's, since they sit against a tag or a `+ value +` in a
      // script ("Économisez " + n + " heures").
      const lead = /^\s*/.exec(seg.value)?.[0] ?? "";
      const trail = /\s*$/.exec(seg.value)?.[0] ?? "";
      const words = target.trim();
      if (seg.kind === "text") return lead + escapeText(words) + trail;
      if (seg.kind === "attr") return lead + escapeAttr(words) + trail;
      const before = (seg.value.match(TEMPLATE_EXPRESSION) ?? []).join("");
      const after = (words.match(TEMPLATE_EXPRESSION) ?? []).join("");
      if (before !== after) problems.push(`script string lost its \${…}: ${JSON.stringify(target)}`);
      const unescapedQuote = new RegExp(`(^|[^\\\\])\\${seg.quote}`);
      if (unescapedQuote.test(words)) problems.push(`script string breaks its quotes: ${JSON.stringify(target)}`);
      return lead + words + trail;
    })
    .join("");

  if (!sawLang) problems.push('no <html lang="…"> to set');
  for (const key of table.keys()) {
    if (!used.has(key)) problems.push(`pair matches nothing on the page: ${JSON.stringify(key)}`);
  }
  return { html, problems };
}
