"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { ArrowDown, ArrowUp, CalendarClock, ChevronDown, Trash2 } from "lucide-react";
import { INTL_LOCALES, useI18n } from "@/components/lang/i18n-provider";
import { ImageUpload } from "@/components/shared/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  CUSTOMER_DISPLAY_LIMITS,
  CUSTOMER_DISPLAY_MAX_BANNERS,
  type CustomerDisplayBanner,
  type CustomerDisplaySettingsValues,
} from "@/lib/validation/customer-display.schemas";

function newBannerId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Sunday-first short weekday names in the UI language (1 Jan 2023 was a Sunday). */
function useWeekdayNames(locale: string): string[] {
  return useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, day) => format.format(new Date(2023, 0, 1 + day)));
  }, [locale]);
}

/** Monday first in the picker — how a shop's week reads. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * The promo banners: add (upload), name, switch on/off, reorder, schedule.
 * Lives inside the editor's <Form>; edits are local until the editor saves.
 */
export function CustomerDisplayBanners() {
  const { t, locale } = useI18n();
  const { control, setValue } = useFormContext<CustomerDisplaySettingsValues>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "banners",
    // Our banners carry their own `id`; RHF's default key name would shadow it.
    keyName: "fieldKey",
  });
  const banners = useWatch({ control, name: "banners" }) ?? [];
  const weekdays = useWeekdayNames(INTL_LOCALES[locale]);
  const [addKey, setAddKey] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const full = fields.length >= CUSTOMER_DISPLAY_MAX_BANNERS;

  const summaryOf = (banner: CustomerDisplayBanner | undefined): string => {
    if (!banner) return "";
    const parts: string[] = [];
    parts.push(
      banner.days.length === 0 || banner.days.length === 7
        ? t("pos.customerDisplay.editor.everyDay")
        : DAY_ORDER.filter((d) => banner.days.includes(d))
            .map((d) => weekdays[d])
            .join(", ")
    );
    parts.push(
      banner.startTime && banner.endTime
        ? `${banner.startTime}–${banner.endTime}`
        : t("pos.customerDisplay.editor.allDay")
    );
    if (banner.startDate && banner.endDate) {
      parts.push(`${banner.startDate} → ${banner.endDate}`);
    } else if (banner.startDate) {
      parts.push(t("pos.customerDisplay.editor.fromDate").replace("{date}", banner.startDate));
    } else if (banner.endDate) {
      parts.push(t("pos.customerDisplay.editor.untilDate").replace("{date}", banner.endDate));
    }
    return parts.join(" · ");
  };

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          {t("pos.customerDisplay.editor.noBanners")}
        </p>
      )}

      {fields.map((field, index) => {
        const banner = banners[index];
        const expanded = open === field.fieldKey;
        const base = `banners.${index}` as const;
        return (
          <div key={field.fieldKey} className="bg-card rounded-xl border p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={field.imageUrl}
                alt={banner?.label || ""}
                className={cn(
                  "bg-muted aspect-video w-full rounded-lg object-contain sm:w-36",
                  banner && !banner.active && "opacity-40"
                )}
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={banner?.label ?? ""}
                    maxLength={CUSTOMER_DISPLAY_LIMITS.bannerLabelMax}
                    placeholder={t("pos.customerDisplay.editor.bannerLabelPlaceholder")}
                    aria-label={t("pos.customerDisplay.editor.bannerLabel")}
                    onChange={(e) =>
                      setValue(`${base}.label`, e.target.value, { shouldDirty: true })
                    }
                    className="min-w-0 flex-1"
                  />
                  <Switch
                    checked={banner?.active ?? true}
                    onCheckedChange={(checked) =>
                      setValue(`${base}.active`, checked, { shouldDirty: true })
                    }
                    aria-label={t("pos.customerDisplay.editor.bannerActive")}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    // The Button primitive is shrink-0 + nowrap: without max-w-full
                    // and shrink a long schedule summary widened the phone page.
                    className="text-muted-foreground h-10 max-w-full min-w-0 shrink justify-start gap-1.5 px-2 text-left text-xs font-normal"
                    onClick={() => setOpen(expanded ? null : field.fieldKey)}
                    aria-expanded={expanded}
                  >
                    <CalendarClock className="h-4 w-4 shrink-0" />
                    <span className="truncate">{summaryOf(banner)}</span>
                    <ChevronDown
                      className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")}
                    />
                  </Button>
                  <div className="ml-auto flex items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                      aria-label={t("pos.customerDisplay.editor.moveUp")}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                      aria-label={t("pos.customerDisplay.editor.moveDown")}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive h-10 w-10"
                      onClick={() => remove(index)}
                      aria-label={t("pos.customerDisplay.editor.removeBanner")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {expanded && banner && (
              <BannerSchedule
                banner={banner}
                weekdays={weekdays}
                onChange={(patch) => {
                  for (const [key, value] of Object.entries(patch)) {
                    setValue(
                      `${base}.${key as keyof CustomerDisplayBanner}`,
                      value as never,
                      { shouldDirty: true, shouldValidate: true }
                    );
                  }
                }}
              />
            )}
          </div>
        );
      })}

      {full ? (
        <p className="text-muted-foreground text-sm">
          {t("pos.customerDisplay.editor.bannerLimit").replace(
            "{max}",
            String(CUSTOMER_DISPLAY_MAX_BANNERS)
          )}
        </p>
      ) : (
        <div className="space-y-1.5">
          <Label>{t("pos.customerDisplay.editor.addBanner")}</Label>
          {/* Remounted after every upload so the tile is empty again for the next one. */}
          <ImageUpload
            key={addKey}
            aspectRatio="16/9"
            deletePrevious={false}
            onChange={(url) => {
              if (!url) return;
              append({
                id: newBannerId(),
                imageUrl: url,
                label: "",
                active: true,
                startDate: null,
                endDate: null,
                days: [],
                startTime: null,
                endTime: null,
              });
              setAddKey((k) => k + 1);
            }}
          />
          <p className="text-muted-foreground text-xs">
            {t("pos.customerDisplay.editor.bannerSizeHint")}
          </p>
        </div>
      )}
    </div>
  );
}

function BannerSchedule({
  banner,
  weekdays,
  onChange,
}: {
  banner: CustomerDisplayBanner;
  weekdays: string[];
  onChange: (patch: Partial<CustomerDisplayBanner>) => void;
}) {
  const { t } = useI18n();
  const datesInverted = !!banner.startDate && !!banner.endDate && banner.startDate > banner.endDate;
  const halfTime = (banner.startTime === null) !== (banner.endTime === null);

  return (
    <div className="mt-3 space-y-4 border-t pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${banner.id}-start`}>{t("pos.customerDisplay.editor.startDate")}</Label>
          <Input
            id={`${banner.id}-start`}
            type="date"
            value={banner.startDate ?? ""}
            onChange={(e) => onChange({ startDate: e.target.value || null })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${banner.id}-end`}>{t("pos.customerDisplay.editor.endDate")}</Label>
          <Input
            id={`${banner.id}-end`}
            type="date"
            value={banner.endDate ?? ""}
            onChange={(e) => onChange({ endDate: e.target.value || null })}
          />
        </div>
      </div>
      {datesInverted && (
        <p className="text-destructive text-xs">{t("pos.customerDisplay.editor.datesInverted")}</p>
      )}

      <div className="space-y-1.5">
        <Label>{t("pos.customerDisplay.editor.days")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {DAY_ORDER.map((day) => {
            const on = banner.days.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange({
                    days: on
                      ? banner.days.filter((d) => d !== day)
                      : [...banner.days, day].sort((a, b) => a - b),
                  })
                }
                className={cn(
                  "h-10 min-w-12 rounded-lg border px-2.5 text-sm font-medium transition-colors",
                  on
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted"
                )}
              >
                {weekdays[day]}
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs">{t("pos.customerDisplay.editor.daysHint")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${banner.id}-from`}>{t("pos.customerDisplay.editor.fromTime")}</Label>
          <Input
            id={`${banner.id}-from`}
            type="time"
            value={banner.startTime ?? ""}
            onChange={(e) => onChange({ startTime: e.target.value || null })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${banner.id}-to`}>{t("pos.customerDisplay.editor.toTime")}</Label>
          <Input
            id={`${banner.id}-to`}
            type="time"
            value={banner.endTime ?? ""}
            onChange={(e) => onChange({ endTime: e.target.value || null })}
          />
        </div>
      </div>
      {halfTime && (
        <p className="text-destructive text-xs">{t("pos.customerDisplay.editor.timesBoth")}</p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10"
        onClick={() =>
          onChange({ startDate: null, endDate: null, days: [], startTime: null, endTime: null })
        }
      >
        {t("pos.customerDisplay.editor.clearSchedule")}
      </Button>
    </div>
  );
}
