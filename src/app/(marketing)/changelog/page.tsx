import { generateMetadata } from "@/lib/seo";
import { changelogService } from "@/lib/services/changelog.service";
import { ChangelogView } from "@/features/marketing/changelog/changelog-view";

export const metadata = generateMetadata({
  title: "Changelog — EPIDOM",
  description:
    "What's new in Epidom — product updates, fixes and improvements, shipped continuously.",
  canonical: "https://epidom.fr/changelog",
});

export default async function ChangelogPage() {
  const releases = await changelogService.getReleases();
  return <ChangelogView releases={releases} />;
}
