"use client";

import { useId } from "react";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import type { Article } from "@/features/marketing/shared/content/article-types";
import { ArticleBody } from "@/features/marketing/shared/content/article-body";
import { HelpRowGroup } from "./help-rows";

function readTime(t: (key: string) => string, minutes: number): string {
  return t("helpCenter.guides.readMinutes").replace("{n}", String(minutes));
}

/** One guide in the list: category and read time, title, description. */
function GuideRow({ guide, onOpen }: { guide: Article; onOpen: (slug: string) => void }) {
  const { t } = useI18n();
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(guide.slug)}
        className="hover:bg-accent active:bg-accent flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left transition-colors"
      >
        <span
          className="bg-epi-gold-500/15 text-epi-gold-600 dark:text-epi-gold-400 mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg"
          aria-hidden
        >
          <BookOpen className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-muted-foreground block text-[11px] font-semibold tracking-wide uppercase">
            {guide.category} · {readTime(t, guide.readMinutes)}
          </span>
          <span className="text-foreground mt-0.5 block text-sm font-semibold">{guide.title}</span>
          <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-sm leading-snug">
            {guide.description}
          </span>
        </span>
        <ChevronRight className="text-muted-foreground mt-2 size-4 shrink-0" aria-hidden />
      </button>
    </li>
  );
}

/**
 * The guide list. With `featured` (POS Mode), those come first under their own
 * heading and the rest under "More guides"; otherwise one list.
 */
export function HelpGuideList({
  featured,
  rest,
  onOpen,
}: {
  featured: Article[];
  rest: Article[];
  onOpen: (slug: string) => void;
}) {
  const { t } = useI18n();

  if (featured.length === 0) {
    return (
      <HelpRowGroup label={t("helpCenter.guides.title")}>
        {rest.map((guide) => (
          <GuideRow key={guide.slug} guide={guide} onOpen={onOpen} />
        ))}
      </HelpRowGroup>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {t("helpCenter.guides.forTheTill")}
        </h3>
        <HelpRowGroup label={t("helpCenter.guides.forTheTill")}>
          {featured.map((guide) => (
            <GuideRow key={guide.slug} guide={guide} onOpen={onOpen} />
          ))}
        </HelpRowGroup>
      </div>
      {rest.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {t("helpCenter.guides.moreGuides")}
          </h3>
          <HelpRowGroup label={t("helpCenter.guides.moreGuides")}>
            {rest.map((guide) => (
              <GuideRow key={guide.slug} guide={guide} onOpen={onOpen} />
            ))}
          </HelpRowGroup>
        </div>
      )}
    </div>
  );
}

/**
 * One guide, read in place. ArticleBody is the public docs' renderer, styled
 * for the site's dark navy page (cream text, gold rules), so the article sits
 * on its own navy panel rather than on the dashboard's theme surface, where
 * cream-on-white would be unreadable. Its headings are capped for a sheet's
 * width; they're sized for a full-width page.
 */
export function HelpGuideArticle({ guide, onBack }: { guide: Article; onBack: () => void }) {
  const { t } = useI18n();
  const titleId = useId();
  const back = (
    <Button type="button" variant="ghost" size="sm" className="-ml-2 h-10 px-3" onClick={onBack}>
      <ArrowLeft className="size-4" aria-hidden />
      {t("helpCenter.guides.back")}
    </Button>
  );

  return (
    <article aria-labelledby={titleId} className="mx-auto w-full max-w-3xl space-y-3">
      {back}
      <div className="bg-epi-navy-900 text-epi-cream-50 rounded-2xl px-5 py-6 sm:px-8 sm:py-8">
        <p className="text-epi-gold-500 text-xs font-semibold tracking-[0.14em] uppercase">
          {guide.category} · {readTime(t, guide.readMinutes)}
        </p>
        <h2 id={titleId} className="mt-2 text-2xl leading-tight font-semibold sm:text-3xl">
          {guide.title}
        </h2>
        <p className="text-epi-cream-50/70 mt-2 text-sm leading-relaxed">{guide.description}</p>
        <div className="bg-epi-gold-500/40 my-6 h-px" aria-hidden />
        <div className="[&_h2]:text-xl! sm:[&_h2]:text-2xl! [&_li]:text-[15px]! [&_p]:text-[15px]!">
          <ArticleBody blocks={guide.blocks} />
        </div>
      </div>
      {back}
    </article>
  );
}
