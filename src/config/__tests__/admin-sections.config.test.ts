import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import {
  ADMIN_SECTIONS,
  ADMIN_SECTION_KEYS,
  GRANTABLE_ADMIN_SECTION_KEYS,
} from "../admin-sections.config";

const ADMIN_DIR = join(process.cwd(), "src/app/(app)/admin");

/** Every page.tsx under the admin route group, as "/admin/…" paths. */
function adminPages(dir = ADMIN_DIR, base = "/admin"): { href: string; file: string }[] {
  const out: { href: string; file: string }[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...adminPages(full, `${base}/${entry}`));
    else if (entry === "page.tsx") out.push({ href: base, file: full });
  }
  return out;
}

describe("admin sections", () => {
  it("lists each key once, with a unique page", () => {
    expect(new Set(ADMIN_SECTIONS.map((s) => s.key)).size).toBe(ADMIN_SECTIONS.length);
    expect(new Set(ADMIN_SECTIONS.map((s) => s.href)).size).toBe(ADMIN_SECTIONS.length);
    expect(ADMIN_SECTIONS.map((s) => s.key).sort()).toEqual([...ADMIN_SECTION_KEYS].sort());
  });

  it("never lets the users list or the activity log be granted", () => {
    expect(GRANTABLE_ADMIN_SECTION_KEYS).not.toContain("users");
    expect(GRANTABLE_ADMIN_SECTION_KEYS).not.toContain("activity");
    expect(GRANTABLE_ADMIN_SECTION_KEYS).not.toContain("my-referrals");
  });

  it("every admin page is in the registry and checks its own section", () => {
    for (const { href, file } of adminPages()) {
      // A detail page (/admin/partners/[id]) belongs to its parent's section.
      const sectionHref = href.replace(/\/\[[^/]+\]$/, "");
      const section = ADMIN_SECTIONS.find((s) => s.href === sectionHref);
      expect(section, `${href} has no entry in ADMIN_SECTIONS`).toBeDefined();
      const source = readFileSync(file, "utf8");
      const guarded =
        source.includes(`requireAdminSection("${section!.key}")`) ||
        (section!.key === "my-referrals" && source.includes("requirePartnerPage("));
      expect(guarded, `${href} must call requireAdminSection("${section!.key}")`).toBe(true);
    }
  });
});
