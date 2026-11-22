/**
 * In-app Changelog Page
 *
 * Server-rendered release history for signed-in users. Gets the PageShell
 * chrome (sidebar + topbar) automatically from the (dashboard) layout.
 *
 * Renders a dashboard-native, theme-aware card list (shadcn Card) rather
 * than reusing the marketing ChangelogView: that view is styled with
 * hardcoded cream/gold colors that only read on the dark marketing page
 * and would be unreadable in the light dashboard theme. Both pages consume
 * the same data from changelogService.getReleases().
 *
 * The page only loads the data; the translated chrome (heading, tag labels,
 * dates) is rendered by the client component, which knows the visitor's language.
 */

import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { changelogService } from "@/lib/services/changelog.service";
import { StoreChangelogView } from "./store-changelog-view";

export default async function StoreChangelogPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const releases = await changelogService.getReleases();

  return <StoreChangelogView releases={releases} />;
}
