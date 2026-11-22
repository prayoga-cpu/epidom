"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RichText } from "@/components/shared/rich-text";
import type { ReleaseDTO, ReleaseTag } from "@/lib/services/changelog.service";

const TAG_META: Record<ReleaseTag, { labelKey: string; className: string }> = {
  feat: {
    labelKey: "changelogPage.tagFeat",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  fix: {
    labelKey: "changelogPage.tagFix",
    className: "bg-red-500/15 text-red-700 dark:text-red-300",
  },
  infra: {
    labelKey: "changelogPage.tagInfra",
    className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  },
  ux: {
    labelKey: "changelogPage.tagUx",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
};

/**
 * Dashboard-native release list. The page itself is a server component (it
 * reads the session and the releases), so the chrome — heading, tag labels and
 * dates — lives here, where the visitor's language is available. The release
 * notes themselves are written in English.
 */
export function StoreChangelogView({ releases }: { releases: ReleaseDTO[] }) {
  const { t, intlLocale } = useI18n();

  const formatReleaseDate = (iso: string): string =>
    new Date(iso).toLocaleDateString(intlLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <p className="text-primary text-xs font-bold tracking-[0.18em] uppercase">
          {t("changelogPage.eyebrow")}
        </p>
        <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
          {t("changelogPage.title")}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">{t("changelogPage.subtitle")}</p>
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
                    {t(tag.labelKey)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3">
                  {release.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <span className="bg-muted-foreground/60 mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
                      {/* min-w-0 is load-bearing: a flex child defaults to
                          min-width:auto and refuses to shrink below its content,
                          so one unbreakable token (a shell command, a path)
                          pushes the whole row past the card instead of wrapping.
                          break-words handles the ordinary long-word case. */}
                      <span className="text-muted-foreground min-w-0 flex-1 text-sm leading-relaxed break-words">
                        <RichText>{item}</RichText>
                      </span>
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
