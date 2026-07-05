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

export class ChangelogService {
  /**
   * Get all releases, newest first.
   *
   * Maps the raw Release rows to a serializable DTO and safely coerces
   * the `entries` Json column into a string[] of bullet points.
   */
  async getReleases(): Promise<ReleaseDTO[]> {
    const releases = await prisma.release.findMany({
      orderBy: { releasedAt: "desc" },
    });

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
