import type { ReactNode } from "react";

/**
 * Renders the small subset of inline Markdown that CHANGELOG.md actually uses,
 * as React nodes.
 *
 * Why not `dangerouslySetInnerHTML` with a markdown lib: these strings come out
 * of the `Release` table, which is populated from CHANGELOG.md by a build
 * script. That is trusted today, but "trusted today" is exactly how injection
 * sinks are born — building React elements is safe by construction and costs
 * nothing here, because the grammar is four rules wide.
 *
 * Supported, in precedence order:
 *   `code`            — matched FIRST so `**` inside a command is left alone
 *   [label](href)     — http/https/relative only; javascript: is dropped
 *   **bold**
 *   *em* / _em_
 *
 * Anything unmatched renders as literal text, so a stray asterisk degrades to
 * an asterisk rather than eating the rest of the line.
 */

type Segment =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "em"; text: string }
  | { kind: "link"; text: string; href: string };

const RULES: { kind: Segment["kind"]; re: RegExp }[] = [
  { kind: "code", re: /`([^`]+)`/ },
  { kind: "link", re: /\[([^\]]+)\]\(([^)\s]+)\)/ },
  { kind: "bold", re: /\*\*([^*]+)\*\*/ },
  { kind: "em", re: /(?:\*([^*\n]+)\*|_([^_\n]+)_)/ },
];

/** Block anything that is not http(s) or a same-origin path. */
function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  return null;
}

export function parseInlineMarkdown(input: string): Segment[] {
  const out: Segment[] = [];
  let rest = input;

  while (rest.length > 0) {
    let best: { index: number; length: number; segment: Segment } | null = null;

    for (const rule of RULES) {
      const match = rule.re.exec(rest);
      if (!match) continue;
      // Earliest match wins; ties break by RULES order, which is why `code`
      // is listed first.
      if (best !== null && match.index >= best.index) continue;

      const body = match[1] ?? match[2] ?? "";
      if (rule.kind === "link") {
        const href = safeHref(match[2] ?? "");
        // An unsafe href degrades to its visible label rather than vanishing.
        best = {
          index: match.index,
          length: match[0].length,
          segment: href
            ? { kind: "link", text: match[1] ?? "", href }
            : { kind: "text", text: match[1] ?? "" },
        };
      } else {
        best = {
          index: match.index,
          length: match[0].length,
          segment: { kind: rule.kind, text: body } as Segment,
        };
      }
    }

    if (!best) {
      out.push({ kind: "text", text: rest });
      break;
    }

    if (best.index > 0) out.push({ kind: "text", text: rest.slice(0, best.index) });
    out.push(best.segment);
    rest = rest.slice(best.index + best.length);
  }

  return out;
}

interface RichTextProps {
  children: string;
  /**
   * Emphasis colour for **bold**. Changelog entries are written as
   * "**Lead sentence.** supporting detail", so bold is doing the job of a
   * sub-heading and wants to sit brighter than the body around it.
   */
  strongClassName?: string;
  codeClassName?: string;
  linkClassName?: string;
}

export function RichText({
  children,
  strongClassName = "text-foreground font-semibold",
  codeClassName = "bg-muted text-foreground rounded px-1 py-0.5 font-mono text-[0.85em]",
  linkClassName = "text-primary underline underline-offset-2",
}: RichTextProps) {
  return (
    <>
      {parseInlineMarkdown(children).map((seg, i) => {
        switch (seg.kind) {
          case "bold":
            return (
              <strong key={i} className={strongClassName}>
                {seg.text}
              </strong>
            );
          case "em":
            return <em key={i}>{seg.text}</em>;
          case "code":
            // `break-all` (not `break-words`): these are shell commands and
            // file paths with no spaces to break on, and on a 375px screen an
            // unbreakable token is what pushes the whole page sideways.
            return (
              <code key={i} className={`${codeClassName} break-all`}>
                {seg.text}
              </code>
            );
          case "link":
            return (
              <a
                key={i}
                href={seg.href}
                className={linkClassName}
                {...(seg.href.startsWith("http")
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {seg.text}
              </a>
            );
          default:
            return <span key={i}>{seg.text}</span>;
        }
      })}
    </>
  );
}

/** Node-returning variant for surfaces that style with inline `style` props. */
export function renderInlineMarkdown(
  input: string,
  styles: { strong?: React.CSSProperties; code?: React.CSSProperties; link?: React.CSSProperties }
): ReactNode[] {
  return parseInlineMarkdown(input).map((seg, i) => {
    switch (seg.kind) {
      case "bold":
        return (
          <strong key={i} style={styles.strong}>
            {seg.text}
          </strong>
        );
      case "em":
        return <em key={i}>{seg.text}</em>;
      case "code":
        return (
          <code key={i} style={{ wordBreak: "break-all", ...styles.code }}>
            {seg.text}
          </code>
        );
      case "link":
        return (
          <a
            key={i}
            href={seg.href}
            style={styles.link}
            {...(seg.href.startsWith("http")
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {seg.text}
          </a>
        );
      default:
        return <span key={i}>{seg.text}</span>;
    }
  });
}
