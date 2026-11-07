"use client";

import { useI18n } from "@/components/lang/i18n-provider";

import { useCallback, useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { NewsletterAudience } from "@prisma/client";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Copy,
  RotateCcw,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/use-confirm";
import {
  NEWSLETTER_AUDIENCES,
  NEWSLETTER_LANGUAGES,
  type NewsletterLanguage,
} from "@/lib/newsletter/constants";
import { hasNewsletterContent, UNSUBSCRIBE_PLACEHOLDER } from "@/lib/newsletter/render";
import { utcToZonedWallTime, zonedWallTimeToUtc } from "@/lib/utils/zoned-time";
import { campaignApi, type CampaignInput } from "../lib/campaign-api";
import {
  AUDIENCE_LABELS,
  browserTimezone,
  formatInZone,
  LANGUAGE_LABELS,
  timezoneOptions,
  zoneLabel,
  type Campaign,
} from "../lib/campaign-display";
import { CampaignStatusBadge } from "./campaign-status-badge";
import { NewsletterEmailPreview } from "./newsletter-email-preview";
import { NewsletterRichEditor } from "./newsletter-rich-editor";

type Busy = null | "save" | "schedule" | "send" | "delete" | "test" | "duplicate" | "retry";

function todayIn(zone: string): string {
  return utcToZonedWallTime(new Date(), zone).date;
}

/**
 * Write, schedule or send one newsletter. A new one is created on its first
 * save; a campaign that has started sending opens read-only.
 */
export function NewsletterEditor({ campaignId }: { campaignId?: string }) {
  const { t, intlLocale } = useI18n();
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();

  const [loading, setLoading] = useState(!!campaignId);
  const [loadError, setLoadError] = useState("");
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [contentMode, setContentMode] = useState<"rich" | "html">("rich");
  const [contentHtml, setContentHtml] = useState("");
  const [audiences, setAudiences] = useState<NewsletterAudience[]>([]);
  const [language, setLanguage] = useState<NewsletterLanguage>("all");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [timezone, setTimezone] = useState("Europe/Paris");
  const [viewerZone, setViewerZone] = useState<string | null>(null);

  const [tab, setTab] = useState("edit");
  const [busy, setBusy] = useState<Busy>(null);
  const [counts, setCounts] = useState<{
    byAudience: Record<NewsletterAudience, number>;
    total: number;
  } | null>(null);
  const [testEmail, setTestEmail] = useState("");

  const fill = useCallback((c: Campaign) => {
    setCampaign(c);
    setSubject(c.subject);
    setPreviewText(c.previewText ?? "");
    setContentMode(c.contentMode);
    setContentHtml(c.contentHtml);
    setAudiences(c.audiences);
    setLanguage(c.language);
    setTimezone(c.timezone);
    if (c.scheduledAt) {
      const wall = utcToZonedWallTime(c.scheduledAt, c.timezone);
      setDate(wall.date);
      setTime(wall.time);
    }
  }, []);

  // The viewer's zone is only known in the browser; a new newsletter starts on it.
  useEffect(() => {
    const zone = browserTimezone();
    setViewerZone(zone);
    if (!campaignId && zone) setTimezone(zone);
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    campaignApi
      .get(campaignId)
      .then(fill)
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setLoading(false));
  }, [campaignId, fill]);

  // Live audience size, debounced while ticking boxes.
  useEffect(() => {
    const timer = setTimeout(() => {
      campaignApi
        .audience(audiences, language)
        .then(setCounts)
        .catch(() => setCounts(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [audiences, language]);

  const locked = !!campaign && campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED";
  const disabled = locked || busy !== null;
  const footerLocale = language === "all" ? "fr" : language;

  const scheduledIso = useMemo(() => {
    if (!date || !time) return null;
    try {
      return zonedWallTimeToUtc(date, time, timezone).toISOString();
    } catch {
      return null;
    }
  }, [date, time, timezone]);

  function input(status: "DRAFT" | "SCHEDULED"): CampaignInput {
    return {
      subject: subject.trim(),
      previewText: previewText.trim() || null,
      contentMode,
      contentHtml,
      audiences,
      language,
      status,
      scheduledAt: scheduledIso,
      timezone,
    };
  }

  async function save(status: "DRAFT" | "SCHEDULED"): Promise<Campaign> {
    const saved = campaign
      ? await campaignApi.update(campaign.id, input(status))
      : await campaignApi.create(input(status));
    setCampaign(saved);
    // Keep the editor mounted; just give the new newsletter its own address.
    if (!campaign) window.history.replaceState(null, "", `/admin/newsletter/${saved.id}`);
    return saved;
  }

  async function run(kind: Exclude<Busy, null>, action: () => Promise<void>) {
    setBusy(kind);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  const handleSaveDraft = () =>
    run("save", async () => {
      await save("DRAFT");
      toast.success(t("adminPages.newsletter.toasts.draftSaved"));
    });

  const handleSchedule = () =>
    run("schedule", async () => {
      if (!scheduledIso) throw new Error(t("adminPages.newsletter.toasts.pickDate"));
      const saved = await save("SCHEDULED");
      toast.success(
        t("adminPages.newsletter.toasts.scheduled")
          .replace("{when}", formatInZone(saved.scheduledAt!, saved.timezone, true, intlLocale))
          .replace("{zone}", zoneLabel(saved.timezone))
      );
      router.push("/admin/newsletter");
    });

  const handleSendNow = () =>
    run("send", async () => {
      const people = counts?.total ?? 0;
      const ok = await confirm({
        title: t("adminPages.newsletter.confirm.sendTitle"),
        description: t(
          people === 1 ? "adminPages.newsletter.confirm.sendEditorDescOne" : "adminPages.newsletter.confirm.sendEditorDescMany"
        ).replace("{count}", people.toLocaleString(intlLocale)),
        confirmText: t("adminPages.newsletter.confirm.sendConfirm"),
      });
      if (!ok) return;
      const saved = await save("DRAFT");
      const { via } = await campaignApi.sendNow(saved.id);
      toast.success(
        via === "queued"
          ? t("adminPages.newsletter.toasts.sendingNow")
          : t("adminPages.newsletter.toasts.queueSlow")
      );
      router.push("/admin/newsletter");
    });

  const handleDelete = () =>
    run("delete", async () => {
      if (!campaign) return;
      const ok = await confirm({
        title: t("adminPages.newsletter.confirm.deleteTitle"),
        description: t("adminPages.newsletter.confirm.deleteEditorDesc"),
        confirmText: t("adminPages.newsletter.confirm.deleteConfirm"),
        variant: "destructive",
      });
      if (!ok) return;
      await campaignApi.remove(campaign.id);
      toast.success(t("adminPages.newsletter.toasts.deleted"));
      router.push("/admin/newsletter");
    });

  const handleDuplicate = () =>
    run("duplicate", async () => {
      if (!campaign) return;
      const copy = await campaignApi.duplicate(campaign.id);
      toast.success(t("adminPages.newsletter.toasts.duplicated"));
      router.push(`/admin/newsletter/${copy.id}`);
    });

  const handleRetry = () =>
    run("retry", async () => {
      if (!campaign) return;
      await campaignApi.retry(campaign.id);
      toast.success(t("adminPages.newsletter.toasts.retrying"));
      fill(await campaignApi.get(campaign.id));
    });

  const handleTest = () =>
    run("test", async () => {
      await campaignApi.test({
        email: testEmail.trim(),
        subject: subject.trim() || t("adminPages.newsletter.noSubject"),
        previewText: previewText.trim() || null,
        contentMode,
        contentHtml,
        locale: footerLocale,
      });
      toast.success(t("adminPages.newsletter.toasts.testSent").replace("{email}", testEmail.trim()));
    });

  async function handleModeChange(next: string) {
    if (next === contentMode) return;
    if (next === "rich" && hasNewsletterContent(contentHtml)) {
      const ok = await confirm({
        title: t("adminPages.newsletter.confirm.switchTitle"),
        description:
          t("adminPages.newsletter.confirm.switchDesc"),
        confirmText: t("adminPages.newsletter.confirm.switchConfirm"),
      });
      if (!ok) return;
    }
    setContentMode(next as "rich" | "html");
  }

  const toggleAudience = (audience: NewsletterAudience, on: boolean) =>
    setAudiences((prev) =>
      on
        ? NEWSLETTER_AUDIENCES.filter((a) => a === audience || prev.includes(a))
        : prev.filter((a) => a !== audience)
    );
  const everyone = audiences.length === NEWSLETTER_AUDIENCES.length;

  if (loading) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <NextLink href="/admin/newsletter">{t("adminPages.newsletter.editor.back")}</NextLink>
        </Button>
      </div>
    );
  }

  const isScheduled = campaign?.status === "SCHEDULED";
  const zones = timezoneOptions(viewerZone);
  if (!zones.some((z) => z.value === timezone))
    zones.push({ value: timezone, label: zoneLabel(timezone) });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="space-y-2">
        <NextLink
          href="/admin/newsletter"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" /> {t("adminPages.newsletter.editor.all")}
        </NextLink>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">
            {locked
              ? t("adminPages.newsletter.editor.viewTitle")
              : campaign
                ? t("adminPages.newsletter.editor.editTitle")
                : t("adminPages.newsletter.editor.newTitle")}
          </h1>
          {campaign && <CampaignStatusBadge campaign={campaign} />}
        </div>
      </div>

      {locked && campaign && (
        <Alert className={campaign.status === "FAILED" ? "border-red-500/40" : undefined}>
          <AlertCircle className="size-4" />
          <AlertDescription className="space-y-1">
            <p>
              {campaign.status === "SENDING"
                ? t("adminPages.newsletter.editor.sendingTo").replace(
                    "{count}",
                    campaign.recipientCount.toLocaleString(intlLocale)
                  )
                : `${t("adminPages.newsletter.editor.sentSummary").replace("{sent}", campaign.sentCount.toLocaleString(intlLocale))}${
                    campaign.failedCount
                      ? t("adminPages.newsletter.editor.failedSummary").replace("{failed}", campaign.failedCount.toLocaleString(intlLocale))
                      : ""
                  }${
                    campaign.sentAt
                      ? t("adminPages.newsletter.editor.sentAt")
                          .replace("{when}", formatInZone(campaign.sentAt, campaign.timezone, true, intlLocale))
                          .replace("{zone}", zoneLabel(campaign.timezone))
                      : ""
                  }.`}
            </p>
            {campaign.lastError && (
              <p className="text-red-700 dark:text-red-300">{campaign.lastError}</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("adminPages.newsletter.editor.content")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newsletter-subject">{t("adminPages.newsletter.editor.subject")}</Label>
              <Input
                id="newsletter-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t("adminPages.newsletter.editor.subjectPlaceholder")}
                maxLength={200}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newsletter-preview-text">
                {t("adminPages.newsletter.editor.previewText")}{" "}
                <span className="text-muted-foreground font-normal">{t("adminPages.newsletter.editor.optional")}</span>
              </Label>
              <Input
                id="newsletter-preview-text"
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder={t("adminPages.newsletter.editor.previewPlaceholder")}
                maxLength={200}
                disabled={disabled}
              />
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <TabsList>
                  <TabsTrigger value="edit" disabled={locked}>
                    {t("adminPages.newsletter.editor.write")}
                  </TabsTrigger>
                  <TabsTrigger value="preview">{t("adminPages.newsletter.editor.preview")}</TabsTrigger>
                </TabsList>
                {!locked && tab === "edit" && (
                  <Select value={contentMode} onValueChange={handleModeChange} disabled={disabled}>
                    <SelectTrigger className="h-10 w-44" aria-label={t("adminPages.newsletter.editor.format")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rich">{t("adminPages.newsletter.editor.modeRich")}</SelectItem>
                      <SelectItem value="html">{t("adminPages.newsletter.editor.modeHtml")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <TabsContent value="edit" className="mt-3 space-y-2">
                {contentMode === "rich" ? (
                  <NewsletterRichEditor
                    value={contentHtml}
                    onChange={setContentHtml}
                    disabled={disabled}
                  />
                ) : (
                  <>
                    <Textarea
                      value={contentHtml}
                      onChange={(e) => setContentHtml(e.target.value)}
                      placeholder="<html>…your designed email…</html>"
                      rows={18}
                      className="font-mono text-xs"
                      disabled={disabled}
                    />
                    <p className="text-muted-foreground text-xs">
                      {t("adminPages.newsletter.editor.htmlNoteBefore")} <code>{UNSUBSCRIBE_PLACEHOLDER}</code>{" "}
                      {t("adminPages.newsletter.editor.htmlNoteAfter")}
                    </p>
                  </>
                )}
              </TabsContent>
              <TabsContent value="preview" className="mt-3">
                <NewsletterEmailPreview
                  subject={subject}
                  previewText={previewText.trim() || null}
                  contentMode={contentMode}
                  contentHtml={contentHtml}
                  locale={footerLocale}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" /> {t("adminPages.newsletter.editor.audience")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex min-h-10 cursor-pointer items-center gap-3">
                <Checkbox
                  checked={everyone}
                  onCheckedChange={(v) => setAudiences(v ? [...NEWSLETTER_AUDIENCES] : [])}
                  disabled={disabled}
                />
                <span className="text-sm font-medium">{t("adminPages.newsletter.everyone")}</span>
              </label>
              <div className="space-y-1 border-l pl-3">
                {NEWSLETTER_AUDIENCES.map((audience) => (
                  <label
                    key={audience}
                    className="flex min-h-10 cursor-pointer items-start gap-3 py-1"
                  >
                    <Checkbox
                      checked={audiences.includes(audience)}
                      onCheckedChange={(v) => toggleAudience(audience, !!v)}
                      disabled={disabled}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2 text-sm font-medium">
                        {t(`adminPages.newsletter.audiences.${audience}.label`)}
                        {counts && (
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {counts.byAudience[audience].toLocaleString(intlLocale)}
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {t(`adminPages.newsletter.audiences.${audience}.hint`)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <Label>{t("adminPages.newsletter.editor.language")}</Label>
                <Select
                  value={language}
                  onValueChange={(v) => setLanguage(v as NewsletterLanguage)}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NEWSLETTER_LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {t(`adminPages.newsletter.languages.${l}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  {language === "all"
                    ? t("adminPages.newsletter.editor.anyLanguage")
                    : t("adminPages.newsletter.editor.onlyLanguage").replace("{language}", t(`adminPages.newsletter.languages.${language}`))}
                </p>
              </div>
              <p className="bg-muted/50 rounded-md px-3 py-2 text-sm">
                {counts ? (
                  <>
                    {t(counts.total === 1 ? "adminPages.newsletter.editor.countOne" : "adminPages.newsletter.editor.countMany").replace(
                      "{count}",
                      counts.total.toLocaleString(intlLocale)
                    )}
                  </>
                ) : (
                  t("adminPages.newsletter.editor.counting")
                )}
              </p>
            </CardContent>
          </Card>

          {!locked && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="size-4" /> {t("adminPages.newsletter.editor.when")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="newsletter-date">{t("adminPages.newsletter.editor.day")}</Label>
                    <Input
                      id="newsletter-date"
                      type="date"
                      value={date}
                      min={todayIn(timezone)}
                      onChange={(e) => setDate(e.target.value)}
                      disabled={disabled}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newsletter-time">{t("adminPages.newsletter.editor.hour")}</Label>
                    <Input
                      id="newsletter-time"
                      type="time"
                      step={900}
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      disabled={disabled}
                      className="h-10"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("adminPages.newsletter.editor.timezone")}</Label>
                  <Select value={timezone} onValueChange={setTimezone} disabled={disabled}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((z) => (
                        <SelectItem key={z.value} value={z.value}>
                          {z.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {scheduledIso && (
                  <p className="text-muted-foreground text-xs">
                    {t("adminPages.newsletter.editor.zoneTime")
                      .replace("{when}", formatInZone(scheduledIso, timezone, true, intlLocale))
                      .replace("{zone}", zoneLabel(timezone))}
                    {viewerZone && viewerZone !== timezone
                      ? t("adminPages.newsletter.editor.yourTime").replace(
                          "{when}",
                          formatInZone(scheduledIso, viewerZone, false, intlLocale)
                        )
                      : ""}
                    {t("adminPages.newsletter.editor.goesOut")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {!locked && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Send className="size-4" /> {t("adminPages.newsletter.editor.testSend")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  {t("adminPages.newsletter.editor.testHint")}
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-10 min-w-0 flex-1"
                    disabled={busy !== null}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    onClick={handleTest}
                    disabled={
                      busy !== null || !testEmail.trim() || !hasNewsletterContent(contentHtml)
                    }
                  >
                    {busy === "test" ? t("adminPages.newsletter.editor.sending") : t("adminPages.newsletter.editor.sendTest")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {locked ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleDuplicate}
              disabled={busy !== null}
            >
              <Copy className="size-4" /> {t("adminPages.newsletter.editor.duplicateDraft")}
            </Button>
            {campaign?.status === "FAILED" && (
              <Button type="button" onClick={handleRetry} disabled={busy !== null}>
                <RotateCcw className="size-4" /> {busy === "retry" ? t("adminPages.newsletter.editor.retrying") : t("adminPages.newsletter.editor.retry")}
              </Button>
            )}
          </>
        ) : (
          <>
            <Button type="button" onClick={handleSchedule} disabled={disabled || !scheduledIso}>
              <CalendarClock className="size-4" />
              {busy === "schedule"
                ? t("adminPages.newsletter.editor.saving")
                : isScheduled
                  ? t("adminPages.newsletter.editor.saveChanges")
                  : t("adminPages.newsletter.editor.schedule")}
            </Button>
            <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={disabled}>
              {busy === "save"
                ? t("adminPages.newsletter.editor.saving")
                : isScheduled
                  ? t("adminPages.newsletter.editor.toDrafts")
                  : t("adminPages.newsletter.editor.saveDraft")}
            </Button>
            <Button type="button" variant="secondary" onClick={handleSendNow} disabled={disabled}>
              <Send className="size-4" /> {busy === "send" ? t("adminPages.newsletter.editor.sending") : t("adminPages.newsletter.editor.sendNow")}
            </Button>
            {campaign && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive sm:ml-auto"
                onClick={handleDelete}
                disabled={disabled}
              >
                <Trash2 className="size-4" /> {t("adminPages.newsletter.editor.delete")}
              </Button>
            )}
          </>
        )}
      </div>

      {confirmDialog}
    </div>
  );
}
