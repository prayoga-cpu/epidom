import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("font declarations", () => {
  it("nothing imports geist/font/mono (it preloads; use geistMono from @/lib/fonts)", () => {
    const offenders = sourceFiles(join(process.cwd(), "src")).filter((file) =>
      /from\s+["']geist\/font\/mono["']/.test(readFileSync(file, "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});
