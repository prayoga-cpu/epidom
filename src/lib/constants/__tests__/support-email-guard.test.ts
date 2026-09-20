// @vitest-environment node
/**
 * Guard: the public support inbox is written down in ONE place,
 * src/lib/constants/contact.ts. The address is a stand-in until a branded
 * epidom.fr mailbox exists, and the day it does, switching must be a one-line
 * change. Every hardcoded copy is a place that keeps mailing the old inbox
 * after that switch (and there were ~14 of them: footer, legal pages, emails,
 * structured data, locale strings).
 *
 * This fails when an `@prionation.io` address appears in source outside the
 * constants file and the short, justified allowlist below. Tests and fixtures
 * are not scanned: they may name an address to assert against it.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(__dirname, "..", "..", "..");
const REPO = join(SRC, "..");

/** `@prionation.io`, or its percent-encoded form inside a mailto/href. */
const ADDRESS = /(?:@|%40)prionation\.io/i;

/** The one file that is allowed to spell the addresses out. */
const CONSTANTS_FILE = "src/lib/constants/contact.ts";

/**
 * Allowed exceptions. Each one blanks a specific region of a specific file
 * before scanning, so an address anywhere else in that file still fails, and a
 * moved or deleted region fails too (a stale allowlist would hide a regression).
 */
const ALLOWLIST: ReadonlyArray<{ file: string; region: RegExp; why: string }> = [
  {
    file: "src/lib/services/email.service.ts",
    region: /const FEEDBACK_NOTIFICATION_RECIPIENTS = \[[\s\S]*?\];/,
    why:
      "Private routing of internal feedback alerts to named team inboxes (it lists founder@, " +
      "where the public inbox lists ceo@). Never shown to a customer, so it must not follow " +
      "the public support address when that changes.",
  },
];

/** Scan target: application source that ships, not tests, fixtures or type stubs of tests. */
function isScannedFile(path: string): boolean {
  if (!/\.tsx?$/.test(path)) return false;
  if (/\.(test|spec)\.tsx?$/.test(path)) return false;
  const parts = path.split("/");
  if (parts.includes("__tests__") || parts.includes("__mocks__")) return false;
  if (path.startsWith("src/test/")) return false;
  return path !== CONSTANTS_FILE;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Replace every non-newline character of `text` with a space, so line numbers survive. */
const blank = (text: string) => text.replace(/[^\n]/g, " ");

/** `path:line: <excerpt>` for every address in `source`, after blanking allowlisted regions. */
function findAddresses(source: string, path: string): string[] {
  let scanned = source;
  for (const rule of ALLOWLIST) {
    if (rule.file === path) scanned = scanned.replace(rule.region, blank);
  }
  const hits: string[] = [];
  scanned.split("\n").forEach((line, index) => {
    if (ADDRESS.test(line)) {
      hits.push(`${path}:${index + 1}: ${line.trim().slice(0, 120)}`);
    }
  });
  return hits;
}

describe("support email guard: the scanner itself", () => {
  it("catches a plain address, a mailto, a percent-encoded one and any casing", () => {
    expect(findAddresses(`const a = "cro@prionation.io";`, "x.ts")).toHaveLength(1);
    expect(
      findAddresses(`<a href="mailto:a@prionation.io,b@prionation.io">`, "x.tsx")
    ).toHaveLength(1);
    expect(findAddresses(`href="mailto:consult%40prionation.io"`, "x.tsx")).toHaveLength(1);
    expect(findAddresses(`"CEO@PRIONATION.IO"`, "x.ts")).toHaveLength(1);
  });

  it("reports the line number of each offending line", () => {
    const hits = findAddresses(
      `line one\nfoo@prionation.io\nline three\nbar@prionation.io`,
      "x.ts"
    );
    expect(hits.map((h) => h.split(":")[1])).toEqual(["2", "4"]);
  });

  it("does not mind the studio's website or its credit link", () => {
    expect(findAddresses(`href="https://www.prionation.io/en#engage"`, "x.tsx")).toEqual([]);
    expect(
      findAddresses(`<span>PRIONATION.io</span> parentOrganization: prionation.io`, "x.tsx")
    ).toEqual([]);
  });

  it("only allowlists the named region of the named file", () => {
    const file = "src/lib/services/email.service.ts";
    const allowed = `const FEEDBACK_NOTIFICATION_RECIPIENTS = [\n  "cro@prionation.io",\n];\n`;
    expect(findAddresses(allowed, file)).toEqual([]);
    // Same region text in another file is NOT allowed ...
    expect(findAddresses(allowed, "src/lib/other.ts")).toHaveLength(1);
    // ... and a second address in the allowlisted file is still caught.
    expect(
      findAddresses(`${allowed}const footer = "mailto:ceo@prionation.io";\n`, file)
    ).toHaveLength(1);
  });
});

describe("support email guard: the repository", () => {
  const files = walk(SRC)
    .map((full) => relative(REPO, full).split(sep).join("/"))
    .filter(isScannedFile);

  it("scans a realistic amount of source (the walk is not silently empty)", () => {
    expect(files.length).toBeGreaterThan(500);
    expect(files).toContain("src/proxy.ts");
    expect(files).toContain("src/lib/services/email.service.ts");
    expect(files).not.toContain(CONSTANTS_FILE);
  });

  it("every allowlist entry still points at real code (a stale entry would hide a regression)", () => {
    for (const rule of ALLOWLIST) {
      const source = readFileSync(join(REPO, rule.file), "utf8");
      expect(source, `${rule.file}: allowlisted region not found`).toMatch(rule.region);
      expect(rule.why.length).toBeGreaterThan(40);
    }
  });

  it("no @prionation.io address is hardcoded outside src/lib/constants/contact.ts", () => {
    const offenders = files.flatMap((file) =>
      findAddresses(readFileSync(join(REPO, file), "utf8"), file)
    );

    expect(
      offenders,
      "Import SUPPORT_MAILTO / SUPPORT_EMAIL_DISPLAY / SUPPORT_EMAIL_PRIMARY / supportMailto() " +
        "from @/lib/constants/contact instead of typing an address:\n" +
        offenders.join("\n")
    ).toEqual([]);
  });

  it("the constants file is where the addresses live", () => {
    const source = readFileSync(join(REPO, CONSTANTS_FILE), "utf8");
    expect(source).toMatch(ADDRESS);
  });
});
