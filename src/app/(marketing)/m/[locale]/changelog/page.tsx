import { changelogService } from "@/lib/services/changelog.service";
import { ChangelogView } from "@/features/marketing/changelog/changelog-view";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";

export const generateMetadata = pageMetadata("changelog");

// Prerendered: the build syncs CHANGELOG.md into the Release table just before
// `next build` (scripts/sync-changelog.ts). Hourly refresh in case a row
// changes between deploys.
export const revalidate = 3600;

export default async function ChangelogPage() {
  const releases = await changelogService.getReleases();
  return <ChangelogView releases={releases} />;
}
