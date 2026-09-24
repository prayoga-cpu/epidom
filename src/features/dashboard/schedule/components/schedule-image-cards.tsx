"use client";

import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/components/lang/i18n-provider";
import { parseLocalISO } from "@/lib/utils/date-range";
import type { ScheduleImageRow } from "./schedule-image-panel";

interface ScheduleImageCardsProps {
  images: ScheduleImageRow[];
}

/**
 * The roster pictures a manager uploaded, one card each: the dates they cover,
 * the image (tap for full size) and the manager's note. Staff-facing — My
 * Schedule and POS Mode's Team Schedule show the same cards. Nothing at all
 * for an empty list.
 */
export function ScheduleImageCards({ images }: ScheduleImageCardsProps) {
  const { t, dateLocale } = useI18n();

  if (images.length === 0) return null;

  return (
    <section aria-label={t("pages.scheduleImageTitle")} className="space-y-3">
      {images.map((image) => (
        <Card key={image.id}>
          <CardContent className="space-y-2 py-3">
            <p className="text-sm font-semibold">
              {/* Locale-formatted like the rest of the app, not the raw 2026-09-14 keys. */}
              {format(parseLocalISO(image.startDate), "d MMM yyyy", { locale: dateLocale })} –{" "}
              {format(parseLocalISO(image.endDate), "d MMM yyyy", { locale: dateLocale })}
            </p>
            {/* The roster as the manager uploaded it. Tap opens it full size,
                where a phone can pinch-zoom the small print. */}
            <a href={image.imageUrl} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.imageUrl}
                alt={t("pages.scheduleImageAlt")}
                className="mx-auto max-h-[calc(75dvh/var(--app-zoom,1))] w-auto max-w-full rounded-lg border object-contain"
              />
            </a>
            {image.note && <p className="text-muted-foreground text-xs">{image.note}</p>}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
