"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/shared/image-upload";
import { apiClient } from "@/lib/api/client";

/** What /api/stores/[id]/schedule-images returns. Dates are YYYY-MM-DD keys. */
export interface ScheduleImageRow {
  id: string;
  imageUrl: string;
  startDate: string;
  endDate: string;
  note: string | null;
}

interface ScheduleImagePanelProps {
  storeId: string;
  /** The range the grid is showing — the dates this image will cover. */
  rangeFrom: string;
  rangeTo: string;
}

/**
 * The image half of "blocks or an image": a manager who keeps the roster
 * somewhere else uploads a photo or screenshot of it for the dates on screen,
 * and every staff member sees it on My Schedule. Uploading IS publishing — there
 * is no draft step, unlike the blocks grid.
 *
 * One image per exact range; uploading again for the same dates replaces it.
 * Mount it keyed on the range so the note field resets when the dates change.
 */
export function ScheduleImagePanel({ storeId, rangeFrom, rangeTo }: ScheduleImagePanelProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [replacing, setReplacing] = useState(false);
  const [uploading, setUploading] = useState(false);
  // null = untouched, so the saved note shows until the manager types.
  const [draftNote, setDraftNote] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["schedule-images", storeId, rangeFrom, rangeTo],
    queryFn: () =>
      apiClient.get<{ images: ScheduleImageRow[] }>(`/stores/${storeId}/schedule-images`, {
        from: rangeFrom,
        to: rangeTo,
      }),
  });
  // The same query also returns images for OTHER ranges that overlap this one;
  // this panel edits only the one that covers exactly these dates.
  const current = data?.images.find((i) => i.startDate === rangeFrom && i.endDate === rangeTo);

  const note = draftNote ?? current?.note ?? "";
  const noteChanged = !!current && draftNote !== null && draftNote.trim() !== (current.note ?? "");

  // Every place that shows a roster image: this panel, and My Schedule.
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["schedule-images", storeId] });

  const publish = useMutation({
    mutationFn: (imageUrl: string) =>
      apiClient.post(`/stores/${storeId}/schedule-images`, {
        imageUrl,
        startDate: rangeFrom,
        endDate: rangeTo,
        ...(note.trim() && { note: note.trim() }),
      }),
    onSuccess: () => {
      toast.success(t("pages.scheduleImagePublished"));
      setReplacing(false);
      setDraftNote(null);
      refresh();
    },
    onError: () => toast.error(t("common.error")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/stores/${storeId}/schedule-images/${id}`),
    onSuccess: () => {
      toast.success(t("pages.scheduleImageRemoved"));
      setReplacing(false);
      setDraftNote(null);
      refresh();
    },
    onError: () => toast.error(t("common.error")),
  });

  const busy = publish.isPending || remove.isPending || uploading;

  // The picker: the first upload, a replacement, and — when the saved image can't be
  // read — the way to upload anyway.
  const uploader = (
    <div className="max-w-xl space-y-3">
      {/* value stays undefined on purpose: this is the picker, and the saved image is
          shown (uncropped) elsewhere. The server frees the old file when it is
          replaced. maxSize 4MB: a roster screenshot has small text. */}
      <ImageUpload
        onChange={(url) => url && publish.mutate(url)}
        onUploadStateChange={setUploading}
        disabled={busy}
        maxSize={4}
      />
      {!current && (
        <div className="space-y-1">
          <Label htmlFor="schedule-image-new-note">{t("pages.scheduleImageNote")}</Label>
          <Input
            id="schedule-image-new-note"
            className="h-10"
            maxLength={200}
            value={note}
            placeholder={t("pages.scheduleImageNotePlaceholder")}
            onChange={(e) => setDraftNote(e.target.value)}
          />
        </div>
      )}
      {current && (
        <Button variant="ghost" className="h-10" onClick={() => setReplacing(false)}>
          {t("common.actions.cancel")}
        </Button>
      )}
    </div>
  );

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{t("pages.scheduleImageTitle")}</h2>
          <p className="text-muted-foreground text-sm">{t("pages.scheduleImageDesc")}</p>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        ) : isError ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm">{t("pages.scheduleImageLoadFailed")}</p>
              <Button variant="outline" className="h-10" onClick={() => refetch()}>
                {t("common.actions.retry")}
              </Button>
            </div>
            {/* Not being able to READ what is saved must not lock the manager out of
                uploading: publishing is an upsert on these exact dates, so it is right
                whether or not an image is already there. */}
            {uploader}
          </div>
        ) : current && !replacing ? (
          <div className="space-y-3">
            {/* Uncropped, unlike ImageUpload's own preview: a roster read at a
                fixed aspect ratio would hide its edges. Opens full size. */}
            <a href={current.imageUrl} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.imageUrl}
                alt={t("pages.scheduleImageAlt")}
                className="mx-auto max-h-[calc(70dvh/var(--app-zoom,1))] w-auto max-w-full rounded-lg border object-contain"
              />
            </a>

            <div className="max-w-md space-y-1">
              <Label htmlFor="schedule-image-note">{t("pages.scheduleImageNote")}</Label>
              <div className="flex gap-2">
                <Input
                  id="schedule-image-note"
                  className="h-10 flex-1"
                  maxLength={200}
                  value={note}
                  placeholder={t("pages.scheduleImageNotePlaceholder")}
                  onChange={(e) => setDraftNote(e.target.value)}
                />
                {noteChanged && (
                  <Button
                    className="h-10 shrink-0"
                    disabled={busy}
                    onClick={() => publish.mutate(current.imageUrl)}
                  >
                    {t("common.actions.save")}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="h-10"
                disabled={busy}
                onClick={() => setReplacing(true)}
              >
                {t("pages.scheduleImageReplace")}
              </Button>
              <Button
                variant="outline"
                className="text-destructive h-10"
                disabled={busy}
                onClick={() => remove.mutate(current.id)}
              >
                {remove.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="mr-2 size-4" aria-hidden />
                )}
                {t("pages.scheduleImageRemove")}
              </Button>
            </div>
          </div>
        ) : (
          uploader
        )}
      </CardContent>
    </Card>
  );
}
