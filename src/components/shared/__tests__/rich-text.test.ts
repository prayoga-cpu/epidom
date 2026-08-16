import { describe, it, expect } from "vitest";
import { parseInlineMarkdown } from "../rich-text";

describe("parseInlineMarkdown", () => {
  it("renders plain text as a single segment", () => {
    expect(parseInlineMarkdown("just words")).toEqual([{ kind: "text", text: "just words" }]);
  });

  it("splits a bold lead from its supporting sentence", () => {
    // The shape every changelog entry actually uses.
    expect(parseInlineMarkdown("**Today's prep.** One tap to log it.")).toEqual([
      { kind: "bold", text: "Today's prep." },
      { kind: "text", text: " One tap to log it." },
    ]);
  });

  it("keeps ** inside a code span literal", () => {
    // Precedence matters: if bold were matched first, a command containing
    // asterisks would be silently mangled.
    expect(parseInlineMarkdown("run `a ** b` now")).toEqual([
      { kind: "text", text: "run " },
      { kind: "code", text: "a ** b" },
      { kind: "text", text: " now" },
    ]);
  });

  it("handles the real changelog line with a long command", () => {
    const segments = parseInlineMarkdown(
      "**Added a self-check.** Run `pnpm tsx --env-file=.env scripts/verify-stock-flow.ts`."
    );
    expect(segments[0]).toEqual({ kind: "bold", text: "Added a self-check." });
    expect(segments[2]).toEqual({
      kind: "code",
      text: "pnpm tsx --env-file=.env scripts/verify-stock-flow.ts",
    });
  });

  it("parses italics in both spellings", () => {
    expect(parseInlineMarkdown("*a* and _b_")).toEqual([
      { kind: "em", text: "a" },
      { kind: "text", text: " and " },
      { kind: "em", text: "b" },
    ]);
  });

  it("does not treat bold as two italics", () => {
    expect(parseInlineMarkdown("**x**")).toEqual([{ kind: "bold", text: "x" }]);
  });

  it("parses http and root-relative links", () => {
    expect(parseInlineMarkdown("[docs](https://example.com)")).toEqual([
      { kind: "link", text: "docs", href: "https://example.com" },
    ]);
    expect(parseInlineMarkdown("[here](/changelog)")).toEqual([
      { kind: "link", text: "here", href: "/changelog" },
    ]);
  });

  it("degrades an unsafe href to its visible label", () => {
    // Entries come from a build script today, but a javascript: URL must never
    // become an anchor regardless of how trusted the source currently is.
    //
    // Asserted as a property rather than an exact segment list: a URL
    // containing parentheses ends the href match early and leaves the extra
    // ")" as literal text. That cosmetic artifact is irrelevant — what matters
    // is that NO link segment is produced.
    for (const unsafe of [
      "[click](javascript:alert(1))",
      "[click](javascript:alert1)",
      "[x](//evil.test)", // protocol-relative leaves the origin
      "[y](data:text/html;base64,PHN2Zz4=)",
      "[z](vbscript:msgbox)",
    ]) {
      const segments = parseInlineMarkdown(unsafe);
      expect(segments.some((s) => s.kind === "link")).toBe(false);
      // The human-readable label survives, so the sentence still reads.
      expect(segments.some((s) => s.kind === "text" && /^(click|x|y|z)$/.test(s.text))).toBe(true);
    }
  });

  it("leaves an unmatched asterisk as literal text", () => {
    // A stray marker must not swallow the rest of the line.
    expect(parseInlineMarkdown("2 * 3 = 6")).toEqual([{ kind: "text", text: "2 * 3 = 6" }]);
  });

  it("leaves an unclosed bold marker literal", () => {
    expect(parseInlineMarkdown("**unclosed")).toEqual([{ kind: "text", text: "**unclosed" }]);
  });

  it("handles several markers in one line, in order", () => {
    expect(parseInlineMarkdown("**A** then `b` then [c](/d)")).toEqual([
      { kind: "bold", text: "A" },
      { kind: "text", text: " then " },
      { kind: "code", text: "b" },
      { kind: "text", text: " then " },
      { kind: "link", text: "c", href: "/d" },
    ]);
  });

  it("terminates on an empty string", () => {
    expect(parseInlineMarkdown("")).toEqual([]);
  });
});
