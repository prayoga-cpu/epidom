"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ShoppingBag, CalendarClock, CheckCircle2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import { useCurrentStore } from "./hooks/use-current-store";
import { apiClient } from "@/lib/api/client";
import type { NotificationItem } from "@/app/api/stores/[id]/notifications/route";
import { formatDistanceToNow } from "date-fns";
import { id, enUS, fr } from "date-fns/locale";
import { useI18n } from "@/components/lang/i18n-provider";
import { APP_VERSION } from "@/lib/version";
import { getLastSeenVersion, setLastSeenVersion } from "@/lib/last-seen-version";

// The pinned "What's new" prompt uses a local "changelog" type that widens the
// notifications route's NotificationItem union (which we must not edit).
type BellType = NotificationItem["type"] | "changelog";
// `read` items stay in the list as history but don't count toward the unread badge.
type BellItem = Omit<NotificationItem, "type"> & { type: BellType; read?: boolean };

const TYPE_ICON = {
  order: ShoppingBag,
  reservation: CalendarClock,
  onboarding: CheckCircle2,
  changelog: Sparkles,
};

const TYPE_COLOR = {
  order: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  reservation: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  onboarding: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  changelog: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

export function NotificationBell() {
  const router = useRouter();
  const { storeId } = useCurrentStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  // Track which notifications the user dismissed locally this session
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // Version the user last acknowledged via the "What's new" prompt (client-only)
  const [seenVersion, setSeenVersion] = useState<string | null>(null);
  const { t, locale } = useI18n();

  useEffect(() => {
    setSeenVersion(getLastSeenVersion());
  }, []);

  const hasUnseen = seenVersion !== APP_VERSION;

  const dateLocaleMap = { en: enUS, id, fr };
  const dateLocale = dateLocaleMap[locale] ?? id;

  const { data } = useQuery({
    queryKey: ["notifications", storeId],
    queryFn: () =>
      apiClient.get<{ notifications: NotificationItem[] }>(`/stores/${storeId}/notifications`),
    enabled: !!storeId,
    refetchInterval: 30_000, // poll every 30s
  });

  // Pinned "What's new in vX" prompt — always kept in the list as history, but
  // only counts as unread until the user opens the changelog (marked read then).
  // Uses new Date(0) so the relative-date row hides (matches onboarding items).
  const pinned: BellItem[] = [
    {
      id: `changelog-${APP_VERSION}`,
      type: "changelog",
      title: t("changelog.whatsNew").replace("{v}", APP_VERSION),
      body: t("changelog.whatsNewBody"),
      href: `/store/${storeId}/changelog`,
      createdAt: new Date(0).toISOString(),
      read: !hasUnseen,
    },
  ];

  const all: BellItem[] = [...pinned, ...(data?.notifications ?? [])].filter(
    (n) => !dismissed.has(n.id)
  );
  // Operational notifications have no read state → always count as unread.
  const unread = all.filter((n) => !n.read).length;

  const dismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed((prev) => new Set([...prev, id]));
  };

  const dismissAll = () => {
    setDismissed(new Set(all.map((n) => n.id)));
  };

  const handleClick = (n: BellItem) => {
    setOpen(false);
    if (n.type === "changelog") {
      setLastSeenVersion(APP_VERSION);
      setSeenVersion(APP_VERSION);
    }
    router.push(n.href);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 shrink-0 hover:bg-white/10"
          style={{ color: "var(--epi-cream-50)" }}
          aria-label={t("notifications.title")}
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="border-border w-80 p-0 shadow-xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="text-muted-foreground h-4 w-4" />
            <span className="text-foreground text-sm font-semibold">
              {t("notifications.title")}
            </span>
            {unread > 0 && (
              <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-500">
                {unread}
              </span>
            )}
          </div>
          {unread > 0 && (
            <button
              onClick={dismissAll}
              className="text-muted-foreground hover:text-foreground text-[11px] transition-colors"
            >
              {t("notifications.clearAll")}
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto">
          {all.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Bell className="text-muted-foreground/40 h-8 w-8" />
              <p className="text-muted-foreground text-sm">{t("notifications.allCaughtUp")}</p>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {all.map((n) => {
                const Icon = TYPE_ICON[n.type];
                const color = TYPE_COLOR[n.type];
                const isZeroDate = new Date(n.createdAt).getFullYear() === 1970;

                return (
                  <li key={n.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleClick(n)}
                      onKeyDown={(e) => e.key === "Enter" && handleClick(n)}
                      className={`group hover:bg-muted/50 flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors ${n.read ? "opacity-60" : ""}`}
                    >
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${color}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground text-xs font-semibold">{n.title}</p>
                        <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                          {n.body}
                        </p>
                        {!isZeroDate && (
                          <p className="text-muted-foreground/60 mt-1 text-[10px]">
                            {formatDistanceToNow(new Date(n.createdAt), {
                              addSuffix: true,
                              locale: dateLocale,
                            })}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => dismiss(n.id, e)}
                        // Visible by default (not hover-only): a hover-gated opacity-0 leaves
                        // this permanently unreachable on touch devices, which have no
                        // persistent hover state.
                        className="hover:bg-muted mt-0.5 ml-1 flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center rounded opacity-70 transition-opacity group-hover:opacity-100"
                        aria-label={t("notifications.dismiss")}
                      >
                        <X className="text-muted-foreground h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {all.length > 0 && (
          <div className="border-border border-t px-4 py-2">
            <button
              onClick={() => {
                setOpen(false);
                if (storeId) router.push(`/store/${storeId}/pos`);
              }}
              className="text-muted-foreground hover:text-foreground text-[11px] transition-colors"
            >
              {t("notifications.viewAllOrders")}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
