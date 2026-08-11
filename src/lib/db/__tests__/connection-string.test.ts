import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  normalizeSslMode,
  toDirectEndpoint,
  databaseUrl,
  directDatabaseUrl,
  databaseIdentity,
} from "../connection-string";

const POOLED = "postgresql://user:pw@ep-x-pooler.region.aws.neon.tech/neondb";
const DIRECT = "postgresql://user:pw@ep-x.region.aws.neon.tech/neondb";

describe("normalizeSslMode", () => {
  it.each(["prefer", "require", "verify-ca"])(
    "rewrites the deprecated sslmode=%s to verify-full",
    (mode) => {
      expect(normalizeSslMode(`${POOLED}?sslmode=${mode}`)).toBe(`${POOLED}?sslmode=verify-full`);
    }
  );

  it("preserves surrounding query params and their order", () => {
    expect(normalizeSslMode(`${POOLED}?channel_binding=require&sslmode=require&foo=bar`)).toBe(
      `${POOLED}?channel_binding=require&sslmode=verify-full&foo=bar`
    );
  });

  it("does not mistake channel_binding=require for sslmode", () => {
    expect(normalizeSslMode(`${POOLED}?channel_binding=require`)).toBe(
      `${POOLED}?channel_binding=require`
    );
  });

  it("leaves an already-explicit verify-full untouched", () => {
    const url = `${POOLED}?sslmode=verify-full`;
    expect(normalizeSslMode(url)).toBe(url);
  });

  it("leaves a URL with no query string untouched", () => {
    expect(normalizeSslMode(POOLED)).toBe(POOLED);
  });

  it("leaves disable/allow untouched — those are not aliases for verify-full", () => {
    expect(normalizeSslMode(`${POOLED}?sslmode=disable`)).toBe(`${POOLED}?sslmode=disable`);
  });

  it("respects an explicit uselibpqcompat=true opt-in", () => {
    const url = `${POOLED}?uselibpqcompat=true&sslmode=require`;
    expect(normalizeSslMode(url)).toBe(url);
  });

  it("does not re-encode credentials", () => {
    const url = "postgresql://user:p%40ss%2Fword@host/db?sslmode=require";
    expect(normalizeSslMode(url)).toBe(
      "postgresql://user:p%40ss%2Fword@host/db?sslmode=verify-full"
    );
  });
});

describe("toDirectEndpoint", () => {
  it("drops Neon's -pooler host suffix", () => {
    expect(toDirectEndpoint(POOLED)).toBe(DIRECT);
  });

  it("is a no-op on an already-direct URL", () => {
    expect(toDirectEndpoint(DIRECT)).toBe(DIRECT);
  });
});

describe("databaseUrl / directDatabaseUrl", () => {
  const saved = { db: process.env.DATABASE_URL, direct: process.env.DIRECT_URL };

  beforeEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;
  });

  afterEach(() => {
    process.env.DATABASE_URL = saved.db;
    process.env.DIRECT_URL = saved.direct;
  });

  it("returns undefined rather than throwing when DATABASE_URL is unset", () => {
    expect(databaseUrl()).toBeUndefined();
    expect(directDatabaseUrl()).toBeUndefined();
  });

  it("normalizes the pooled runtime URL", () => {
    process.env.DATABASE_URL = `${POOLED}?sslmode=require`;
    expect(databaseUrl()).toBe(`${POOLED}?sslmode=verify-full`);
  });

  it("keeps the runtime URL pooled", () => {
    process.env.DATABASE_URL = `${POOLED}?sslmode=require`;
    expect(databaseUrl()).toContain("-pooler");
  });

  it("prefers DIRECT_URL when set", () => {
    process.env.DATABASE_URL = `${POOLED}?sslmode=require`;
    process.env.DIRECT_URL = `${DIRECT}?sslmode=require`;
    expect(directDatabaseUrl()).toBe(`${DIRECT}?sslmode=verify-full`);
  });

  it("derives the direct endpoint from a pooled URL when DIRECT_URL is unset", () => {
    process.env.DATABASE_URL = `${POOLED}?sslmode=require`;
    expect(directDatabaseUrl()).toBe(`${DIRECT}?sslmode=verify-full`);
  });
});

describe("databaseIdentity", () => {
  it("ignores credentials, query order and sslmode spelling", () => {
    expect(databaseIdentity(`${POOLED}?sslmode=require&channel_binding=require`)).toBe(
      databaseIdentity("postgresql://other:secret@ep-x-pooler.region.aws.neon.tech/neondb")
    );
  });

  it("distinguishes the pooled and direct endpoints", () => {
    expect(databaseIdentity(POOLED)).not.toBe(databaseIdentity(DIRECT));
  });

  it("distinguishes different databases on the same host", () => {
    expect(databaseIdentity(`${DIRECT}`)).not.toBe(
      databaseIdentity("postgresql://user:pw@ep-x.region.aws.neon.tech/other")
    );
  });

  it("returns null for an unparseable string", () => {
    expect(databaseIdentity("not a url")).toBeNull();
  });
});

/**
 * Guard: connection strings must be derived in exactly one place. Reading
 * DATABASE_URL/DIRECT_URL directly is how the sslmode warning and the duplicated
 * pooled-vs-direct logic spread across five files in the first place.
 */
describe("no direct process.env DB URL reads outside this module", () => {
  const repoRoot = resolve(__dirname, "../../../..");
  const SCAN_ROOTS = ["src", "scripts"];
  const EXTRA_FILES = ["prisma.config.ts"];
  const IGNORED_DIRS = new Set(["node_modules", ".next", "dist", "coverage"]);
  const ALLOWED = new Set([
    // The chokepoint itself.
    "src/lib/db/connection-string.ts",
    // This guard.
    "src/lib/db/__tests__/connection-string.test.ts",
    // Compares the target against the live URLs verbatim as a safety check.
    "scripts/restore-from-backup.ts",
  ]);

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (IGNORED_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(ts|tsx|mts|cts)$/.test(entry)) out.push(full);
    }
    return out;
  }

  it("routes every consumer through connection-string.ts", () => {
    const files = [
      ...SCAN_ROOTS.flatMap((root) => walk(join(repoRoot, root))),
      ...EXTRA_FILES.map((f) => join(repoRoot, f)),
    ];

    const offenders = files
      .map((file) => relative(repoRoot, file))
      .filter((rel) => !ALLOWED.has(rel))
      .filter((rel) =>
        /process\.env\.(DATABASE_URL|DIRECT_URL)/.test(readFileSync(join(repoRoot, rel), "utf8"))
      );

    expect(offenders).toEqual([]);
  });
});
