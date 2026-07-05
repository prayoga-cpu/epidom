import type { Metadata } from "next";
import { changelogService } from "@/lib/services/changelog.service";
import { ChangelogView } from "@/features/marketing/changelog/changelog-view";

export const metadata: Metadata = {
  title: "Changelog — EPIDOM",
  description: "What's new in Epidom — product updates, fixes and improvements.",
};

export default async function ChangelogPage() {
  const releases = await changelogService.getReleases();
  return <ChangelogView releases={releases} />;
}
