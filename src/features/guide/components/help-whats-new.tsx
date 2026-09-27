"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { RichText } from "@/components/shared/rich-text";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReleaseDTO, ReleaseTag } from "@/lib/services/changelog.service";
import type { ApiSuccessResponse } from "@/types/api/responses";
import { HELP_RELEASE_COUNT } from "../lib/help-guides";
import { HelpSection } from "./help-rows";

/** Bullets shown per release before "+N more". */
const ITEMS_PER_RELEASE = 2;

export const latestReleasesKey = ["public-changelog", "latest"] as const;

async function fetchLatestReleases(): Promise<ReleaseDTO[]> {
  const response = await fetch("/api/public/changelog");
  if (!response.ok) throw new Error(`Changelog request failed (${response.status})`);
  const body: ApiSuccessResponse<{ releases: ReleaseDTO[] }> = await response.json();
  return (body?.data?.releases ?? []).slice(0, HELP_RELEASE_COUNT);
}

const TAG_CLASS: Record<ReleaseTag, string> = {
  feat: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  fix: "bg-red-500/15 text-red-700 dark:text-red-300",
  infra: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  ux: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

/**
 * The latest releases. The Back Office Help page passes them in (read on the
 * server from changelogService); POS Mode's sheet has no server page of its
 * own, so it reads the public changelog endpoint instead.
 */
export function HelpWhatsNew({
  releases,
  changelogHref,
  onNavigate,
}: {
  /** Omitted: fetched from /api/public/changelog. */
  releases?: ReleaseDTO[];
  /** "See all updates" — left out when this viewer has no changelog page to open. */
  changelogHref: string | null;
  onNavigate?: () => void;
}) {
  const { t, intlLocale } = useI18n();
  const query = useQuery({
    queryKey: latestReleasesKey,
    queryFn: fetchLatestReleases,
    enabled: releases === undefined,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const list = (releases ?? query.data ?? []).slice(0, HELP_RELEASE_COUNT);
  const loading = releases === undefined && query.isPending;
  const failed = releases === undefined && query.isError;
  // Release notes come from CHANGELOG.md, which is written in English.
  const englishOnly = t("helpCenter.whatsNew.englishOnly");

  // releasedAt is a date with no time (midnight UTC): format it in UTC, or a
  // viewer west of Greenwich sees the day before.
  const dateFormat = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium", timeZone: "UTC" });

  return (
    <HelpSection
      title={t("helpCenter.whatsNew.title")}
      action={
        changelogHref ? (
          <Link
            href={changelogHref}
            onClick={onNavigate}
            className="text-primary inline-flex min-h-10 items-center gap-1 text-sm font-medium hover:underline"
          >
            {t("helpCenter.whatsNew.seeAll")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : undefined
      }
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : failed ? (
        <p className="text-muted-foreground bg-card rounded-xl border px-4 py-3 text-sm">
          {t("helpCenter.whatsNew.error")}
        </p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground bg-card rounded-xl border px-4 py-3 text-sm">
          {t("helpCenter.whatsNew.empty")}
        </p>
      ) : (
        <ol className="bg-card divide-y overflow-hidden rounded-xl border">
          {list.map((release) => {
            const extra = release.items.length - ITEMS_PER_RELEASE;
            return (
              <li key={release.version} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-foreground text-sm font-semibold">{release.version}</span>
                  <span className="text-muted-foreground text-xs">
                    {dateFormat.format(new Date(release.releasedAt))}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] uppercase ${TAG_CLASS[release.tag] ?? TAG_CLASS.feat}`}
                  >
                    {t(`helpCenter.whatsNew.tags.${release.tag}`)}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {release.items.slice(0, ITEMS_PER_RELEASE).map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span
                        className="bg-muted-foreground/60 mt-2 size-1.5 shrink-0 rounded-full"
                        aria-hidden
                      />
                      {/* min-w-0: one long token (a path, a command) must wrap, not widen the card. */}
                      <span className="text-muted-foreground line-clamp-3 min-w-0 flex-1 text-sm leading-relaxed break-words">
                        <RichText>{item}</RichText>
                      </span>
                    </li>
                  ))}
                </ul>
                {extra > 0 && (
                  <p className="text-muted-foreground text-xs">
                    {t("helpCenter.whatsNew.moreItems").replace("{count}", String(extra))}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {englishOnly && list.length > 0 && (
        <p className="text-muted-foreground text-xs">{englishOnly}</p>
      )}
    </HelpSection>
  );
}
