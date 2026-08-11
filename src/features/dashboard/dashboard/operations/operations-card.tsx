"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Banknote, Clock, MapPin, UserCheck, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { staffRoleLabel } from "@/features/dashboard/shared/lib/staff-role-label";
import { DashboardCard } from "../components/dashboard-card";
import { useOperationsStatus } from "./hooks/use-operations-status";

/** Re-render cadence for the "on the clock for 2h 14m" counters. */
const TICK_MS = 60 * 1000;

const VISIBLE_LIMIT = 4;

interface OperationsCardProps {
  storeId: string;
}

/** "2h 14m" / "47m" — a duration, not a wall-clock time, so it isn't i18n-dated. */
function formatDuration(minutes: number, t: (key: string) => string): string {
  const safe = Math.max(0, minutes);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins}${t("dashboard.operations.minuteShort")}`;
  return `${hours}${t("dashboard.operations.hourShort")} ${mins}${t("dashboard.operations.minuteShort")}`;
}

/**
 * Live floor status: who is on the clock, which POS till sessions are open,
 * and how today's published roster is tracking against actual clock-ins.
 *
 * Rendered only when the viewer's plan includes OPERATIONS and their staff
 * persona is owner/manager — the parent decides that server-side (see the
 * dashboard page), and `/operations/status` enforces the same two gates.
 */
export function OperationsCard({ storeId }: OperationsCardProps) {
  const { t, formatTimeOnly } = useI18n();
  // Till floats are Shift-derived and already literal in the store's own
  // currency. Bare formatPrice() would convert from IDR and wrongly re-scale
  // them for any non-IDR store.
  const { currency, formatPrice: formatPriceRaw } = useCurrency();
  const formatPrice = (value: number) => formatPriceRaw(value, currency);

  const { data, isLoading, isError } = useOperationsStatus(storeId);

  // The payload carries ISO instants, not pre-computed durations, so elapsed
  // time stays honest between the hook's 60s refetches.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const minutesSince = (iso: string) => Math.floor((nowMs - new Date(iso).getTime()) / 60000);

  const onDuty = data?.onDuty ?? [];
  const openTills = data?.openTills ?? [];
  const late = data?.late ?? [];
  const summary = data?.today;

  const cardOther = (
    <Link href={`/store/${storeId}/schedule`}>
      <Button variant="ghost" size="sm" className="h-8 gap-1">
        {t("dashboard.operations.viewSchedule")}
        <ArrowRight className="h-3 w-3" />
      </Button>
    </Link>
  );

  const cardContent = (
    <div className="flex min-h-[300px] flex-1 flex-col gap-4">
      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <UserX className="text-muted-foreground h-8 w-8" />
          <p className="text-muted-foreground text-sm">{t("dashboard.operations.error")}</p>
        </div>
      ) : (
        <>
          {/* Summary tiles — stack 2-up on phones, 4-up from tablet. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="bg-muted/40 rounded-lg border p-2.5">
              <p className="text-muted-foreground text-xs">
                {t("dashboard.operations.onDutyLabel")}
              </p>
              <p className="text-xl font-bold">{summary?.onDutyCount ?? 0}</p>
            </div>
            <div className="bg-muted/40 rounded-lg border p-2.5">
              <p className="text-muted-foreground text-xs">
                {t("dashboard.operations.openTillsLabel")}
              </p>
              <p className="text-xl font-bold">{summary?.openTillCount ?? 0}</p>
            </div>
            <div className="bg-muted/40 rounded-lg border p-2.5">
              <p className="text-muted-foreground text-xs">
                {t("dashboard.operations.scheduledLabel")}
              </p>
              <p className="text-xl font-bold">{summary?.scheduledCount ?? 0}</p>
            </div>
            <div className="bg-muted/40 rounded-lg border p-2.5">
              <p className="text-muted-foreground text-xs">
                {t("dashboard.operations.lateLabel")}
              </p>
              <p
                className={`text-xl font-bold ${
                  (summary?.lateCount ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : ""
                }`}
              >
                {summary?.lateCount ?? 0}
              </p>
            </div>
          </div>

          {/* On the clock */}
          <div className="space-y-2">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
              <UserCheck className="h-3.5 w-3.5" />
              {t("dashboard.operations.onTheClock")}
            </p>
            {onDuty.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center text-sm">
                {t("dashboard.operations.nobodyOnTheClock")}
              </p>
            ) : (
              <ul className="divide-border divide-y rounded-lg border">
                {onDuty.slice(0, VISIBLE_LIMIT).map((staff) => (
                  <li
                    key={staff.staffMemberId}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{staff.name}</p>
                      <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 truncate text-xs">
                        <span className="truncate">{staffRoleLabel(staff, t)}</span>
                        {staff.shiftName && (
                          <>
                            <span aria-hidden>·</span>
                            <span className="truncate">{staff.shiftName}</span>
                          </>
                        )}
                        {staff.locationLabel && (
                          <>
                            <MapPin className="hidden h-3 w-3 shrink-0 sm:inline" />
                            <span className="hidden truncate sm:inline">{staff.locationLabel}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="flex items-center justify-end gap-1 text-xs font-semibold">
                        <Clock className="h-3 w-3" />
                        {formatDuration(minutesSince(staff.since), t)}
                      </p>
                      <p className="text-muted-foreground text-xs">{formatTimeOnly(staff.since)}</p>
                    </div>
                  </li>
                ))}
                {onDuty.length > VISIBLE_LIMIT && (
                  <li className="text-muted-foreground px-3 py-2 text-center text-xs">
                    {t("dashboard.operations.andMore").replace(
                      "{count}",
                      String(onDuty.length - VISIBLE_LIMIT)
                    )}
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Running till sessions */}
          {openTills.length > 0 && (
            <div className="space-y-2">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                <Banknote className="h-3.5 w-3.5" />
                {t("dashboard.operations.openTills")}
              </p>
              <ul className="divide-border divide-y rounded-lg border">
                {openTills.slice(0, VISIBLE_LIMIT).map((till) => (
                  <li
                    key={till.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{till.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {t("dashboard.operations.tillFloat")} {formatPrice(till.openingCash)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {t("dashboard.operations.tillOrders").replace(
                          "{count}",
                          String(till.orderCount)
                        )}
                      </Badge>
                      <span className="text-xs font-semibold">
                        {formatDuration(minutesSince(till.openedAt), t)}
                      </span>
                    </div>
                  </li>
                ))}
                {openTills.length > VISIBLE_LIMIT && (
                  <li className="text-muted-foreground px-3 py-2 text-center text-xs">
                    {t("dashboard.operations.andMore").replace(
                      "{count}",
                      String(openTills.length - VISIBLE_LIMIT)
                    )}
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Rostered but not clocked in yet */}
          {late.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-600 uppercase dark:text-amber-400">
                <UserX className="h-3.5 w-3.5" />
                {t("dashboard.operations.notClockedIn")}
              </p>
              <ul className="divide-border divide-y rounded-lg border border-amber-400/60 dark:border-amber-500/40">
                {late.slice(0, VISIBLE_LIMIT).map((staff) => (
                  <li
                    key={staff.staffMemberId}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{staff.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {staff.shiftName ? `${staff.shiftName} · ` : ""}
                        {staff.startTime}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {t("dashboard.operations.lateBy").replace(
                        "{duration}",
                        formatDuration(staff.minutesLate, t)
                      )}
                    </span>
                  </li>
                ))}
                {late.length > VISIBLE_LIMIT && (
                  <li className="text-muted-foreground px-3 py-2 text-center text-xs">
                    {t("dashboard.operations.andMore").replace(
                      "{count}",
                      String(late.length - VISIBLE_LIMIT)
                    )}
                  </li>
                )}
              </ul>
            </div>
          )}

          {(summary?.absentCount ?? 0) > 0 && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t("dashboard.operations.absencesToday").replace(
                "{count}",
                String(summary?.absentCount ?? 0)
              )}
            </p>
          )}
        </>
      )}
    </div>
  );

  return (
    <DashboardCard
      cardTitle={t("dashboard.operations.title")}
      cardDescription={t("dashboard.operations.description")}
      cardOther={cardOther}
      cardContent={cardContent}
    />
  );
}
