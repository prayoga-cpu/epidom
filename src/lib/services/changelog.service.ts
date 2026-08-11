import { prisma } from "@/lib/prisma";

/**
 * Changelog Service
 *
 * Business logic layer for the product changelog (release history).
 * Single-table feature - uses Prisma directly without a repository.
 *
 * The Release table is the DB-backed source of truth, synced from
 * CHANGELOG.md on build (see scripts/sync-changelog.ts).
 */

export type ReleaseTag = "feat" | "fix" | "infra" | "ux";

export interface ReleaseDTO {
  version: string;
  releasedAt: string; // ISO string
  tag: ReleaseTag;
  items: string[];
}

/**
 * Compare two `x.y.z` versions, newest first.
 *
 * Segments are compared numerically, so 2.64.0 correctly outranks 2.9.0 —
 * a plain string sort would not. Missing or non-numeric segments count as 0.
 */
function byVersionDesc(a: string, b: string): number {
  const left = a.split(".");
  const right = b.split(".");

  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (Number.parseInt(right[i], 10) || 0) - (Number.parseInt(left[i], 10) || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export class ChangelogService {
  /**
   * Get all releases, newest first.
   *
   * `releasedAt` is date-only (CHANGELOG.md headers carry no time), so a day
   * that shipped several releases leaves the DB sort with nothing to break the
   * tie and Postgres returns those rows in arbitrary order. Version number is
   * the real release sequence, so it decides ties — otherwise the newest
   * release can land halfway down the list instead of at the top.
   *
   * Maps the raw Release rows to a serializable DTO and safely coerces
   * the `entries` Json column into a string[] of bullet points.
   */
  async getReleases(): Promise<ReleaseDTO[]> {
    const releases = await prisma.release.findMany({
      orderBy: { releasedAt: "desc" },
    });

    releases.sort(
      (a, b) =>
        b.releasedAt.getTime() - a.releasedAt.getTime() || byVersionDesc(a.version, b.version)
    );

    return releases.map((release) => ({
      version: release.version,
      releasedAt: release.releasedAt.toISOString(),
      tag: release.tag as ReleaseTag,
      items: Array.isArray(release.entries)
        ? release.entries.filter((entry): entry is string => typeof entry === "string")
        : [],
    }));
  }
}

// Export singleton instance
export const changelogService = new ChangelogService();
