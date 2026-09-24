"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, CalendarDays, KeyRound, Wallet, type LucideIcon } from "lucide-react";
import type { StaffRole } from "@prisma/client";
import { useI18n } from "@/components/lang/i18n-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShiftPage } from "@/features/pos/components/shift/shift-page";
import { MyScheduleList } from "@/features/dashboard/schedule/components/my-schedule-list";
import { PublishedRoster } from "@/features/dashboard/schedule/components/published-roster";
import { ClockInOutPanel } from "@/features/dashboard/shared/clock-in-out-panel";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import { isOperationalTab, type OperationalTab } from "./lib/operational-tabs";

const TAB_META: Record<OperationalTab, { labelKey: string; icon: LucideIcon }> = {
  shift: { labelKey: "pos.shift.title", icon: Wallet },
  schedule: { labelKey: "pages.scheduleMyScheduleTitle", icon: CalendarClock },
  roster: { labelKey: "pos.operational.rosterTab", icon: CalendarDays },
  clock: { labelKey: "clockInOut.dialogTitle", icon: KeyRound },
};

interface PosModeOperationalProps {
  storeId: string;
  /** The tabs this persona gets, in order (resolveOperationalTabs, on the server). */
  tabs: OperationalTab[];
  /** Whose roster the My Schedule tab shows — the persona's own staff member. */
  scheduleStaffMemberId: string | null;
  /**
   * The persona the server worked the tabs out for: their staff member id, or
   * "owner" (the id the client gives the owner's own persona).
   */
  renderedFor: string;
  /** The Team Schedule's rows (active staff); empty when the persona has no such tab. */
  rosterStaff: { id: string; name: string; role: StaffRole }[];
}

/**
 * The Operational page: Shift, My Schedule, the team's published schedule and
 * Clock In / Out as tabs, off the POS System's bottom tab bar (PosModeShell
 * leaves it out here).
 *
 * The open tab lives in `?tab=` so the status bar's shift chip and the old
 * /pos/shift and /pos/schedule links can land on theirs. It is read on every
 * render, not once on mount, so a link to another tab of this same page still
 * switches it; a tab the persona doesn't have falls back to their first one.
 * Tapping a tab rewrites the URL in place (history.replaceState, which the App
 * Router follows) rather than navigating, so switching needs no server round
 * trip and works offline.
 *
 * Mounting is per tab, on purpose:
 *  - Shift stays mounted while hidden: its Finish screen holds a half-counted
 *    drawer in local state, and a tab tap must not throw that away.
 *  - Clock In / Out unmounts when left, so the selfie camera always stops and
 *    the next person never lands mid-way through someone else's clock-in.
 */
export function PosModeOperational({
  storeId,
  tabs,
  scheduleStaffMemberId,
  renderedFor,
  rosterStaff,
}: PosModeOperationalProps) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Switching persona to the owner is client-only (no reload), so the tabs the
  // server worked out can be the previous person's: ask it again. Once per
  // mismatch, so an id the two sides spell differently can't loop.
  const personaId = usePosSession((s) => s.staffId);
  const refreshedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!personaId || personaId === renderedFor) return;
    const key = `${renderedFor}->${personaId}`;
    if (refreshedFor.current === key) return;
    refreshedFor.current = key;
    router.refresh();
  }, [personaId, renderedFor, router]);
  const raw = searchParams?.get("tab") ?? null;
  // An old My Schedule link (/pos/schedule redirects with ?tab=schedule) opens
  // the team's schedule for someone who has that and no My Schedule — the owner,
  // whom the old page sent to the Back Office roster.
  const requested =
    raw === "schedule" && !tabs.includes("schedule") && tabs.includes("roster") ? "roster" : raw;
  const active: OperationalTab | undefined =
    isOperationalTab(requested) && tabs.includes(requested) ? requested : tabs[0];

  const select = (tab: string) => {
    if (!isOperationalTab(tab)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
  };

  if (!active) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <p className="text-muted-foreground max-w-sm text-center text-sm">
          {t("pos.operational.empty")}
        </p>
      </div>
    );
  }

  return (
    // The tab bar used to supply the bottom safe-area inset; without it the page does.
    <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]">
      <Tabs value={active} onValueChange={select} className="min-h-0 flex-1 gap-0">
        <div className="shrink-0 border-b px-3 py-2 md:px-6">
          <TabsList
            aria-label={t("pos.operational.tabsLabel")}
            // justify-start: centred content that overflows can't be scrolled back to.
            className="h-11 w-full justify-start overflow-x-auto overflow-y-hidden sm:w-auto"
          >
            {tabs.map((tab) => {
              const Icon = TAB_META[tab].icon;
              return (
                <TabsTrigger key={tab} value={tab} className="min-h-10 px-3 sm:flex-none">
                  <Icon aria-hidden />
                  {t(TAB_META[tab].labelKey)}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {tabs.includes("shift") && (
          // ShiftPage owns its scroll (and the Finish screen's pinned footer), so
          // this stays a plain flex column down from the shell's <main>.
          <TabsContent
            value="shift"
            forceMount
            className="flex min-h-0 flex-col data-[state=inactive]:hidden"
          >
            <ShiftPage storeId={storeId} />
          </TabsContent>
        )}

        {tabs.includes("schedule") && scheduleStaffMemberId && (
          <TabsContent value="schedule" className="min-h-0 overflow-y-auto md:px-2">
            <MyScheduleList
              storeId={storeId}
              staffMemberId={scheduleStaffMemberId}
              embedded
              // Its Clock In / Out button opens the Clock tab here, not a second
              // clock on top of this page.
              onClockInOut={tabs.includes("clock") ? () => select("clock") : undefined}
            />
          </TabsContent>
        )}

        {tabs.includes("roster") && (
          // Unmounted when left, like My Schedule: coming back re-reads what was published.
          <TabsContent value="roster" className="min-h-0 overflow-y-auto md:px-2">
            <PublishedRoster
              storeId={storeId}
              staff={rosterStaff}
              viewerKey={personaId ?? renderedFor}
              backOfficeHref={`/store/${storeId}/schedule`}
            />
          </TabsContent>
        )}

        {tabs.includes("clock") && (
          <TabsContent value="clock" className="min-h-0 overflow-y-auto p-3 md:p-6">
            <div className="bg-card mx-auto w-full max-w-md rounded-xl border p-4 sm:p-6">
              <ClockInOutPanel storeId={storeId} />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
