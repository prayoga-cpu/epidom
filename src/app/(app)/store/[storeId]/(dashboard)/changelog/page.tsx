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
 */

import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { changelogService, type ReleaseTag } from "@/lib/services/changelog.service";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const TAG_META: Record<ReleaseTag, { label: string; className: string }> = {
  feat: { label: "Feature", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  fix: { label: "Fix", className: "bg-red-500/15 text-red-700 dark:text-red-300" },
  infra: { label: "Infra", className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
  ux: { label: "UX", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
};

function formatReleaseDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function StoreChangelogPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const releases = await changelogService.getReleases();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <p className="text-primary text-xs font-bold tracking-[0.18em] uppercase">Changelog</p>
        <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
          What's new in Epidom.
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Every improvement, fix, and new feature — shipped fast and documented here.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {releases.map((release) => {
          const tag = TAG_META[release.tag] ?? TAG_META.feat;
          return (
            <Card key={release.version}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-foreground text-sm font-bold tracking-tight">
                    {release.version}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatReleaseDate(release.releasedAt)}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] uppercase ${tag.className}`}
                  >
                    {tag.label}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3">
                  {release.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <span className="bg-muted-foreground/60 mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
                      <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
