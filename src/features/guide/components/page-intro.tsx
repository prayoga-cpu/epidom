"use client";

import { useContext, useId, useState } from "react";
import Link from "next/link";
import { QueryClientContext } from "@tanstack/react-query";
import { ArrowRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import type { PageIntroId } from "@/lib/guide/contracts";
import { useGuideState } from "../hooks/use-guide-state";
import {
  PAGE_INTRO_GUIDES,
  helpPageHref,
  localizedGuideSlug,
  type HelpGuideId,
} from "../lib/help-guides";
// The sheet carries every guide in three languages: loaded on the first
// "Learn more" tap, not with every page that shows an intro, and a failed load
// (offline) ends in a toast, not the till's error screen.
import { LazyHelpSheet } from "./help-sheet-loader";

export interface PageIntroProps {
  id: PageIntroId;
  /** Defaults to `helpCenter.intros.<id>.title`. */
  title?: string;
  /** Defaults to `helpCenter.intros.<id>.body`. */
  body?: string;
  /**
   * The guide "Learn more" opens (its English slug). Defaults to the page's
   * guide in PAGE_INTRO_GUIDES; `null` hides the link.
   */
  learnMoreSlug?: HelpGuideId | null;
  /**
   * "card" for Back Office pages (under the page header; Learn more goes to the
   * Help page). "compact" for POS Mode (one slim line; Learn more opens the
   * guide in a sheet, so the till never leaves POS Mode).
   */
  variant?: "card" | "compact";
  /** Needed for Learn more; without it the link is left out. */
  storeId?: string;
  /** Outer spacing — applied only when the card shows, so a hidden card leaves no gap. */
  className?: string;
}

/**
 * A first-visit intro card: what this page is for, in two sentences, until the
 * viewer taps "Got it" (saved to their guide state, so it stays gone on every
 * device) or "Show page tips again" in Help brings it back.
 *
 * Renders nothing until the guide state has loaded, so a card the viewer
 * already dismissed never flashes in, and nothing when the server refused the
 * state (signed out). Safe in any tree: with no QueryClient above it (a test
 * harness rendering the host page) there is no state to read, so it stays out.
 */
export function PageIntro(props: PageIntroProps) {
  const queryClient = useContext(QueryClientContext);
  if (!queryClient) return null;
  return <PageIntroCard {...props} />;
}

function PageIntroCard({
  id,
  title,
  body,
  learnMoreSlug,
  variant = "card",
  storeId,
  className,
}: PageIntroProps) {
  const { t, locale } = useI18n();
  const guide = useGuideState();
  const titleId = useId();
  const [helpOpen, setHelpOpen] = useState(false);

  if (!guide.isReady || !guide.isAvailable || guide.isTipDismissed(id)) return null;

  const heading = title ?? t(`helpCenter.intros.${id}.title`);
  const text = body ?? t(`helpCenter.intros.${id}.body`);
  const guideSlug =
    learnMoreSlug === null ? null : (learnMoreSlug ?? PAGE_INTRO_GUIDES[id] ?? null);
  const canLearnMore = Boolean(guideSlug && storeId);
  const dismiss = () => guide.dismissTip(id);

  if (variant === "compact") {
    return (
      <section
        aria-labelledby={titleId}
        className={cn(
          "border-epi-gold-500/30 bg-epi-gold-500/5 flex flex-col gap-1 rounded-lg border px-3 py-1.5 sm:flex-row sm:items-center sm:gap-3",
          className
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-2.5 pt-1 sm:pt-0">
          <Lightbulb
            className="text-epi-gold-600 dark:text-epi-gold-400 mt-0.5 size-4 shrink-0"
            aria-hidden
          />
          <p className="min-w-0 text-sm leading-snug">
            <span id={titleId} className="text-foreground font-semibold">
              {heading}
            </span>{" "}
            <span className="text-muted-foreground">{text}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-1">
          {canLearnMore && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 px-3"
              onClick={() => setHelpOpen(true)}
            >
              {t("helpCenter.pageIntro.learnMore")}
            </Button>
          )}
          <Button type="button" size="sm" className="h-10 px-4" onClick={dismiss}>
            {t("helpCenter.pageIntro.gotIt")}
          </Button>
        </div>
        {canLearnMore && helpOpen && (
          <LazyHelpSheet
            storeId={storeId!}
            open={helpOpen}
            onOpenChange={setHelpOpen}
            initialGuideSlug={guideSlug}
          />
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "border-epi-gold-500/30 bg-epi-gold-500/5 rounded-xl border p-4 sm:p-5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className="bg-epi-gold-500/15 text-epi-gold-600 dark:text-epi-gold-400 flex size-10 shrink-0 items-center justify-center rounded-lg"
          aria-hidden
        >
          <Lightbulb className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-epi-gold-600 dark:text-epi-gold-400 text-[11px] font-semibold tracking-[0.14em] uppercase">
            {t("helpCenter.pageIntro.eyebrow")}
          </p>
          <h2 id={titleId} className="text-foreground mt-0.5 text-base font-semibold">
            {heading}
          </h2>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">{text}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" className="h-10 px-4" onClick={dismiss}>
              {t("helpCenter.pageIntro.gotIt")}
            </Button>
            {canLearnMore && (
              <Button asChild variant="ghost" size="sm" className="h-10 px-3">
                <Link href={helpPageHref(storeId!, localizedGuideSlug(guideSlug!, locale ?? "en"))}>
                  {t("helpCenter.pageIntro.learnMore")}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
