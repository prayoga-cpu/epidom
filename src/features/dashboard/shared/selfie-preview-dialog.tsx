"use client";

import { ChevronLeft, ChevronRight, ExternalLink, MapPin } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface SelfiePreviewItem {
  id: string;
  selfieUrl: string;
  /** Empty in a list that is one person's own history — the event becomes the title. */
  staffName: string;
  /** The clock event, already translated ("Clock in"). */
  typeLabel: string;
  timestamp: string;
  locationLabel: string | null;
}

interface SelfiePreviewDialogProps {
  /** Every selfie the list can step through, in the list's own order. */
  items: SelfiePreviewItem[];
  /** The one shown, as an index into `items`; null when closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
}

/**
 * A clock-in/out selfie at a size a manager can actually check a face in,
 * with who, when and where — opened from a log row's thumbnail. Previous /
 * Next (and the arrow keys) step through every selfie in the current list,
 * so auditing a day's clock-ins doesn't mean opening and closing each one.
 */
export function SelfiePreviewDialog({ items, index, onIndexChange }: SelfiePreviewDialogProps) {
  const { t, formatDateTime } = useI18n();
  const item = index !== null ? items[index] : undefined;
  const canStep = items.length > 1;
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < items.length - 1;

  const step = (delta: number) => {
    if (index === null) return;
    const next = index + delta;
    if (next >= 0 && next < items.length) onIndexChange(next);
  };

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent
        className="max-h-[calc(92dvh/var(--app-zoom,1))] max-w-lg overflow-y-auto"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            step(-1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            step(1);
          }
        }}
      >
        {item && (
          <>
            <DialogHeader>
              <DialogTitle>{item.staffName || item.typeLabel}</DialogTitle>
              <DialogDescription>
                {item.staffName
                  ? `${item.typeLabel} · ${formatDateTime(item.timestamp)}`
                  : formatDateTime(item.timestamp)}
              </DialogDescription>
            </DialogHeader>

            <div className="bg-muted flex items-center justify-center overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={item.id}
                src={item.selfieUrl}
                alt={item.staffName ? `${item.staffName} — ${item.typeLabel}` : item.typeLabel}
                className="max-h-[calc(60dvh/var(--app-zoom,1))] w-full object-contain"
              />
            </div>

            {item.locationLabel && (
              <p className="text-muted-foreground flex items-start gap-1.5 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{item.locationLabel}</span>
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              {canStep ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={() => step(-1)}
                  disabled={!hasPrev}
                  aria-label={t("pages.attendanceSelfiePrev")}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              ) : (
                <span />
              )}
              <a
                href={item.selfieUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex min-h-10 items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                {t("pages.attendanceSelfieOpenFull")}
              </a>
              {canStep ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={() => step(1)}
                  disabled={!hasNext}
                  aria-label={t("pages.attendanceSelfieNext")}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              ) : (
                <span />
              )}
            </div>
            {canStep && index !== null && (
              <p className="text-muted-foreground text-center text-xs tabular-nums">
                {t("pages.attendanceSelfieCount")
                  .replace("{current}", String(index + 1))
                  .replace("{total}", String(items.length))}
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
