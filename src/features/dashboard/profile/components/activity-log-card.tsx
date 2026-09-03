"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, ShieldAlert, Flag } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { toast } from "sonner";

interface MineRow {
  id: string;
  occurredAt: string;
  actionCode: string;
  route: string;
  method: string;
  outcome: string;
  severity: string;
  targetType: string | null;
}

interface AccountRow {
  id: string;
  occurredAt: string;
  actionType: string;
  category: string;
  state: string;
  label: string | null;
  flagged: boolean;
  by: string;
}

/**
 * The account holder's own history.
 *
 * Two sections, because they answer different questions: "what did I do" is
 * useful, but "what did somebody else do to my account" is the one that matters
 * — today an admin can reset a password, mint a temporary one and force email
 * verification without the account holder ever being told.
 *
 * The acting admin is deliberately never named. The user needs to know it
 * happened and be able to challenge it; naming an individual support agent
 * invites retaliation and gives them nothing actionable.
 */
export function ActivityLogCard() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"mine" | "account">("mine");
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery<{
    success: boolean;
    data: { mine: MineRow[]; account: AccountRow[] };
  }>({
    queryKey: ["user-activity"],
    queryFn: () => fetch("/api/user/activity?limit=50").then((r) => r.json()),
  });

  const flag = useMutation({
    mutationFn: async (actionLogId: string) => {
      const res = await fetch("/api/user/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionLogId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-activity"] });
      toast.success(t("profile.activity.flaggedTitle"), {
        description: t("profile.activity.flaggedBody"),
      });
    },
  });

  const mine = data?.data?.mine ?? [];
  const account = data?.data?.account ?? [];
  const rows = tab === "mine" ? mine : account;
  const visible = expanded ? rows : rows.slice(0, 8);

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold">
          <Activity className="h-5 w-5" />
          {t("profile.sections.activity")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {(
            [
              ["mine", t("profile.activity.tabMine"), mine.length],
              ["account", t("profile.activity.tabAccount"), account.length],
            ] as const
          ).map(([key, label, count]) => (
            <Button
              key={key}
              size="sm"
              variant={tab === key ? "default" : "outline"}
              onClick={() => {
                setTab(key);
                setExpanded(false);
              }}
              className="h-10"
            >
              {label}
              {count > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {count}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}

        {!isLoading && visible.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-sm">
            {t("profile.activity.empty")}
          </p>
        )}

        {/* Row styling, not a Table: this is a short list on a settings page,
            and the Connected Devices rows above it already set the pattern. */}
        <ul className="divide-border divide-y">
          {visible.map((row) => {
            const isAccountRow = tab === "account";
            const a = row as AccountRow;
            const m = row as MineRow;
            return (
              <li key={row.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm font-medium break-words">
                    {isAccountRow ? (a.label ?? a.actionType) : m.actionCode}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {new Date(row.occurredAt).toLocaleString()}
                    {isAccountRow && ` · ${t("profile.activity.bySupport")}`}
                    {!isAccountRow && m.outcome !== "SUCCESS" && ` · ${m.outcome}`}
                  </p>
                </div>

                {isAccountRow && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {a.state === "REVERTED" && (
                      <Badge variant="outline" className="text-[10px]">
                        {t("profile.activity.reverted")}
                      </Badge>
                    )}
                    {a.flagged ? (
                      <Badge
                        variant="outline"
                        className="border-orange-500/40 text-[10px] text-orange-400"
                      >
                        {t("profile.activity.flagged")}
                      </Badge>
                    ) : (
                      // Always visible, never hover-gated: a touch device has
                      // no hover state, so a hover-only control is unreachable.
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 gap-1.5 px-2 opacity-70 hover:opacity-100"
                        disabled={flag.isPending}
                        onClick={() => flag.mutate(a.id)}
                      >
                        <Flag className="h-3.5 w-3.5" />
                        <span className="text-xs">{t("profile.activity.notMe")}</span>
                      </Button>
                    )}
                  </div>
                )}

                {!isAccountRow && m.severity === "CRITICAL" && (
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                )}
              </li>
            );
          })}
        </ul>

        {rows.length > 8 && (
          <Button variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? t("profile.activity.showLess") : t("profile.activity.showAll")}
          </Button>
        )}

        <p className="text-muted-foreground text-xs">{t("profile.activity.retentionNote")}</p>
      </CardContent>
    </Card>
  );
}
