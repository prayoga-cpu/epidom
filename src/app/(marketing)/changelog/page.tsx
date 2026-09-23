import { changelogService } from "@/lib/services/changelog.service";
import { ChangelogView } from "@/features/marketing/changelog/changelog-view";
import { pageMetadata } from "@/features/marketing/seo/page-metadata";

export const generateMetadata = pageMetadata("changelog");

export default async function ChangelogPage() {
  const releases = await changelogService.getReleases();
  return <ChangelogView releases={releases} />;
}
