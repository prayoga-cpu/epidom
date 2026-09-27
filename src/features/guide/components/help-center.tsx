"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Lightbulb, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { useI18n, type Locale } from "@/components/lang/i18n-provider";
import type { ReleaseDTO } from "@/lib/services/changelog.service";
import { useGuideState } from "../hooks/use-guide-state";
import { HELP_GUIDE_PARAM, OPEN_TOUR_EVENT, checklistHref, tourHref } from "../lib/help-guides";
import { orderHelpGuides, resolveHelpGuide } from "../lib/help-guide-content";
import { HelpActionRow, HelpRowGroup, HelpSection } from "./help-rows";
import { HelpGuideArticle, HelpGuideList } from "./help-guide-reader";
import { HelpWhatsNew } from "./help-whats-new";
import { HelpContact } from "./help-contact";

export interface HelpCenterProps {
  /** "backoffice": the full /store/[id]/help page. "pos": inside POS Mode's Help sheet. */
  context: "backoffice" | "pos";
  storeId: string;
  /**
   * The owner, or an OWNER/MANAGER persona of this store: shows "Open the
   * setup checklist" (the checklist API answers only them) and, in POS Mode,
   * "Replay the welcome tour" (both live on the Back Office dashboard).
   */
  canManage?: boolean;
  /**
   * Whether this viewer can open the Back Office dashboard, where the tour and
   * the checklist live. Defaults to true in the Back Office, `canManage` in POS.
   */
  canOpenDashboard?: boolean;
  /** Latest releases, read on the server. Omitted: fetched from /api/public/changelog. */
  releases?: ReleaseDTO[];
  /** Open on this guide (`?guide=` on the Help page, a page intro's Learn more). Any language's slug. */
  initialGuideSlug?: string | null;
  /** Called when a row navigates away or opens the tour — the sheet closes itself. */
  onNavigate?: () => void;
}

/**
 * The in-app Help centre: getting-started shortcuts (replay the welcome tour,
 * the setup checklist, bring page tips back), the docs guides in a reader
 * that never leaves the app, the latest releases, and how to reach the team.
 *
 * A full page in the Back Office; a single column in POS Mode's sheet, where
 * the guides for the till come first.
 */
export function HelpCenter({
  context,
  storeId,
  canManage = false,
  canOpenDashboard,
  releases,
  initialGuideSlug = null,
  onNavigate,
}: HelpCenterProps) {
  const { t, locale } = useI18n();
  const lang: Locale = locale ?? "en";
  const router = useRouter();
  const guideState = useGuideState();
  const rootRef = useRef<HTMLDivElement>(null);

  const [openSlug, setOpenSlug] = useState<string | null>(initialGuideSlug);
  const openGuide = openSlug ? resolveHelpGuide(lang, openSlug) : undefined;
  const { featured, rest } = useMemo(() => orderHelpGuides(lang, context), [lang, context]);

  const dashboardReachable = canOpenDashboard ?? (context === "backoffice" ? true : canManage);
  const showTour = dashboardReachable;
  const showChecklist = canManage && dashboardReachable;
  const hiddenTips = guideState.state.dismissedTips.length;

  // Keeps ?guide= on the Help page in step with the reader, so an open guide
  // can be reloaded or shared. Replace, not push: Back leaves Help as it came.
  // In POS Mode's sheet the URL belongs to the till page underneath — untouched.
  const syncUrl = useCallback(
    (slug: string | null) => {
      if (context !== "backoffice") return;
      const url = new URL(window.location.href);
      if (slug) url.searchParams.set(HELP_GUIDE_PARAM, slug);
      else url.searchParams.delete(HELP_GUIDE_PARAM);
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    },
    [context]
  );

  // Opening or closing a guide swaps the whole view: start it from the top,
  // not wherever the list was scrolled to.
  const lastSlug = useRef(openSlug);
  useEffect(() => {
    if (lastSlug.current === openSlug) return;
    lastSlug.current = openSlug;
    rootRef.current?.scrollIntoView?.({ block: "start" });
  }, [openSlug]);

  const showGuide = (slug: string) => {
    setOpenSlug(slug);
    syncUrl(slug);
  };
  const backToGuides = () => {
    setOpenSlug(null);
    syncUrl(null);
  };

  const replayTour = () => {
    onNavigate?.();
    // A tour mounted on this page (the dashboard's) claims the event and opens
    // in place. Anywhere else — or while it isn't mounted — go to the dashboard
    // and ask for it there: ?tour=1 opens it even when it was seen.
    const claimed = !window.dispatchEvent(new CustomEvent(OPEN_TOUR_EVENT, { cancelable: true }));
    if (!claimed) router.push(tourHref(storeId));
  };

  const openChecklist = () => {
    // A checklist hidden earlier would stay hidden on arrival: bring it back first.
    if (guideState.isChecklistDismissed(storeId)) guideState.restoreChecklist(storeId);
    onNavigate?.();
  };

  const restoreTips = () => {
    guideState.restoreTips();
    toast.success(t("helpCenter.gettingStarted.tipsRestored"));
  };

  if (openGuide) {
    return (
      <div ref={rootRef} className="scroll-mt-4">
        <HelpGuideArticle guide={openGuide} onBack={backToGuides} />
      </div>
    );
  }

  const gettingStarted = (
    <HelpSection title={t("helpCenter.gettingStarted.title")}>
      <HelpRowGroup label={t("helpCenter.gettingStarted.title")}>
        {showTour && (
          <HelpActionRow
            icon={Compass}
            label={t("helpCenter.gettingStarted.replayTour")}
            description={t("helpCenter.gettingStarted.replayTourDesc")}
            onClick={replayTour}
          />
        )}
        {showChecklist && (
          <HelpActionRow
            icon={ListChecks}
            label={t("helpCenter.gettingStarted.openChecklist")}
            description={t("helpCenter.gettingStarted.openChecklistDesc")}
            href={checklistHref(storeId)}
            onClick={openChecklist}
          />
        )}
        <HelpActionRow
          icon={Lightbulb}
          label={t("helpCenter.gettingStarted.showTips")}
          description={
            hiddenTips > 0
              ? t("helpCenter.gettingStarted.showTipsDesc")
              : t("helpCenter.gettingStarted.noTipsHidden")
          }
          onClick={restoreTips}
          disabled={hiddenTips === 0}
        />
      </HelpRowGroup>
    </HelpSection>
  );

  const guides = (
    <HelpSection title={t("helpCenter.guides.title")} description={t("helpCenter.guides.subtitle")}>
      {openSlug && (
        // A ?guide= that names no guide (an old or mistyped link).
        <p role="status" className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
          {t("helpCenter.guides.notFound")}
        </p>
      )}
      <HelpGuideList featured={featured} rest={rest} onOpen={showGuide} />
    </HelpSection>
  );

  // The POS sheet links the changelog only for someone who can reach Back Office.
  const changelogHref =
    context === "backoffice" || canManage ? `/store/${storeId}/changelog` : null;
  const whatsNew = (
    <HelpWhatsNew releases={releases} changelogHref={changelogHref} onNavigate={onNavigate} />
  );

  if (context === "pos") {
    return (
      <div ref={rootRef} className="space-y-6">
        {gettingStarted}
        {guides}
        {whatsNew}
        <HelpContact />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-5xl scroll-mt-4 space-y-6">
      <header>
        <p className="text-epi-gold-600 dark:text-epi-gold-400 text-xs font-bold tracking-[0.18em] uppercase">
          {t("helpCenter.eyebrow")}
        </p>
        <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
          {t("helpCenter.title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">{t("helpCenter.subtitle")}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <div className="min-w-0 space-y-6">
          {gettingStarted}
          {guides}
        </div>
        <div className="min-w-0 space-y-6">
          {whatsNew}
          <HelpContact />
        </div>
      </div>
    </div>
  );
}
