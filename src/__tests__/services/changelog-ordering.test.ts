import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock ───────────────────────────────────────────────────────────────
// var (not const/let) avoids TDZ when vi.mock factory is hoisted above declarations.

var prismaMock: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    release: {
      findMany: vi.fn(),
    },
  };
  return { prisma: prismaMock };
});

import { changelogService } from "@/lib/services/changelog.service";

function release(version: string, day: string) {
  return {
    id: `id-${version}`,
    version,
    releasedAt: new Date(`${day}T00:00:00Z`),
    tag: "fix",
    entries: [`${version} entry`],
    createdAt: new Date(`${day}T00:00:00Z`),
  };
}

describe("ChangelogService.getReleases ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("puts the newest release first when a day shipped several of them", async () => {
    // CHANGELOG.md headers are date-only, so every 2026-08-11 row has an
    // identical releasedAt and Postgres returns the tie in arbitrary order.
    prismaMock.release.findMany.mockResolvedValue([
      release("2.64.1", "2026-08-11"),
      release("2.53.0", "2026-08-11"),
      release("2.64.0", "2026-08-11"),
      release("2.58.0", "2026-08-11"),
      release("2.52.0", "2026-08-10"),
    ]);

    const result = await changelogService.getReleases();

    expect(result.map((r) => r.version)).toEqual([
      "2.64.1",
      "2.64.0",
      "2.58.0",
      "2.53.0",
      "2.52.0",
    ]);
  });

  it("compares version segments numerically, not as strings", async () => {
    // A plain string sort would rank "2.9.0" above "2.64.0" and "2.10.0".
    prismaMock.release.findMany.mockResolvedValue([
      release("2.9.0", "2026-08-11"),
      release("2.64.0", "2026-08-11"),
      release("2.10.0", "2026-08-11"),
    ]);

    const result = await changelogService.getReleases();

    expect(result.map((r) => r.version)).toEqual(["2.64.0", "2.10.0", "2.9.0"]);
  });

  it("keeps the release date as the primary sort", async () => {
    prismaMock.release.findMany.mockResolvedValue([
      release("2.40.0", "2026-08-09"),
      release("2.39.0", "2026-08-11"),
    ]);

    const result = await changelogService.getReleases();

    expect(result.map((r) => r.version)).toEqual(["2.39.0", "2.40.0"]);
  });
});
