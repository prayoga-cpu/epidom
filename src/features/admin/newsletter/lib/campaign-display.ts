import type { NewsletterAudience, NewsletterCampaignStatus } from "@prisma/client";
import type { NewsletterLanguage } from "@/lib/newsletter/constants";

/** What the admin pages show about campaigns. The admin panel is English-only. */

export interface CampaignSummary {
  id: string;
  subject: string;
  previewText: string | null;
  audiences: NewsletterAudience[];
  language: NewsletterLanguage;
  status: NewsletterCampaignStatus;
  scheduledAt: string | null;
  timezone: string;
  sentAt: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  lastError: string | null;
  createdBy: string;
  updatedBy: string;
  updatedAt: string;
}

export interface Campaign extends CampaignSummary {
  contentMode: "rich" | "html";
  contentHtml: string;
}

export const AUDIENCE_LABELS: Record<NewsletterAudience, { label: string; hint: string }> = {
  SUBSCRIBERS: {
    label: "Newsletter sign-ups",
    hint: "Signed up with the footer form on the site or a sales page",
  },
  LEADS: {
    label: "Sales-page leads",
    hint: "Left their name, phone and email in a sales-page popup",
  },
  FREE: { label: "Free customers", hint: "Free plan, an unfinished checkout, or a canceled plan" },
  TRIAL: { label: "Trial customers", hint: "A paid plan still in its free trial" },
  PAID: { label: "Paid customers", hint: "Paying, payment overdue, or a plan granted by an admin" },
};

export const LANGUAGE_LABELS: Record<NewsletterLanguage, string> = {
  all: "All languages",
  fr: "French",
  en: "English",
  id: "Indonesian",
};

const ZONE_LABELS: Record<string, string> = {
  "Europe/Paris": "Paris",
  "Asia/Jakarta": "Jakarta",
  UTC: "UTC",
};

/** Paris, Jakarta, UTC, and the viewer's own zone when it is none of those. */
export function timezoneOptions(browserZone: string | null): { value: string; label: string }[] {
  const zones = ["Europe/Paris", "Asia/Jakarta", "UTC"];
  if (browserZone && !zones.includes(browserZone)) zones.push(browserZone);
  return zones.map((value) => ({ value, label: zoneLabel(value) }));
}

export function zoneLabel(zone: string): string {
  return ZONE_LABELS[zone] ?? zone.split("/").pop()?.replace(/_/g, " ") ?? zone;
}

export function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** "Tue 3 Nov 2026, 10:00", on the clock of `zone`. */
export function formatInZone(iso: string, zone: string, withYear = true): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** Past its time by this much and still SCHEDULED: the dispatcher isn't running. */
const OVERDUE_AFTER_MS = 15 * 60_000;

export function isOverdue(
  campaign: Pick<CampaignSummary, "status" | "scheduledAt">,
  now: Date
): boolean {
  return (
    campaign.status === "SCHEDULED" &&
    !!campaign.scheduledAt &&
    new Date(campaign.scheduledAt).getTime() < now.getTime() - OVERDUE_AFTER_MS
  );
}

/** Local midnight of the Monday starting `date`'s week. */
function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

/**
 * Upcoming campaigns grouped by the viewer's calendar week ("This week",
 * "Next week", "Week of 16 Nov"), soonest first. Overdue ones lead "This week".
 */
export function groupByWeek<T extends Pick<CampaignSummary, "scheduledAt">>(
  campaigns: T[],
  now: Date
): { key: string; label: string; campaigns: T[] }[] {
  const thisWeek = mondayOf(now).getTime();
  const groups = new Map<number, T[]>();
  const sorted = [...campaigns].sort(
    (a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime()
  );
  for (const campaign of sorted) {
    const start = Math.max(mondayOf(new Date(campaign.scheduledAt ?? now)).getTime(), thisWeek);
    groups.set(start, [...(groups.get(start) ?? []), campaign]);
  }
  const nextWeek = mondayOf(new Date(thisWeek + 8 * 86_400_000)).getTime();
  return [...groups.entries()].map(([start, items]) => ({
    key: String(start),
    label:
      start === thisWeek
        ? "This week"
        : start === nextWeek
          ? "Next week"
          : `Week of ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: new Date(start).getFullYear() === now.getFullYear() ? undefined : "numeric" }).format(new Date(start))}`,
    campaigns: items,
  }));
}
