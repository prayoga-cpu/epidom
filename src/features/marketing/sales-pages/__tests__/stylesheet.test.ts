// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const DIR = join(process.cwd(), "public", "sales-pages");
const PAGES = readdirSync(DIR).filter((f) => f.endsWith(".html"));

/** How many `{` are still open at the end of the CSS (comments and strings ignored). */
function unclosedBlocks(css: string): number {
  const code = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
  let depth = 0;
  for (const ch of code) {
    if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
  }
  return depth;
}

// An unclosed block silently swallows every rule after it. Sales page 2 had
// `@media(max-width:760px){… .duo .phone,` cut off, so its newsletter and
// footer styles only ever applied on phones.
describe("sales page stylesheets", () => {
  it("finds the sales pages", () => {
    expect(PAGES.length).toBeGreaterThan(0);
  });

  it.each(PAGES)("%s closes every CSS block", (file) => {
    const html = readFileSync(join(DIR, file), "utf8");
    for (const [, css] of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      expect(unclosedBlocks(css)).toBe(0);
    }
  });
});
