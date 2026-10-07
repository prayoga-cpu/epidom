"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  BellOff,
  Banknote,
  ShoppingBag,
  CalendarClock,
  CheckCircle2,
  Sparkles,
  Volume2,
  SlidersHorizontal,
  Check,
  Upload,
  Trash2,
  X,
} from "lucide-react";
import {
  getNotificationTone,
  setNotificationTone,
  playNotificationSound,
  getCustomSound,
  clearCustomSound,
  validateAndSaveCustomSound,
  MAX_CUSTOM_SOUND_SECONDS,
  MAX_CUSTOM_SOUND_BYTES,
  type NotificationTone,
} from "@/lib/notification-sound";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useCurrentStore } from "./hooks/use-current-store";
import { apiClient } from "@/lib/api/client";
import type { NotificationItem } from "@/app/api/stores/[id]/notifications/route";
import { formatDistanceToNow } from "date-fns";
import { id, enUS, fr } from "date-fns/locale";
import { useI18n } from "@/components/lang/i18n-provider";
import { APP_VERSION } from "@/lib/version";
import { getLastSeenVersion, setLastSeenVersion } from "@/lib/last-seen-version";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { REALTIME_EVENTS } from "@/lib/realtime/channels";
import { cn } from "@/lib/utils";

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
// An online order nobody has paid for yet: the one item the cashier must act on.
const UNPAID_COLOR = "text-red-500 bg-red-500/10 border-red-500/30";

interface NotificationBellProps {
  /**
   * "topbar" — the Back Office's navy top bar (cream icon).
   * "pos" — POS Mode's status bar: theme-coloured 40px trigger, only orders that
   * ARRIVE (storefront, delivery platforms — not the till's own sales), links
   * into the POS order queue, and none of the Back Office-only items (setup
   * reminders, the changelog prompt) a staff persona can't open.
   * Same settings either way — push and sound are per device.
   */
  variant?: "topbar" | "pos";
}

export function NotificationBell({ variant = "topbar" }: NotificationBellProps = {}) {
  const isPos = variant === "pos";
  const router = useRouter();
  const { storeId } = useCurrentStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  // Track which notifications the user dismissed locally this session
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // Version the user last acknowledged via the "What's new" prompt (client-only)
  const [seenVersion, setSeenVersion] = useState<string | null>(null);
  // In-app notification sound preference (client-only, mirrors seenVersion's
  // lazy-load-after-mount pattern to avoid a hydration mismatch on the default).
  const [tone, setTone] = useState<NotificationTone>("chime");
  const [hasCustomSound, setHasCustomSound] = useState(false);
  const customSoundInputRef = useRef<HTMLInputElement>(null);
  const { t, locale } = useI18n();
  const { state: pushState, subscribe: subscribePush, unsubscribe: unsubscribePush } =
    usePushNotifications(storeId);

  useEffect(() => {
    setSeenVersion(getLastSeenVersion());
    setTone(getNotificationTone());
    setHasCustomSound(!!getCustomSound());
  }, []);

  async function handleCustomSoundUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const result = await validateAndSaveCustomSound(file);
    if ("error" in result) {
      toast.error(result.error.message);
      return;
    }
    setHasCustomSound(true);
    setTone("custom");
    setNotificationTone("custom");
    playNotificationSound("custom");
  }

  function handleRemoveCustomSound(e: React.SyntheticEvent) {
    e.stopPropagation();
    e.preventDefault();
    clearCustomSound();
    setHasCustomSound(false);
    if (tone === "custom") {
      setTone("chime");
      setNotificationTone("chime");
    }
  }

  function selectTone(option: NotificationTone) {
    setTone(option);
    setNotificationTone(option);
    if (option !== "none") playNotificationSound(option);
  }

  function toneLabel(option: NotificationTone): string {
    switch (option) {
      case "chime":
        return t("notifications.sound.chime");
      case "ping":
        return t("notifications.sound.ping");
      case "custom":
        return t("notifications.sound.custom");
      case "none":
        return t("notifications.sound.off");
    }
  }

  const hasUnseen = seenVersion !== APP_VERSION;

  const dateLocaleMap = { en: enUS, id, fr };
  const dateLocale = dateLocaleMap[locale] ?? id;

  const { data } = useQuery({
    // The scope is in the key so the two variants never share a cached list;
    // invalidating ["notifications", storeId] still refreshes both.
    queryKey: ["notifications", storeId, variant],
    queryFn: () =>
      apiClient.get<{ notifications: NotificationItem[] }>(
        `/stores/${storeId}/notifications`,
        isPos ? { scope: "pos" } : undefined
      ),
    enabled: !!storeId,
    // The till is where a new online order has to be noticed; the poll is only
    // the fallback for when realtime (below) isn't configured.
    refetchInterval: isPos ? 15_000 : 30_000,
  });

  // A new order chimes the moment it lands instead of on the next poll.
  // Refcounted, so sharing the store channel with the POS order list is fine.
  useRealtimeChannel(storeId, {
    [REALTIME_EVENTS.ORDER_CREATED]: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", storeId] });
    },
  });

  // Pinned "What's new in vX" prompt — always kept in the list as history, but
  // only counts as unread until the user opens the changelog (marked read then).
  // Uses new Date(0) so the relative-date row hides (matches onboarding items).
  // Not on the POS: the changelog is a Back Office page.
  const pinned: BellItem[] = isPos
    ? []
    : [
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

  // Order rows are worded here, in the viewer's language; the route's English
  // title/body stay as the fallback for anything else.
  const display = (n: BellItem) => {
    if (n.type !== "order" || !n.orderNumber) return { title: n.title, body: n.body };
    if (n.unpaid) {
      return {
        title: t("notifications.order.unpaidTitle"),
        body: t("notifications.order.unpaidBody").replace("{number}", n.orderNumber),
      };
    }
    return {
      title: t("notifications.order.title"),
      body: [n.orderNumber, n.source].filter(Boolean).join(" · "),
    };
  };

  const all: BellItem[] = [...pinned, ...(data?.notifications ?? [])].filter(
    (n) => !dismissed.has(n.id)
  );
  // Operational notifications have no read state → always count as unread.
  const unread = all.filter((n) => !n.read).length;

  // Plays the notification sound for genuinely new items only — null sentinel
  // means "haven't seen a first batch yet", so the initial load never dings.
  const seenIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(all.map((n) => n.id));
    if (seenIds.current === null) {
      seenIds.current = ids;
      return;
    }
    const hasNewArrival = all.some((n) => !seenIds.current!.has(n.id) && !n.read);
    seenIds.current = ids;
    if (hasNewArrival) playNotificationSound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all.map((n) => n.id).join(",")]);

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
          className={cn(
            "relative shrink-0",
            // POS: a ≥40px touch target in the theme's own colours (the status
            // bar is bg-background, not the Back Office's navy).
            isPos ? "size-10" : "h-9 w-9 hover:bg-white/10"
          )}
          style={isPos ? undefined : { color: "var(--epi-cream-50)" }}
          aria-label={t("notifications.title")}
        >
          <Bell className={isPos ? "size-5" : "size-4"} />
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

        {/* Notification settings — one row: a single switch for the primary
            enable/disable action (push subscription, when supported), plus a
            "customize" dropdown for everything else (why push can't be
            toggled right now, and the in-app sound — which only affects this
            bell while the tab is open; browsers don't support a custom sound
            for OS-level push, so that limitation lives in the dropdown copy,
            not as a separate always-visible control). */}
        <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-2">
          <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-[11px]">
            {pushState === "subscribed" ? (
              <BellRing className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            ) : (
              <BellOff className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{t("notifications.title")}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {pushState !== "unsupported" && (
              <Switch
                checked={pushState === "subscribed"}
                disabled={
                  pushState === "subscribing" ||
                  pushState === "denied" ||
                  pushState === "ios-not-installed"
                }
                onCheckedChange={(checked) => (checked ? subscribePush() : unsubscribePush())}
                aria-label={
                  pushState === "subscribed"
                    ? t("notifications.push.disable")
                    : t("notifications.push.enable")
                }
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("notifications.customize")}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex h-7 w-7 items-center justify-center rounded transition-colors"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {(pushState === "denied" ||
                  pushState === "ios-not-installed" ||
                  pushState === "default" ||
                  pushState === "subscribing") && (
                  <>
                    <p className="text-muted-foreground px-2 py-1.5 text-[11px]">
                      {pushState === "denied" && t("notifications.push.blocked")}
                      {pushState === "ios-not-installed" && t("notifications.push.iosInstallHint")}
                      {(pushState === "default" || pushState === "subscribing") &&
                        t("notifications.push.prompt")}
                    </p>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuLabel className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-normal">
                  <Volume2 className="h-3.5 w-3.5" />
                  {t("notifications.sound.label")}
                </DropdownMenuLabel>
                {(["chime", "ping", "custom", "none"] as NotificationTone[]).map((option) => {
                  const active = tone === option;
                  return (
                    <DropdownMenuItem
                      key={option}
                      onSelect={(e) => {
                        if (option === "custom" && !hasCustomSound) {
                          e.preventDefault();
                          customSoundInputRef.current?.click();
                          return;
                        }
                        selectTone(option);
                      }}
                    >
                      <span className="flex w-4 shrink-0 items-center justify-center">
                        {active && <Check className="h-3.5 w-3.5" />}
                      </span>
                      {option === "custom" && <Upload className="h-3.5 w-3.5 shrink-0" />}
                      <span className="flex-1">{toneLabel(option)}</span>
                      {option === "custom" && hasCustomSound && (
                        <span
                          role="button"
                          tabIndex={0}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={handleRemoveCustomSound}
                          onKeyDown={(e) => e.key === "Enter" && handleRemoveCustomSound(e)}
                          aria-label={t("notifications.sound.removeCustom")}
                          className="hover:text-destructive touch-manipulation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <p className="text-muted-foreground px-2 py-1.5 text-[10px]">
                  {t("notifications.sound.customGuide")
                    .replace("{s}", String(MAX_CUSTOM_SOUND_SECONDS))
                    .replace("{mb}", String(MAX_CUSTOM_SOUND_BYTES / 1_000_000))}
                </p>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <input
            ref={customSoundInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleCustomSoundUpload}
          />
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
                const Icon = n.unpaid ? Banknote : TYPE_ICON[n.type];
                const color = n.unpaid ? UNPAID_COLOR : TYPE_COLOR[n.type];
                const isZeroDate = new Date(n.createdAt).getFullYear() === 1970;
                const { title, body } = display(n);

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
                        <p className="text-foreground text-xs font-semibold">{title}</p>
                        <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                          {body}
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
                if (storeId) router.push(`/store/${storeId}/${isPos ? "pos/orders" : "pos"}`);
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
