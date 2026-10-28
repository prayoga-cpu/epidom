"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarClock,
  Copy,
  FilePen,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirm } from "@/components/ui/use-confirm";
import { campaignApi } from "../lib/campaign-api";
import {
  AUDIENCE_LABELS,
  formatInZone,
  groupByWeek,
  isOverdue,
  LANGUAGE_LABELS,
  zoneLabel,
  type CampaignSummary,
} from "../lib/campaign-display";
import { CampaignStatusBadge } from "./campaign-status-badge";

type SendRecord = {
  id: string;
  type: string;
  subject: string;
  recipients: number;
  sentBy: string;
  createdAt: string;
};

function AudienceBadges({ campaign }: { campaign: CampaignSummary }) {
  if (campaign.audiences.length === 0) {
    return <span className="text-muted-foreground text-xs">No audience yet</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {campaign.audiences.length === 5 ? (
        <Badge variant="secondary" className="text-xs">
          Everyone
        </Badge>
      ) : (
        campaign.audiences.map((a) => (
          <Badge key={a} variant="secondary" className="text-xs">
            {AUDIENCE_LABELS[a].label}
          </Badge>
        ))
      )}
      {campaign.language !== "all" && (
        <Badge variant="outline" className="text-xs">
          {LANGUAGE_LABELS[campaign.language]}
        </Badge>
      )}
    </div>
  );
}

interface RowActions {
  onDuplicate: (c: CampaignSummary) => void;
  onSendNow: (c: CampaignSummary) => void;
  onUnschedule: (c: CampaignSummary) => void;
  onRetry: (c: CampaignSummary) => void;
  onDelete: (c: CampaignSummary) => void;
}

function CampaignRow({
  campaign,
  now,
  busy,
  actions,
}: {
  campaign: CampaignSummary;
  now: Date;
  busy: boolean;
  actions: RowActions;
}) {
  const editable = campaign.status === "DRAFT" || campaign.status === "SCHEDULED";
  const when =
    campaign.status === "SENT" || campaign.status === "FAILED"
      ? campaign.sentAt
      : campaign.scheduledAt;
  return (
    <div className="flex items-start gap-3 py-3">
      <NextLink href={`/admin/newsletter/${campaign.id}`} className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{campaign.subject || "(No subject)"}</span>
          <CampaignStatusBadge campaign={campaign} now={now} />
        </div>
        {when && (
          <p className="text-muted-foreground text-xs">
            {campaign.status === "DRAFT" ? "Planned for " : ""}
            {formatInZone(when, campaign.timezone)} ({zoneLabel(campaign.timezone)})
            {(campaign.status === "SENT" || campaign.status === "FAILED") &&
              ` · ${campaign.sentCount.toLocaleString("en")} sent${campaign.failedCount ? `, ${campaign.failedCount.toLocaleString("en")} failed` : ""}`}
          </p>
        )}
        {campaign.status === "DRAFT" && (
          <p className="text-muted-foreground text-xs">
            Edited {formatInZone(campaign.updatedAt, campaign.timezone, false)} by{" "}
            {campaign.updatedBy}
          </p>
        )}
        {campaign.lastError && (
          <p className="text-xs text-red-700 dark:text-red-300">{campaign.lastError}</p>
        )}
        <AudienceBadges campaign={campaign} />
      </NextLink>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0"
            aria-label="Actions"
            disabled={busy}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <NextLink href={`/admin/newsletter/${campaign.id}`}>
              {editable ? <Pencil className="size-4" /> : <FilePen className="size-4" />}
              {editable ? "Edit" : "View"}
            </NextLink>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.onDuplicate(campaign)}>
            <Copy className="size-4" /> Duplicate
          </DropdownMenuItem>
          {editable && campaign.subject && campaign.audiences.length > 0 && (
            <DropdownMenuItem onSelect={() => actions.onSendNow(campaign)}>
              <Send className="size-4" /> Send now
            </DropdownMenuItem>
          )}
          {campaign.status === "SCHEDULED" && (
            <DropdownMenuItem onSelect={() => actions.onUnschedule(campaign)}>
              <Undo2 className="size-4" /> Move to drafts
            </DropdownMenuItem>
          )}
          {campaign.status === "FAILED" && (
            <DropdownMenuItem onSelect={() => actions.onRetry(campaign)}>
              <RotateCcw className="size-4" /> Retry the rest
            </DropdownMenuItem>
          )}
          {editable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => actions.onDelete(campaign)}
                className="text-destructive"
              >
                <Trash2 className="size-4" /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Drafts, the schedule week by week, and what went out. */
export function NewsletterCampaignsView() {
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [earlier, setEarlier] = useState<SendRecord[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(() => {
    setLoadError("");
    setNow(new Date());
    campaignApi
      .list()
      .then(setCampaigns)
      .catch((error: Error) => setLoadError(error.message));
  }, []);

  useEffect(() => {
    load();
    fetch("/api/admin/newsletter/history")
      .then((r) => r.json())
      .then((json) => setEarlier(json.data?.sends ?? []))
      .catch(() => {});
  }, [load]);

  const { upcoming, drafts, sent, overdue } = useMemo(() => {
    const list = campaigns ?? [];
    return {
      upcoming: list.filter((c) => c.status === "SCHEDULED" || c.status === "SENDING"),
      drafts: list
        .filter((c) => c.status === "DRAFT")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      sent: list
        .filter((c) => c.status === "SENT" || c.status === "FAILED")
        .sort((a, b) => (b.sentAt ?? b.updatedAt).localeCompare(a.sentAt ?? a.updatedAt)),
      overdue: list.filter((c) => isOverdue(c, now)),
    };
  }, [campaigns, now]);

  async function act(id: string, action: () => Promise<string | void>) {
    setBusyId(id);
    try {
      const message = await action();
      if (message) toast.success(message);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyId(null);
    }
  }

  const sendNow = (c: CampaignSummary) =>
    act(c.id, async () => {
      const ok = await confirm({
        title: "Send this newsletter now?",
        description: `"${c.subject || "(No subject)"}" goes out right away instead of at its scheduled time. This can't be undone.`,
        confirmText: "Send now",
      });
      if (!ok) return;
      const { via } = await campaignApi.sendNow(c.id);
      return via === "queued" ? "Sending now" : "The scheduler will send it within 5 minutes.";
    });

  const remove = (c: CampaignSummary) =>
    act(c.id, async () => {
      const ok = await confirm({
        title: "Delete this newsletter?",
        description: `"${c.subject || "(No subject)"}" is removed for good and won't be sent.`,
        confirmText: "Delete",
        variant: "destructive",
      });
      if (!ok) return;
      await campaignApi.remove(c.id);
      return "Newsletter deleted";
    });

  const duplicate = (c: CampaignSummary) =>
    act(c.id, async () => {
      const copy = await campaignApi.duplicate(c.id);
      router.push(`/admin/newsletter/${copy.id}`);
      return "Copied to a new draft";
    });

  const unschedule = (c: CampaignSummary) =>
    act(c.id, async () => {
      await campaignApi.unschedule(c.id);
      return "Moved to drafts. It won't be sent until you schedule it again.";
    });

  const retry = (c: CampaignSummary) =>
    act(c.id, async () => {
      await campaignApi.retry(c.id);
      return "Sending the rest again. People already emailed won't get it twice.";
    });

  const rowActions: RowActions = {
    onDuplicate: duplicate,
    onSendNow: sendNow,
    onUnschedule: unschedule,
    onRetry: retry,
    onDelete: remove,
  };
  const row = (c: CampaignSummary) => (
    <CampaignRow key={c.id} campaign={c} now={now} busy={busyId === c.id} actions={rowActions} />
  );

  const empty = (text: string) => (
    <p className="text-muted-foreground py-6 text-center text-sm">{text}</p>
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Newsletter</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Write newsletters ahead, pick who gets them, and schedule each for a day and hour.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            onClick={load}
            aria-label="Refresh"
          >
            <RefreshCw className="size-4" />
          </Button>
          <Button asChild className="h-10">
            <NextLink href="/admin/newsletter/new">
              <Plus className="size-4" /> New newsletter
            </NextLink>
          </Button>
        </div>
      </div>

      {overdue.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {overdue.length === 1 ? "A newsletter is" : `${overdue.length} newsletters are`} past
            {overdue.length === 1 ? " its" : " their"} time and hasn't gone out, so the scheduler
            (Inngest) is probably not running. Use Send now from the menu, and ask the developer to
            check Inngest.
          </AlertDescription>
        </Alert>
      )}

      {loadError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {campaigns === null && !loadError ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">Scheduled ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>
            <TabsTrigger value="sent">Sent ({sent.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4 space-y-4">
            {upcoming.length === 0
              ? empty("Nothing scheduled. Write a newsletter and pick a day and hour.")
              : groupByWeek(upcoming, now).map((group) => (
                  <Card key={group.key}>
                    <CardHeader className="pb-0">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <CalendarClock className="size-4" /> {group.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y">{group.campaigns.map(row)}</CardContent>
                  </Card>
                ))}
          </TabsContent>

          <TabsContent value="drafts" className="mt-4">
            <Card>
              <CardContent className="divide-y pt-2">
                {drafts.length === 0 ? empty("No drafts.") : drafts.map(row)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sent" className="mt-4 space-y-4">
            <Card>
              <CardContent className="divide-y pt-2">
                {sent.length === 0 ? empty("Nothing sent yet.") : sent.map(row)}
              </CardContent>
            </Card>

            {earlier.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <History className="size-4" /> Earlier sends (before scheduling)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="text-muted-foreground pr-4 pb-2 font-medium">Subject</th>
                          <th className="text-muted-foreground pr-4 pb-2 font-medium">Type</th>
                          <th className="text-muted-foreground pr-4 pb-2 font-medium">
                            Recipients
                          </th>
                          <th className="text-muted-foreground pr-4 pb-2 font-medium">Sent by</th>
                          <th className="text-muted-foreground pb-2 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {earlier.map((row) => (
                          <tr key={row.id} className="border-b last:border-0">
                            <td className="py-2 pr-4">{row.subject}</td>
                            <td className="py-2 pr-4 capitalize">{row.type}</td>
                            <td className="py-2 pr-4">
                              {row.recipients === -1 ? "Audience" : row.recipients}
                            </td>
                            <td className="text-muted-foreground py-2 pr-4 text-xs">
                              {row.sentBy}
                            </td>
                            <td className="text-muted-foreground py-2 text-xs">
                              {new Date(row.createdAt).toLocaleString("en-GB")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {confirmDialog}
    </div>
  );
}
