"use client";

import { useCallback, useEffect, useId, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, MoreHorizontal, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/components/lang/i18n-provider";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { SetupProgress } from "@/lib/guide/contracts";
import { useGuideState } from "../hooks/use-guide-state";
import { useSetupProgress } from "../hooks/use-setup-progress";
import { SetupChecklistSection } from "./setup-checklist-section";

/** ?checklist=1 (the Help centre's link) shows the checklist on a store that is no longer new. */
export const CHECKLIST_PARAM = "checklist";

interface SetupChecklistProps {
  storeId: string;
  /**
   * The owner, or a MANAGER persona on the owner's device — the dashboard page
   * decides (same rule as GET /api/stores/[id]/setup-progress, so a cashier
   * persona never even asks).
   */
  canView: boolean;
  /**
   * Store created within NEW_STORE_WINDOW_DAYS, worked out on the server. It
   * lets the card hold its place while loading (no jump when it arrives) and
   * skips the request for an established store.
   */
  isNewStore: boolean;
}

/**
 * The Getting-started checklist at the top of the Back Office dashboard:
 * "Get your store ready", the store's progress, and its steps grouped by
 * section in the order the server picked (the owner's goals first). Every
 * step ticks itself off from real data (useSetupProgress refetches on focus).
 *
 * Shown to the owner or a manager persona, on a new store — or on any store
 * when the URL carries ?checklist=1 — until someone hides it (per store,
 * saved in the guide state, with an Undo). Collapsing is a per-device
 * preference in localStorage. A 403 (null) or a failed read renders nothing.
 *
 * ?checklist=1 is read once and removed from the URL (like the tour's
 * ?tour=1): it holds for this visit of the page, so Back or a reload lands on
 * the plain dashboard and a checklist hidden meanwhile stays hidden.
 */
export function SetupChecklist({ storeId, canView, isNewStore }: SetupChecklistProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = searchParams?.get(CHECKLIST_PARAM) === "1";
  const [forced, setForced] = useState(requested);
  // Bumped by an ask that arrives while the page is mounted (a search-param
  // change doesn't remount the page): re-shows a card hidden in this visit.
  const [openCount, setOpenCount] = useState(0);
  const [seenRequest, setSeenRequest] = useState(requested);
  if (requested !== seenRequest) {
    setSeenRequest(requested);
    if (requested) {
      setForced(true);
      setOpenCount((count) => count + 1);
    }
  }

  // Remove the param whenever it is there (again, if another URL update put it back).
  useEffect(() => {
    if (!requested) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete(CHECKLIST_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : (pathname ?? "/"), { scroll: false });
  }, [requested, searchParams, pathname, router]);

  if (!canView || (!isNewStore && !forced)) return null;
  return <SetupChecklistCard key={openCount} storeId={storeId} forced={forced} />;
}

function SetupChecklistCard({ storeId, forced }: { storeId: string; forced: boolean }) {
  const { t } = useI18n();
  const guide = useGuideState();
  const dismissed = guide.isChecklistDismissed(storeId);
  // Hidden in this visit: covers ?checklist=1, which shows the card even when dismissed.
  const [hiddenNow, setHiddenNow] = useState(false);
  const [collapsed, setCollapsed] = useCollapsed(storeId);

  const hiddenBySavedState = guide.isReady && dismissed && !forced;
  const progress = useSetupProgress(storeId, { enabled: !hiddenNow && !hiddenBySavedState });

  if (hiddenNow || hiddenBySavedState) return null;

  const hide = () => {
    setHiddenNow(true);
    guide.dismissChecklist(storeId);
    trackEvent("checklist_dismissed");
    toast(t("setupGuide.checklist.hiddenToast"), {
      description: t("setupGuide.checklist.hiddenHint"),
      action: {
        label: t("setupGuide.checklist.undo"),
        onClick: () => {
          guide.restoreChecklist(storeId);
          setHiddenNow(false);
        },
      },
    });
  };

  // Hold the card's place until both reads are in.
  if (!guide.isReady || (progress.data === undefined && progress.isPending)) {
    if (!guide.isReady && !guide.isLoading) return null; // the guide-state read failed
    return <SetupChecklistSkeleton collapsed={collapsed} />;
  }

  const data = progress.data;
  // null: this viewer may not see it (403). undefined: the read failed.
  if (!data) return null;
  // The server's own clock and plan are the last word on "new".
  if (!forced && !data.isNewStore) return null;
  // The server drops items a manager persona can't open. With none left there
  // is nothing to do here: "0 of 0" plus plan upsells is the owner's call.
  if (data.total === 0) return null;

  if (data.allDone) return <SetupChecklistAllSet onDismiss={hide} />;

  return (
    <SetupChecklistPanel
      data={data}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed(!collapsed)}
      onHide={hide}
    />
  );
}

interface SetupChecklistPanelProps {
  data: SetupProgress;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHide: () => void;
}

function SetupChecklistPanel({
  data,
  collapsed,
  onToggleCollapsed,
  onHide,
}: SetupChecklistPanelProps) {
  const { t } = useI18n();
  const titleId = useId();
  const bodyId = useId();
  const percent = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
  const progressLabel = t("setupGuide.checklist.progress")
    .replace("{done}", String(data.completed))
    .replace("{total}", String(data.total));

  return (
    <section
      aria-labelledby={titleId}
      data-testid="setup-checklist"
      className="bg-card w-full min-w-0 overflow-hidden rounded-xl border"
    >
      <div className="border-epi-gold-500 flex items-start gap-2 border-l-4 py-3 pr-2 pl-4 sm:pl-5">
        <div className="min-w-0 flex-1 py-1">
          <h2 id={titleId} className="text-base leading-tight font-semibold sm:text-lg">
            {t("setupGuide.checklist.title")}
          </h2>
          <div className="mt-2 flex items-center gap-3">
            <Progress
              value={percent}
              aria-label={progressLabel}
              className="bg-epi-gold-500/20 [&>[data-slot=progress-indicator]]:bg-epi-gold-500 h-2 max-w-56 flex-1"
            />
            <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
              {progressLabel}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          aria-label={
            collapsed ? t("setupGuide.checklist.expand") : t("setupGuide.checklist.collapse")
          }
          onClick={onToggleCollapsed}
        >
          <ChevronDown
            className={cn("size-5 transition-transform", !collapsed && "rotate-180")}
            aria-hidden
          />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              aria-label={t("setupGuide.checklist.options")}
            >
              <MoreHorizontal className="size-5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="min-h-10" onSelect={onHide}>
              <EyeOff aria-hidden />
              {t("setupGuide.checklist.hide")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!collapsed && (
        <div id={bodyId} className="space-y-4 border-t px-2 py-3 sm:px-3">
          {data.sections.map((section) => (
            <SetupChecklistSection
              key={section}
              section={section}
              items={data.items.filter((item) => item.section === section)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SetupChecklistAllSet({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useI18n();
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      data-testid="setup-checklist-all-set"
      className="bg-card border-epi-gold-500 flex w-full min-w-0 items-center gap-3 rounded-xl border border-l-4 p-3 sm:p-4"
    >
      <span className="bg-epi-gold-500 text-epi-navy-900 flex size-10 shrink-0 items-center justify-center rounded-full">
        <CheckCircle2 className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="text-base leading-tight font-semibold">
          {t("setupGuide.checklist.allSetTitle")}
        </h2>
        <p className="text-muted-foreground text-sm leading-snug">
          {t("setupGuide.checklist.allSetBody")}
        </p>
      </div>
      <Button type="button" variant="outline" className="h-10 shrink-0" onClick={onDismiss}>
        {t("setupGuide.checklist.dismiss")}
      </Button>
    </section>
  );
}

function SetupChecklistSkeleton({ collapsed }: { collapsed: boolean }) {
  const { t } = useI18n();
  return (
    <section
      aria-busy="true"
      aria-label={t("setupGuide.checklist.loading")}
      data-testid="setup-checklist-loading"
      className="bg-card w-full min-w-0 overflow-hidden rounded-xl border"
    >
      <div className="border-epi-gold-500 flex items-start gap-2 border-l-4 py-3 pr-2 pl-4 sm:pl-5">
        <div className="min-w-0 flex-1 py-1">
          <p className="text-base leading-tight font-semibold sm:text-lg">
            {t("setupGuide.checklist.title")}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Skeleton className="h-2 max-w-56 flex-1 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <div className="size-10 shrink-0" />
        <div className="size-10 shrink-0" />
      </div>
      {!collapsed && (
        <div className="space-y-2 border-t px-4 py-4 sm:px-5">
          <Skeleton className="h-3 w-24" />
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex min-h-12 items-center gap-3">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Collapsed state (per store, per device) ─────────────────────────────────

const COLLAPSE_EVENT = "epidom:setup-checklist-collapse";
/** Used when localStorage is blocked, so the toggle still works for the visit. */
const memoryCollapsed = new Map<string, boolean>();

const collapsedKey = (storeId: string) => `epidom.setupChecklist.collapsed.${storeId}`;

function readCollapsed(storeId: string): boolean {
  try {
    return window.localStorage.getItem(collapsedKey(storeId)) === "1";
  } catch {
    // Blocked storage: this visit's memory.
    return memoryCollapsed.get(storeId) ?? false;
  }
}

function writeCollapsed(storeId: string, collapsed: boolean): void {
  try {
    if (collapsed) window.localStorage.setItem(collapsedKey(storeId), "1");
    else window.localStorage.removeItem(collapsedKey(storeId));
  } catch {
    // Blocked storage: carry it in memory for this visit.
    memoryCollapsed.set(storeId, collapsed);
  }
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
}

function subscribeCollapsed(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(COLLAPSE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(COLLAPSE_EVENT, onChange);
  };
}

/** Expanded on the server render; the saved choice applies on hydration. */
function useCollapsed(storeId: string): [boolean, (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    () => readCollapsed(storeId),
    () => false
  );
  const setCollapsed = useCallback((next: boolean) => writeCollapsed(storeId, next), [storeId]);
  return [collapsed, setCollapsed];
}
