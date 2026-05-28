"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ShoppingBag, CalendarClock, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import { useCurrentStore } from "./hooks/use-current-store";
import { apiClient } from "@/lib/api/client";
import type { NotificationItem } from "@/app/api/stores/[id]/notifications/route";
import { formatDistanceToNow } from "date-fns";

const TYPE_ICON = {
  order: ShoppingBag,
  reservation: CalendarClock,
  onboarding: CheckCircle2,
};

const TYPE_COLOR = {
  order: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  reservation: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  onboarding: "text-violet-400 bg-violet-500/10 border-violet-500/20",
};

export function NotificationBell() {
  const router = useRouter();
  const { storeId } = useCurrentStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  // Track which notifications the user dismissed locally this session
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data } = useQuery({
    queryKey: ["notifications", storeId],
    queryFn: () =>
      apiClient.get<{ notifications: NotificationItem[] }>(
        `/stores/${storeId}/notifications`
      ),
    enabled: !!storeId,
    refetchInterval: 30_000, // poll every 30s
  });

  const all = (data?.notifications ?? []).filter((n) => !dismissed.has(n.id));
  const unread = all.length;

  const dismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed((prev) => new Set([...prev, id]));
  };

  const dismissAll = () => {
    setDismissed(new Set(all.map((n) => n.id)));
  };

  const handleClick = (n: NotificationItem) => {
    setOpen(false);
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
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 shadow-xl border-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unread > 0 && (
              <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-500">
                {unread}
              </span>
            )}
          </div>
          {unread > 0 && (
            <button
              onClick={dismissAll}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto">
          {all.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">All caught up!</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {all.map((n) => {
                const Icon = TYPE_ICON[n.type];
                const color = TYPE_COLOR[n.type];
                const isZeroDate = new Date(n.createdAt).getFullYear() === 1970;

                return (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground">{n.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{n.body}</p>
                        {!isZeroDate && (
                          <p className="mt-1 text-[10px] text-muted-foreground/60">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => dismiss(n.id, e)}
                        className="ml-1 mt-0.5 shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
                        aria-label="Dismiss"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {all.length > 0 && (
          <div className="border-t border-border px-4 py-2">
            <button
              onClick={() => { setOpen(false); router.push(`/store/${storeId}/pos`); }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              View all orders →
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
