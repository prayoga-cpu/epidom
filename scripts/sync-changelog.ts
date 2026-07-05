/**
 * Sync CHANGELOG.md -> `Release` table.
 *
 * CHANGELOG.md is the source of truth; this upserts one row per release so the
 * public /changelog page, the in-app changelog, and the "What's new" bell read
 * from the DB. Runs in the build step (see package.json "build").
 *
 * Header format: `## [version] - YYYY-MM-DD · tag`  (tag = feat | fix | infra | ux)
 * Bullets: lines starting with `- `.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Prisma 7 requires a driver adapter (mirrors src/lib/prisma.ts).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface ParsedRelease {
  version: string;
  releasedAt: Date;
  tag: string;
  entries: string[];
}

const HEADER = /^##\s+\[([^\]]+)\]\s+-\s+(\d{4}-\d{2}-\d{2})\s+·\s+(\w+)\s*$/;

function parseChangelog(md: string): ParsedRelease[] {
  const releases: ParsedRelease[] = [];
  let current: ParsedRelease | null = null;

  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    const header = HEADER.exec(line);
    if (header) {
      if (current) releases.push(current);
      current = {
        version: header[1].trim(),
        releasedAt: new Date(`${header[2]}T00:00:00Z`),
        tag: header[3].trim(),
        entries: [],
      };
      continue;
    }
    if (current && line.startsWith("- ")) {
      current.entries.push(line.slice(2).trim());
    }
  }
  if (current) releases.push(current);
  return releases;
}

async function main() {
  const md = readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8");
  const releases = parseChangelog(md);

  if (releases.length === 0) {
    console.warn("[sync-changelog] no releases parsed from CHANGELOG.md — skipping");
    return;
  }

  for (const r of releases) {
    await prisma.release.upsert({
      where: { version: r.version },
      create: { version: r.version, releasedAt: r.releasedAt, tag: r.tag, entries: r.entries },
      update: { releasedAt: r.releasedAt, tag: r.tag, entries: r.entries },
    });
  }

  console.log(
    `[sync-changelog] synced ${releases.length} releases (latest ${releases[0].version})`
  );
}

main()
  .catch((e) => {
    console.error("[sync-changelog]", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
